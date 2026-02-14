import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv, getNumberEnv } from "@/config/runtime";
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
import { lookupKrTickerName } from "@/core/pipeline/stages/normalize/kr_ticker_cache";
import { lookupSecTickerName } from "@/core/pipeline/stages/normalize/ticker_cache";
import { horizonLabelKo, marketScopeLabelKo, verdictLabelKo } from "@/core/presentation/terms";
import { assertRateLimit } from "@/security/rate_limit";

const MAX_LIMIT = 200;

function clampLimit(value: string | null, fallback = 50): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
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
  return normalizeKrSymbol(symbol) ? "KR" : "US";
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

function formatSymbolLabel(symbol: string, scope: MarketScope): string {
  if (scope === "KR" || /^\d{6}$/.test(symbol)) {
    const name = lookupKrTickerName(symbol);
    return name ? `${symbol} (${name})` : symbol;
  }
  const upper = symbol.toUpperCase();
  const name = lookupSecTickerName(upper);
  return name ? `${upper} (${name})` : upper;
}

function buildSummary(
  decision: SymbolReport["decision"],
  scored: SignalScored[],
  raw: SignalRaw[],
  scope: MarketScope,
  symbol: string
): string {
  const symbolLabel = formatSymbolLabel(symbol, scope);
  const lines: string[] = [];
  lines.push(`# 개별 종목 리포트`);
  lines.push(`- 종목: ${symbolLabel}`);
  lines.push(`- 시장: ${marketScopeLabelKo(scope)}`);
  lines.push("");
  if (decision) {
    lines.push(`## 판단`);
    lines.push(`- 결과: ${verdictLabelKo(decision.verdict)}`);
    lines.push(`- 확신도: ${(decision.confidence * 100).toFixed(1)}%`);
    lines.push(`- 보유 기간: ${horizonLabelKo(decision.timeHorizon)}`);
    lines.push(`- 핵심 근거: ${decision.thesisSummary}`);
    lines.push(`- 진입 기준: ${decision.entryTrigger}`);
    lines.push(`- 전략 철회 조건: ${decision.invalidation}`);
    if (decision.riskNotes?.length) lines.push(`- 주의할 점: ${decision.riskNotes.join(", ")}`);
  } else {
    lines.push("## 판단");
    lines.push("- 아직 판단 데이터가 없습니다.");
  }
  lines.push("");
  if (scored.length > 0) {
    const top = scored.slice(0, 5);
    lines.push("## 상위 신호 점수");
    lines.push("- 점수 해석: 0.00~0.35 약함, 0.35~0.70 보통, 0.70~1.00 강함, 1.00~1.50 매우 강함");
    for (const s of top) {
      lines.push(
        `- 점수=${s.finalScore.toFixed(3)} (감성=${s.sentimentScore.toFixed(2)}, 최신성=${s.freshnessScore.toFixed(2)}, 출처신뢰=${s.sourceWeight.toFixed(2)})`
      );
      if (s.reasonSummary) lines.push(`  - 상세 근거: ${s.reasonSummary}`);
    }
  } else {
    lines.push("## 상위 신호 점수");
    lines.push("- 스코어 신호가 없습니다.");
  }
  lines.push("");
  lines.push(`## 수집 신호 개수: ${raw.length}`);
  return lines.join("\n");
}

function dedupeScoredSignals(items: SignalScored[]): SignalScored[] {
  const seen = new Set<string>();
  const deduped: SignalScored[] = [];
  for (const item of items) {
    const key = item.rawId || item.id || "";
    if (!key) {
      deduped.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
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
      assertRateLimit(req, {
        namespace: "agent_symbol_report_refresh",
        limit: getNumberEnv("SYMBOL_REPORT_REFRESH_RATE_LIMIT", 10),
        windowMs: getNumberEnv("SYMBOL_REPORT_REFRESH_RATE_WINDOW_MS", 60_000)
      });
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
    const dedupedScored = dedupeScoredSignals(scored);
    const decision = decisions[0] ?? null;
    const report: SymbolReport = {
      symbol,
      marketScope: resolveScope(scope),
      generatedAt: new Date().toISOString(),
      summaryMarkdown: buildSummary(decision, dedupedScored, raw, scope, symbol),
      decision,
      scoredSignals: dedupedScored,
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
