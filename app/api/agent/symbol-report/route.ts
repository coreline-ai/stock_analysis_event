import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { listDecisionsBySymbol } from "@/adapters/db/repositories/decisions_repo";
import { listRawSignalsBySymbol } from "@/adapters/db/repositories/signals_raw_repo";
import { listScoredSignalsBySymbol } from "@/adapters/db/repositories/signals_scored_repo";
import type { MarketScope, SymbolReport, SignalRaw, SignalScored } from "@/core/domain/types";
import { logAuthFailure } from "@/security/log";
import type { LLMProviderName } from "@/adapters/llm/provider";
import { defaultStrategyForScope } from "@/core/pipeline/strategy_keys";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { normalizeKrSymbol, normalizeSymbol } from "@/core/pipeline/stages/normalize/symbol_map";

const MAX_LIMIT = 200;

function clampLimit(value: string | null, fallback = 50): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function buildSourceCounts(raw: SignalRaw[]): Record<string, number> {
  return raw.reduce<Record<string, number>>((acc, item) => {
    const key = item.source ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function resolveScope(value: MarketScope | undefined): MarketScope {
  if (value === "US" || value === "KR") return value;
  return "ALL";
}

function inferScopeBySymbol(symbol: string): MarketScope {
  return /^\d{6}$/.test(symbol.trim()) ? "KR" : "US";
}

function parseBool(value: string | null, fallback = true): boolean {
  if (value === null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function parseProvider(value: string | null): LLMProviderName | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "glm" || normalized === "openai" || normalized === "gemini") return normalized as LLMProviderName;
  return null;
}

function buildSummary(decision: SymbolReport["decision"], scored: SignalScored[], raw: SignalRaw[]): string {
  const lines: string[] = [];
  lines.push(`# 개별 종목 리포트`);
  lines.push("");
  if (decision) {
    lines.push(`## 판단`);
    lines.push(`- verdict: ${decision.verdict}`);
    lines.push(`- confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    lines.push(`- time_horizon: ${decision.timeHorizon}`);
    lines.push(`- thesis: ${decision.thesisSummary}`);
    lines.push(`- entry_trigger: ${decision.entryTrigger}`);
    lines.push(`- invalidation: ${decision.invalidation}`);
    if (decision.riskNotes?.length) lines.push(`- risks: ${decision.riskNotes.join(", ")}`);
  } else {
    lines.push("## 판단");
    lines.push("- 아직 판단 데이터가 없습니다.");
  }
  lines.push("");
  if (scored.length > 0) {
    const top = scored.slice(0, 5);
    lines.push("## 상위 스코어 신호");
    for (const s of top) {
      lines.push(`- score=${s.finalScore.toFixed(3)} sentiment=${s.sentimentScore.toFixed(2)} freshness=${s.freshnessScore.toFixed(2)} sourceWeight=${s.sourceWeight.toFixed(2)}`);
      if (s.reasonSummary) lines.push(`  reason: ${s.reasonSummary}`);
    }
  } else {
    lines.push("## 상위 스코어 신호");
    lines.push("- 스코어 신호가 없습니다.");
  }
  lines.push("");
  lines.push(`## 원시 신호 개수: ${raw.length}`);
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    const rawSymbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim();
    if (!rawSymbol) return jsonError("invalid_request", 400, "invalid_request");

    const scope = parseScope(req.nextUrl.searchParams.get("scope")) ?? inferScopeBySymbol(rawSymbol);
    const symbol = scope === "KR" ? normalizeKrSymbol(rawSymbol) : normalizeSymbol(rawSymbol);
    if (!symbol) return jsonError("invalid_request", 400, "invalid_request");

    const shouldRefresh = parseBool(req.nextUrl.searchParams.get("refresh"), false);
    const llmProvider = parseProvider(req.nextUrl.searchParams.get("llmProvider"));
    if (req.nextUrl.searchParams.get("llmProvider") && !llmProvider) return jsonError("invalid_request", 400, "invalid_request");
    const limit = clampLimit(req.nextUrl.searchParams.get("limit"), 60);
    let onDemandRun: SymbolReport["onDemandRun"] | undefined;

    if (shouldRefresh) {
      const run = await runPipeline({
        triggerType: "manual",
        marketScope: scope,
        strategyKey: defaultStrategyForScope(scope),
        llmProviderName: llmProvider,
        targetSymbol: symbol,
        ignoreMinInterval: true
      });
      onDemandRun = {
        runId: run.runId,
        status: run.status,
        errorSummary: run.errorSummary,
        rawCount: run.rawCount,
        scoredCount: run.scoredCount,
        decidedCount: run.decidedCount
      };
    }

    const [raw, scored, decisions] = await Promise.all([
      listRawSignalsBySymbol(symbol, limit, scope),
      listScoredSignalsBySymbol(symbol, limit, scope),
      listDecisionsBySymbol(symbol, 10, scope)
    ]);
    const decision = decisions[0] ?? null;
    const report: SymbolReport = {
      symbol,
      marketScope: resolveScope(scope),
      generatedAt: new Date().toISOString(),
      summaryMarkdown: buildSummary(decision, scored, raw),
      decision,
      scoredSignals: scored,
      rawSignals: raw,
      sourceCounts: buildSourceCounts(raw),
      onDemandRun
    };
    return jsonOk(report);
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/symbol-report", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
function parseScope(value: string | null): MarketScope | undefined {
  if (value === "US" || value === "KR") return value;
  return undefined;
}
