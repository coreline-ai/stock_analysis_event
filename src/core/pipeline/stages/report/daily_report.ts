import type { Decision, DailyReport, DecisionVerdict, MarketScope, SignalScored } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { lookupKrTickerName } from "../normalize/kr_ticker_cache";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isPlaceholderText(value: string): boolean {
  const text = normalizeText(value);
  return text === "stub" || text === "tbd" || text === "none" || text === "없음";
}

function verdictHeading(verdict: DecisionVerdict): string {
  if (verdict === "BUY_NOW") return "즉시 진입";
  if (verdict === "WATCH") return "관망";
  return "회피";
}

function horizonLabel(value: Decision["timeHorizon"]): string {
  if (value === "intraday") return "당일";
  if (value === "swing") return "스윙";
  return "장기";
}

function marketScopeLabel(scope: MarketScope): string {
  if (scope === "KR") return "한국";
  if (scope === "ALL") return "통합";
  return "미국";
}

function decorateSymbol(symbol: string, scope: MarketScope): string {
  if (scope === "US") return symbol;
  if (!/^\d{6}$/.test(symbol)) return symbol;
  const name = lookupKrTickerName(symbol);
  return name ? `${symbol} (${name})` : symbol;
}

function topKeywords(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => (count > 1 ? `${key} (${count})` : key));
}

function avgConfidence(decisions: Decision[]): number {
  if (decisions.length === 0) return 0;
  const sum = decisions.reduce((acc, item) => acc + item.confidence, 0);
  return sum / decisions.length;
}

function summarizeHybrid(scoredSignals: SignalScored[]): {
  count: number;
  avgQuant: number;
  avgSocial: number;
  avgEvent: number;
  avgContextRisk: number;
  hardPassCount: number;
  triplePassCount: number;
} | null {
  const quantSignals = scoredSignals.filter((signal) => typeof signal.quantScore === "number");
  if (quantSignals.length === 0) return null;
  const avgQuant = quantSignals.reduce((acc, signal) => acc + (signal.quantScore ?? 0), 0) / quantSignals.length;
  const avgSocial = quantSignals.reduce((acc, signal) => acc + (signal.socialScore ?? 0), 0) / quantSignals.length;
  const avgEvent = quantSignals.reduce((acc, signal) => acc + (signal.eventScore ?? 0), 0) / quantSignals.length;
  const avgContextRisk = quantSignals.reduce((acc, signal) => acc + (signal.contextRiskScore ?? 0), 0) / quantSignals.length;
  const hardPassCount = quantSignals.filter((signal) => signal.hardFilterPassed === true).length;
  const triplePassCount = quantSignals.filter((signal) => signal.tripleCrownPassed === true).length;
  return { count: quantSignals.length, avgQuant, avgSocial, avgEvent, avgContextRisk, hardPassCount, triplePassCount };
}

function formatEvidence(decision: Decision, scoredById: Map<string, SignalScored>): string[] {
  const lines: string[] = [];
  const evidences = decision.sourcesUsed
    .map((id) => ({ id, signal: scoredById.get(id) }))
    .filter((item): item is { id: string; signal: SignalScored } => Boolean(item.signal))
    .sort((a, b) => b.signal.finalScore - a.signal.finalScore)
    .slice(0, 3);

  if (evidences.length === 0) {
    lines.push("- 근거 시그널: 연결된 scored signal 없음");
    return lines;
  }

  lines.push("- 근거 시그널:");
  for (const item of evidences) {
    lines.push(
      `  - [${item.signal.symbol}] score=${item.signal.finalScore.toFixed(3)} ` +
      `(감성=${item.signal.sentimentScore.toFixed(2)}, 신선도=${item.signal.freshnessScore.toFixed(2)}, 가중치=${item.signal.sourceWeight.toFixed(2)}) ` +
      `${item.signal.reasonSummary || "요약 없음"}`
    );
  }
  return lines;
}

