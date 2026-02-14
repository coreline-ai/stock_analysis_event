import type { Decision, DailyReport, DecisionVerdict, MarketScope, SignalScored } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { lookupKrTickerName } from "../normalize/kr_ticker_cache";
import { lookupSecTickerName } from "../normalize/ticker_cache";
import { horizonLabelKo, marketScopeLabelKo, verdictLabelKo } from "@/core/presentation/terms";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isPlaceholderText(value: string): boolean {
  const text = normalizeText(value);
  return text === "stub" || text === "tbd" || text === "none" || text === "없음";
}

function verdictHeading(verdict: DecisionVerdict): string {
  return verdictLabelKo(verdict);
}

function horizonLabel(value: Decision["timeHorizon"]): string {
  return horizonLabelKo(value);
}

function marketScopeLabel(scope: MarketScope): string {
  return marketScopeLabelKo(scope);
}

function decorateSymbol(symbol: string, scope: MarketScope): string {
  if (scope === "US") {
    const usName = lookupSecTickerName(symbol);
    return usName ? `${symbol} (${usName})` : symbol;
  }
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

function formatEvidence(decision: Decision, scoredById: Map<string, SignalScored>, marketScope: MarketScope): string[] {
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
    const evidenceLabel = decorateSymbol(item.signal.symbol, marketScope);
    lines.push(
      `  - [${evidenceLabel}] score=${item.signal.finalScore.toFixed(3)} ` +
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
      `### ${symbolLabel} (${verdictHeading(verdict)}, 확신도 ${(decision.confidence * 100).toFixed(0)}%, 보유 기간 ${horizonLabel(decision.timeHorizon)})`
    );
    lines.push(`- 핵심 근거: ${decision.thesisSummary}`);
    lines.push(`- 진입 트리거: ${decision.entryTrigger}`);
    lines.push(`- 무효화 조건: ${decision.invalidation}`);
    lines.push(...formatEvidence(decision, scoredById, marketScope));
    lines.push(`- 촉매: ${decision.catalysts.slice(0, 3).join(", ") || "-"}`);
    lines.push(`- 리스크: ${decision.riskNotes.slice(0, 3).join(", ") || "-"}`);
    if (placeholder) {
      lines.push("- 데이터 품질 경고: 요약 문장이 임시값 형태로 생성되었습니다.");
    }
    lines.push("");
  }

  return lines;
}

function getKstDateStr(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
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
  lines.push(`- 즉시 진입: ${buyNow.length}, 관망: ${watch.length}, 회피: ${avoid.length}`);
  lines.push(`- 평균 확신도: ${(avgConfidence(decisions) * 100).toFixed(1)}%`);
  lines.push(`- 임시값 응답 수: ${placeholderCount}`);
  lines.push("");
  lines.push("## 판단 기준");
  lines.push("- 상위 스코어 시그널만 대상으로 LLM 판단을 수행합니다.");
  lines.push("- 판단 항목: 핵심 근거, 진입 트리거, 무효화 조건, 촉매, 리스크.");
  lines.push("- 결론은 확신도(%)와 보유 기간(당일/스윙/중장기)을 함께 기록합니다.");
  if (hybrid) {
    lines.push("- 혼합 점수 방식: 숫자 근거와 시장 반응 신호를 함께 반영합니다.");
    lines.push(
      `- 혼합 요약(0~1): 숫자 근거 ${hybrid.avgQuant.toFixed(2)}, 시장 반응 ${hybrid.avgSocial.toFixed(2)}, 이벤트 ${hybrid.avgEvent.toFixed(2)}, 과열 위험 ${hybrid.avgContextRisk.toFixed(2)}`
    );
    lines.push("- 점수 해석: 0.00~0.35 약함, 0.35~0.70 보통, 0.70~1.00 강함");
    lines.push(
      `- 안전장치 통과: 기본 안전 기준 ${hybrid.hardPassCount}/${hybrid.count}, 3중 확인 ${hybrid.triplePassCount}/${hybrid.count}`
    );
    lines.push("- 기본 안전 기준: 거래량·수급·기술 조건을 모두 만족한 경우");
    lines.push("- 3중 확인: 시장 반응·이벤트·기본 안전 기준을 모두 만족한 경우");
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
