import { assertNoForbiddenEnv, getEnv } from "@/config/runtime";
import { LIMITS } from "@/config/limits";
import { resolveStrategyLimits } from "@/config/strategy_limits";
import { runGather } from "@/core/pipeline/stages/gather";
import { normalizeSignals } from "@/core/pipeline/stages/normalize";
import { scoreSignals } from "@/core/pipeline/stages/score";
import { decideSignals } from "@/core/pipeline/stages/decide";
import { generateReport } from "@/core/pipeline/stages/report";
import { refreshSecTickersIfNeeded } from "@/core/pipeline/stages/normalize/ticker_cache";
import { refreshKrTickersIfNeeded } from "@/core/pipeline/stages/normalize/kr_ticker_cache";
import { insertSignalRaw } from "@/adapters/db/repositories/signals_raw_repo";
import { insertSignalScored } from "@/adapters/db/repositories/signals_scored_repo";
import { insertDecision } from "@/adapters/db/repositories/decisions_repo";
import { upsertDailyReport } from "@/adapters/db/repositories/daily_reports_repo";
import { insertAgentRun } from "@/adapters/db/repositories/agent_runs_repo";
import { getLatestAgentRun } from "@/adapters/db/repositories/agent_runs_repo";
import { acquireLock, releaseLock } from "@/adapters/lock/redis_lock";
import { nowIso } from "@/core/utils/time";
import { createLogger } from "@/core/utils/logger";
import { sha256 } from "@/core/utils/hash";
import type { AgentRunStatus, Decision, DailyReport, MarketScope, SignalRaw, SignalScored } from "@/core/domain/types";
import type { PipelineAdapters, PipelineContext } from "@/core/pipeline/types";
import { createLLMProviderFromEnv } from "@/adapters/llm/factory";
import { defaultStrategyForScope, parseMarketScope, parseStrategyKey } from "@/core/pipeline/strategy_keys";

export interface RunPipelineOptions {
  triggerType: "cron" | "manual";
  marketScope?: MarketScope;
  strategyKey?: string;
  adapters?: PipelineAdapters;
}

export interface RunPipelineResult {
  runId: string;
  marketScope: MarketScope;
  strategyKey: string;
  status: AgentRunStatus;
  errorSummary?: string | null;
  rawCount: number;
  scoredCount: number;
  decidedCount: number;
  reportId?: string;
}