function formatDecisionSection(
  verdict: DecisionVerdict,
  items: Decision[],
  scoredById: Map<string, SignalScored>,
  marketScope: MarketScope
): string[] {
  const lines: string[] = [];
  lines.push(`## ${verdictHeading(verdict)} (${verdict})`);
  if (items.length === 0) {
    lines.push("- 없음");
    lines.push("");
    return lines;
  }

  for (const decision of items) {
    const placeholder = isPlaceholderText(decision.thesisSummary);
    const symbolLabel = decorateSymbol(decision.symbol, marketScope);
    lines.push(
      `### ${symbolLabel} (${verdictHeading(verdict)} ${verdict}, 신뢰도 ${(decision.confidence * 100).toFixed(0)}%, ${horizonLabel(decision.timeHorizon)})`
    );
    lines.push(`- 핵심 근거: ${decision.thesisSummary}`);
    lines.push(`- 진입 트리거: ${decision.entryTrigger}`);
    lines.push(`- 무효화 조건: ${decision.invalidation}`);
    lines.push(...formatEvidence(decision, scoredById));
    lines.push(`- 촉매: ${decision.catalysts.slice(0, 3).join(", ") || "-"}`);
    lines.push(`- 리스크: ${decision.riskNotes.slice(0, 3).join(", ") || "-"}`);
    if (placeholder) {
      lines.push("- 데이터 품질 경고: LLM 요약이 placeholder(stub/tbd) 형태입니다.");
    }
    lines.push("");
  }

  return lines;
}

function getKstDateStr(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().slice(0, 10);
}

export function buildDailyReport(
  decisions: Decision[],
  scoredSignals: SignalScored[] = [],
  marketScope: MarketScope = "US"
): DailyReport {
  const buyNow = decisions.filter((d) => d.verdict === "BUY_NOW");
  const watch = decisions.filter((d) => d.verdict === "WATCH");
  const avoid = decisions.filter((d) => d.verdict === "AVOID");
  const scoredById = new Map(scoredSignals.filter((s) => s.id).map((s) => [String(s.id), s]));
  const topThemes = topKeywords(decisions.flatMap((d) => d.catalysts), 8);
  const topRisks = topKeywords(decisions.flatMap((d) => d.riskNotes), 8);
  const placeholderCount = decisions.filter((d) => isPlaceholderText(d.thesisSummary)).length;
  const hybrid = summarizeHybrid(scoredSignals);
  const reportDate = getKstDateStr();

  const lines: string[] = [];
  lines.push(`# 일일 리포트 (${reportDate})`);
  lines.push("");
  lines.push("## 판단 요약");
  lines.push(`- 실행 스코프: ${marketScopeLabel(marketScope)} (${marketScope})`);
  lines.push(`- 총 판단 종목: ${decisions.length}`);
  lines.push(`- 즉시 진입(BUY_NOW): ${buyNow.length}, 관망(WATCH): ${watch.length}, 회피(AVOID): ${avoid.length}`);
  lines.push(`- 평균 신뢰도: ${(avgConfidence(decisions) * 100).toFixed(1)}%`);
  lines.push(`- placeholder 응답 수(stub/tbd): ${placeholderCount}`);
  lines.push("");
  lines.push("## 판단 기준");
  lines.push("- 상위 스코어 시그널만 대상으로 LLM 판단을 수행합니다.");
  lines.push("- 판단 항목: 핵심 근거, 진입 트리거, 무효화 조건, 촉매, 리스크.");
  lines.push("- 결론은 신뢰도(confidence)와 시간축(time_horizon)을 함께 기록합니다.");
  if (hybrid) {
    lines.push("- Hybrid Quant-Social: 퀀트 점수로 soft scoring을 적용하고 하드 필터로 BUY_NOW를 재검증합니다.");
    lines.push(
      `- 하이브리드 요약: quant=${hybrid.avgQuant.toFixed(2)}, social=${hybrid.avgSocial.toFixed(2)}, event=${hybrid.avgEvent.toFixed(2)}, contextRisk=${hybrid.avgContextRisk.toFixed(2)}`
    );
    lines.push(
      `- 강화 조건 통과: hard filter=${hybrid.hardPassCount}/${hybrid.count}, triple crown=${hybrid.triplePassCount}/${hybrid.count}`
    );
  }
  lines.push("");
  lines.push(...formatDecisionSection("BUY_NOW", buyNow, scoredById, marketScope));
  lines.push(...formatDecisionSection("WATCH", watch, scoredById, marketScope));
  lines.push(...formatDecisionSection("AVOID", avoid, scoredById, marketScope));
  lines.push("## 주요 테마");
  lines.push(topThemes.length > 0 ? topThemes.map((item) => `- ${item}`).join("\n") : "- 없음");
  lines.push("");
  lines.push("## 주요 리스크");
  lines.push(topRisks.length > 0 ? topRisks.map((item) => `- ${item}`).join("\n") : "- 없음");

  return {
    reportDate,
    marketScope,
    summaryMarkdown: lines.join("\n"),
    topBuyNow: buyNow.map((d) => d.id || "").filter(Boolean),
    topWatch: watch.map((d) => d.id || "").filter(Boolean),
    themes: topThemes,
    risks: topRisks,
    createdAt: nowIso()
  };
}
