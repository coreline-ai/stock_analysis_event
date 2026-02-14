import { assertNoForbiddenEnv, getEnv, getNumberEnv } from "@/config/runtime";
import { LIMITS } from "@/config/limits";
import { resolveStrategyLimits } from "@/config/strategy_limits";
import { runGather } from "@/core/pipeline/stages/gather";
import { normalizeSignals } from "@/core/pipeline/stages/normalize";
import { enrichKrNormalizedSignals } from "@/core/pipeline/stages/normalize/kr_quote_enrichment";
import { scoreSignals } from "@/core/pipeline/stages/score";
import { decideSignals } from "@/core/pipeline/stages/decide";
import { generateReport } from "@/core/pipeline/stages/report";
import { refreshSecTickersIfNeeded } from "@/core/pipeline/stages/normalize/ticker_cache";
import { refreshKrTickersIfNeeded } from "@/core/pipeline/stages/normalize/kr_ticker_cache";
import { insertSignalRaw, mergeRawPayloadById } from "@/adapters/db/repositories/signals_raw_repo";
import { insertSignalScored } from "@/adapters/db/repositories/signals_scored_repo";
import { insertDecision } from "@/adapters/db/repositories/decisions_repo";
import { upsertDailyReport } from "@/adapters/db/repositories/daily_reports_repo";
import { insertAgentRun } from "@/adapters/db/repositories/agent_runs_repo";
import { getLatestAgentRun } from "@/adapters/db/repositories/agent_runs_repo";
import { acquireLock, releaseLock } from "@/adapters/lock/db_lock";
import { nowIso } from "@/core/utils/time";
import { createLogger } from "@/core/utils/logger";
import { sha256 } from "@/core/utils/hash";
import type { AgentRunStatus, Decision, DailyReport, MarketScope, SignalRaw, SignalScored } from "@/core/domain/types";
import type { PipelineAdapters } from "@/core/pipeline/types";
import { createLLMProviderFromEnv } from "@/adapters/llm/factory";
import type { LLMProviderName } from "@/adapters/llm/provider";
import { defaultStrategyForScope, parseMarketScope, parseStrategyKey } from "@/core/pipeline/strategy_keys";
import { normalizeKrSymbol, normalizeSymbol } from "@/core/pipeline/stages/normalize/symbol_map";

export interface RunPipelineOptions {
  triggerType: "manual";
  marketScope?: MarketScope;
  strategyKey?: string;
  llmProviderName?: LLMProviderName | null;
  targetSymbol?: string;
  ignoreMinInterval?: boolean;
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
  const rawTargetSymbol = opts.targetSymbol?.trim();
  const targetSymbol =
    rawTargetSymbol && rawTargetSymbol.length > 0
      ? marketScope === "KR"
        ? normalizeKrSymbol(rawTargetSymbol)
        : normalizeSymbol(rawTargetSymbol)
      : null;
  if (rawTargetSymbol && !targetSymbol) throw new Error("invalid_target_symbol");

  const defaultStrategy = getEnv("DEFAULT_STRATEGY_KEY", defaultStrategyForScope(marketScope));
  const strategyKey = parseStrategyKey(opts.strategyKey ?? defaultStrategy, marketScope);
  if (!strategyKey) throw new Error("invalid_request");
  const limits = resolveStrategyLimits(strategyKey, LIMITS);
  const scoreMaxPerSymbol = Math.max(1, getNumberEnv("SCORE_MAX_PER_SYMBOL", 6));
  const symbolRunMaxSeconds = getNumberEnv("SYMBOL_RUN_MAX_SECONDS", 90);
  const effectiveRunMaxSeconds = targetSymbol ? Math.max(limits.runMaxSeconds, symbolRunMaxSeconds) : limits.runMaxSeconds;
  const persistReserveMs = Math.max(1000, getNumberEnv("PIPELINE_PERSIST_RESERVE_MS", 3500));
  const hardDeadlineMs = Date.now() + effectiveRunMaxSeconds * 1000;
  const decideDeadlineMs = hardDeadlineMs - persistReserveMs;

  const startedAt = nowIso();
  const runId = sha256(`${startedAt}-${Math.random().toString(36).slice(2)}`);
  const logger = createLogger(runId);
  let status: AgentRunStatus = "success";
  let errorSummary: string | null = null;
  let lockHandle: { key: string; token: string } | null = null;