export async function runPipeline(opts: RunPipelineOptions): Promise<RunPipelineResult> {
  assertNoForbiddenEnv();
  const defaultScope = parseMarketScope(getEnv("DEFAULT_MARKET_SCOPE", "US"), "US");
  if (!defaultScope) throw new Error("invalid_request");

  const marketScope = opts.marketScope ?? defaultScope;
  const defaultStrategy = getEnv("DEFAULT_STRATEGY_KEY", defaultStrategyForScope(marketScope));
  const strategyKey = parseStrategyKey(opts.strategyKey ?? defaultStrategy, marketScope);
  if (!strategyKey) throw new Error("invalid_request");
  const limits = resolveStrategyLimits(strategyKey, LIMITS);

  const startedAt = nowIso();
  const runId = sha256(`${startedAt}-${Math.random().toString(36).slice(2)}`);
  const logger = createLogger(runId);
  const ctx: PipelineContext = {
    runId,
    startedAt,
    marketScope,
    strategyKey,
    limits,
    logger
  };
  let status: AgentRunStatus = "success";
  let errorSummary: string | null = null;
  let lockHandle: { key: string; token: string } | null = null;

  let gatheredCounts: Record<string, number> = {};
  let rawSignals: SignalRaw[] = [];
  let scoredSignals: SignalScored[] = [];
  let scoredWithIds: SignalScored[] = [];
  let decisions: Decision[] = [];
  let report: DailyReport | null = null;
  const stageTimings: Record<string, number> = {};

  try {
    logger.info("pipeline_start", { triggerType: opts.triggerType, marketScope, strategyKey });

    const latest = await getLatestAgentRun(marketScope);
    if (latest?.startedAt) {
      const elapsedSeconds = (Date.now() - new Date(latest.startedAt).getTime()) / 1000;
      if (elapsedSeconds < limits.minSecondsBetweenRuns) {
        status = "partial";
        errorSummary = "run_skipped_too_soon";
        await insertAgentRun({
          triggerType: opts.triggerType,
          marketScope,
          strategyKey,
          startedAt,
          finishedAt: nowIso(),
          status,
          gatheredCounts: {},
          scoredCount: 0,
          decidedCount: 0,
          llmCalls: 0,
          llmTokensEstimated: 0,
          errorSummary,
          createdAt: startedAt
        });
        return { runId, marketScope, strategyKey, status, errorSummary, rawCount: 0, scoredCount: 0, decidedCount: 0 };
      }
    }

    const lockAdapter = opts.adapters?.lock ?? { acquire: acquireLock, release: releaseLock };
    lockHandle = await lockAdapter.acquire(`mahoraga:pipeline:${marketScope.toLowerCase()}`, 10 * 60 * 1000);
    if (!lockHandle) {
      status = "partial";
      errorSummary = "lock_unavailable";
      await insertAgentRun({
        triggerType: opts.triggerType,
        marketScope,
        strategyKey,
        startedAt,
        finishedAt: nowIso(),
        status,
        gatheredCounts: {},
        scoredCount: 0,
        decidedCount: 0,
        llmCalls: 0,
        llmTokensEstimated: 0,
        errorSummary,
        createdAt: startedAt
      });
      return { runId, marketScope, strategyKey, status, errorSummary, rawCount: 0, scoredCount: 0, decidedCount: 0 };
    }

    const gatherStart = Date.now();
    const gatherResult = await runGather(marketScope, limits);
    stageTimings.gather_ms = Date.now() - gatherStart;
    gatheredCounts = gatherResult.counts;
    const deduped = new Map<string, SignalRaw>();
    for (const raw of gatherResult.signals) {
      const key = `${raw.source}:${raw.externalId}`;
      if (!deduped.has(key)) deduped.set(key, raw);
    }
    rawSignals = Array.from(deduped.values());

    const tickerStart = Date.now();
    await refreshSecTickersIfNeeded();
    if (marketScope === "KR" || marketScope === "ALL") {
      await refreshKrTickersIfNeeded();
    }
    stageTimings.ticker_cache_ms = Date.now() - tickerStart;

    const rawInsertStart = Date.now();
    const rawWithIds: SignalRaw[] = [];
    for (const raw of rawSignals) {
      const id = await insertSignalRaw(raw);
      rawWithIds.push({ ...raw, id });
    }
    stageTimings.raw_insert_ms = Date.now() - rawInsertStart;

    const normalizeStart = Date.now();
    const normalized = normalizeSignals(rawWithIds);
    stageTimings.normalize_ms = Date.now() - normalizeStart;

    const scoreStart = Date.now();
    const scored = scoreSignals(normalized).sort((a, b) => b.finalScore - a.finalScore);
    stageTimings.score_ms = Date.now() - scoreStart;
    scoredSignals = scored.slice(0, limits.scoreTopN);

    const scoredInsertStart = Date.now();
    scoredWithIds = [];
    for (const s of scoredSignals) {
      const id = await insertSignalScored(s);
      scoredWithIds.push({ ...s, id });
    }
    stageTimings.scored_insert_ms = Date.now() - scoredInsertStart;

    const decideStart = Date.now();
    const deadlineMs = Date.now() + limits.runMaxSeconds * 1000;
    const llmProvider = opts.adapters?.llmProvider ?? createLLMProviderFromEnv();
    decisions = await decideSignals(scoredWithIds, llmProvider, deadlineMs, { marketScope, limits });
    stageTimings.decide_ms = Date.now() - decideStart;
    if (Date.now() > deadlineMs) {
      status = "partial";
      errorSummary = "timebox_exceeded";
    }

    const decisionInsertStart = Date.now();
    const savedDecisions: Decision[] = [];
    for (const d of decisions) {
      const id = await insertDecision({ ...d, marketScope });
      savedDecisions.push({ ...d, id, marketScope });
    }
    decisions = savedDecisions;
    stageTimings.decisions_insert_ms = Date.now() - decisionInsertStart;

    const reportStart = Date.now();
    report = generateReport(decisions, scoredWithIds, marketScope);
    stageTimings.report_ms = Date.now() - reportStart;
    if (report) {
      const reportInsertStart = Date.now();
      const reportId = await upsertDailyReport(report);
      report.id = reportId;
      stageTimings.report_insert_ms = Date.now() - reportInsertStart;
    }
  } catch (err) {
    status = "failed";
    errorSummary = err instanceof Error ? err.message : "unknown_error";
    logger.error("pipeline_error", { error: errorSummary });
  } finally {
    if (lockHandle) {
      const lockAdapter = opts.adapters?.lock ?? { acquire: acquireLock, release: releaseLock };
      await lockAdapter.release(lockHandle);
    }
  }

  await insertAgentRun({
    triggerType: opts.triggerType,
    marketScope,
    strategyKey,
    startedAt,
    finishedAt: nowIso(),
    status,
    gatheredCounts,
    scoredCount: scoredSignals.length,
    decidedCount: decisions.length,
    llmCalls: decisions.length,
    llmTokensEstimated: decisions.length * limits.llmMaxTokensPerCall,
    stageTimingsMs: stageTimings,
    errorSummary,
    createdAt: startedAt
  });

  logger.info("pipeline_end", {
    marketScope,
    strategyKey,
    status,
    rawCount: rawSignals.length,
    scoredCount: scoredSignals.length,
    decidedCount: decisions.length
  });

  return {
    runId,
    marketScope,
    strategyKey,
    status,
    errorSummary,
    rawCount: rawSignals.length,
    scoredCount: scoredSignals.length,
    decidedCount: decisions.length,
    reportId: report?.id
  };
}