  let gatheredCounts: Record<string, number> = {};
  let rawSignals: SignalRaw[] = [];
  let scoredSignals: SignalScored[] = [];
  let scoredWithIds: SignalScored[] = [];
  let generatedDecisions: Decision[] = [];
  let persistedDecisions: Decision[] = [];
  let report: DailyReport | null = null;
  const stageTimings: Record<string, number> = {};
  const assertWithinDeadline = () => {
    if (Date.now() > hardDeadlineMs) {
      throw new Error("timebox_exceeded");
    }
  };
  async function runWithDeadline<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const remainingMs = hardDeadlineMs - Date.now();
    if (remainingMs <= 0) throw new Error("timebox_exceeded");
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timebox_exceeded")), remainingMs);
        })
      ]);
    } catch (err) {
      if (err instanceof Error && err.message === "timebox_exceeded") {
        logger.warn("pipeline_stage_timeout", { stage: label, remainingMs });
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  try {
    logger.info("pipeline_start", { triggerType: opts.triggerType, marketScope, strategyKey });
    assertWithinDeadline();

    const latest = await getLatestAgentRun(marketScope);
    if (!opts.ignoreMinInterval && latest?.startedAt) {
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
    lockHandle = await lockAdapter.acquire(`deepstock:pipeline:${marketScope.toLowerCase()}`, 10 * 60 * 1000);
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
    assertWithinDeadline();

    const tickerStart = Date.now();
    await runWithDeadline("ticker_cache_sec", () => refreshSecTickersIfNeeded());
    if (marketScope === "KR" || marketScope === "ALL") {
      await runWithDeadline("ticker_cache_kr", () => refreshKrTickersIfNeeded());
    }
    stageTimings.ticker_cache_ms = Date.now() - tickerStart;
    assertWithinDeadline();

    const gatherStart = Date.now();
    const gatherResult = await runWithDeadline("gather", () => runGather(marketScope, limits));
    stageTimings.gather_ms = Date.now() - gatherStart;
    assertWithinDeadline();
    gatheredCounts = gatherResult.counts;
    const deduped = new Map<string, SignalRaw>();
    for (const raw of gatherResult.signals) {
      const key = `${raw.source}:${raw.externalId}`;
      if (!deduped.has(key)) deduped.set(key, raw);
    }
    rawSignals = Array.from(deduped.values());

    const rawInsertStart = Date.now();
    const rawWithIds: SignalRaw[] = [];
    for (const raw of rawSignals) {
      assertWithinDeadline();
      const id = await insertSignalRaw(raw);
      rawWithIds.push({ ...raw, id });
    }
    stageTimings.raw_insert_ms = Date.now() - rawInsertStart;

    const normalizeStart = Date.now();
    let normalized = normalizeSignals(rawWithIds);
    if (targetSymbol) {
      normalized = normalized.filter((item) => item.symbol === targetSymbol);
      const filteredRawIds = new Set(normalized.map((item) => item.rawId));
      rawSignals = rawWithIds.filter((item) => filteredRawIds.has(item.id ?? ""));
    } else {
      rawSignals = rawWithIds;
    }
    stageTimings.normalize_ms = Date.now() - normalizeStart;
    assertWithinDeadline();

    if (marketScope === "KR" || marketScope === "ALL") {
      const enrichStart = Date.now();
      normalized = await enrichKrNormalizedSignals(normalized, hardDeadlineMs);
      stageTimings.kr_quote_enrich_ms = Date.now() - enrichStart;
      assertWithinDeadline();

      const persistStart = Date.now();
      const payloadByRawId = new Map<string, Record<string, unknown>>();
      for (const item of normalized) {
        if (!item.rawId) continue;
        const metadata = item.metadata ?? {};
        const patch: Record<string, unknown> = {};
        const volumeRatio = Number(metadata["volume_ratio"]);
        const ma5 = Number(metadata["price_above_ma5"]);
        const ma20 = Number(metadata["price_above_ma20"]);
        if (Number.isFinite(volumeRatio) && volumeRatio > 0) patch.volume_ratio = volumeRatio;
        if (Number.isFinite(ma5)) patch.price_above_ma5 = ma5 >= 0.5 ? 1 : 0;
        if (Number.isFinite(ma20)) patch.price_above_ma20 = ma20 >= 0.5 ? 1 : 0;
        if (Object.keys(patch).length === 0) continue;
        const prev = payloadByRawId.get(item.rawId) ?? {};
        payloadByRawId.set(item.rawId, { ...prev, ...patch });
      }
      for (const [rawId, payload] of payloadByRawId.entries()) {
        assertWithinDeadline();
        await mergeRawPayloadById(rawId, payload);
      }
      stageTimings.kr_quote_persist_ms = Date.now() - persistStart;
      assertWithinDeadline();
    }

    const scoreStart = Date.now();
    const scored = scoreSignals(normalized).sort((a, b) => b.finalScore - a.finalScore);
    stageTimings.score_ms = Date.now() - scoreStart;
    if (targetSymbol) {
      const symbolScoreTopN = Math.max(scoreMaxPerSymbol, getNumberEnv("SYMBOL_SCORE_TOP_N", 30));
      scoredSignals = scored.slice(0, symbolScoreTopN);
    } else {
      const symbolCount = new Map<string, number>();
      const capped: SignalScored[] = [];
      for (const signal of scored) {
        const current = symbolCount.get(signal.symbol) ?? 0;
        if (current >= scoreMaxPerSymbol) continue;
        capped.push(signal);
        symbolCount.set(signal.symbol, current + 1);
        if (capped.length >= limits.scoreTopN) break;
      }
      scoredSignals = capped;
    }
    assertWithinDeadline();

    const scoredInsertStart = Date.now();
    scoredWithIds = [];
    for (const s of scoredSignals) {
      assertWithinDeadline();
      const payload = { ...s, runRef: runId };
      const id = await insertSignalScored(payload);
      scoredWithIds.push({ ...payload, id });
    }
    stageTimings.scored_insert_ms = Date.now() - scoredInsertStart;

    const decideStart = Date.now();
    const effectiveLimits = targetSymbol
      ? {
          ...limits,
          decideTopN: Math.max(limits.decideTopN, 20),
          llmMaxSignalsPerRun: Math.max(limits.llmMaxSignalsPerRun, 20),
          llmMaxCallsPerRun: Math.max(limits.llmMaxCallsPerRun, 2),
          runMaxSeconds: effectiveRunMaxSeconds
        }
      : limits;
    assertWithinDeadline();
    const llmProvider = opts.adapters?.llmProvider ?? createLLMProviderFromEnv(opts.llmProviderName);
    generatedDecisions = await decideSignals(scoredWithIds, llmProvider, decideDeadlineMs, { marketScope, limits: effectiveLimits });
    stageTimings.decide_ms = Date.now() - decideStart;
    stageTimings.persist_reserve_ms = persistReserveMs;
    assertWithinDeadline();

    const decisionInsertStart = Date.now();
    const savedDecisions: Decision[] = [];
    for (const d of generatedDecisions) {
      assertWithinDeadline();
      const payload = { ...d, runRef: runId, marketScope };
      const id = await insertDecision(payload);
      savedDecisions.push({ ...payload, id });
    }
    persistedDecisions = savedDecisions;
    stageTimings.decisions_insert_ms = Date.now() - decisionInsertStart;

    const reportStart = Date.now();
    assertWithinDeadline();
    report = generateReport(persistedDecisions, scoredWithIds, marketScope);
    stageTimings.report_ms = Date.now() - reportStart;
    if (report) {
      assertWithinDeadline();
      const reportInsertStart = Date.now();
      const reportId = await upsertDailyReport(report);
      report.id = reportId;
      stageTimings.report_insert_ms = Date.now() - reportInsertStart;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    errorSummary = message;
    if (message === "timebox_exceeded") {
      status = "partial";
      logger.warn("pipeline_timebox_exceeded", { runMaxSeconds: effectiveRunMaxSeconds });
    } else {
      status = "failed";
      logger.error("pipeline_error", { error: errorSummary });
    }
  } finally {
    if (lockHandle) {
      const lockAdapter = opts.adapters?.lock ?? { acquire: acquireLock, release: releaseLock };
      try {
        await lockAdapter.release(lockHandle);
      } catch (releaseErr) {
        logger.warn("lock_release_error", {
          error: releaseErr instanceof Error ? releaseErr.message : "unknown_error"
        });
      }
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
    decidedCount: persistedDecisions.length,
    llmCalls: generatedDecisions.length,
    llmTokensEstimated: generatedDecisions.length * limits.llmMaxTokensPerCall,
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
    decidedCount: persistedDecisions.length
  });

  return {
    runId,
    marketScope,
    strategyKey,
    status,
    errorSummary,
    rawCount: rawSignals.length,
    scoredCount: scoredSignals.length,
    decidedCount: persistedDecisions.length,
    reportId: report?.id
  };
}
