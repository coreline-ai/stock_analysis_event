import type { SignalScored, Decision } from "@/core/domain/types";
import { LIMITS, type PipelineLimits } from "@/config/limits";
import { buildDecisionPrompt } from "./prompts";
import { DecisionOutputSchema } from "./schema";
import { createLLMProviderFromEnv } from "@/adapters/llm/factory";
import type { LLMProvider } from "@/adapters/llm/provider";
import { nowIso } from "@/core/utils/time";
import type { MarketScope } from "@/core/domain/types";

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("invalid_json_response");
  }
  return text.slice(start, end + 1);
}

function summarizeGroupQuant(group: SignalScored[]): {
  hasQuantSignals: boolean;
  avgQuantScore: number;
  avgSocialScore: number;
  avgEventScore: number;
  avgVolumeScore: number;
  avgFlowScore: number;
  avgTechnicalScore: number;
  avgContextRiskScore: number;
  socialLayerPassed: boolean;
  eventLayerPassed: boolean;
  volumeGuardPassed: boolean;
  flowGuardPassed: boolean;
  technicalGuardPassed: boolean;
  tripleCrownPassed: boolean;
  hardFilterPassed: boolean;
} {
  const quantSignals = group.filter((item) => typeof item.quantScore === "number");
  const socialSignals = group.filter((item) => typeof item.socialScore === "number");
  const eventSignals = group.filter((item) => typeof item.eventScore === "number");
  const volumeSignals = group.filter((item) => typeof item.volumeScore === "number");
  const flowSignals = group.filter((item) => typeof item.flowScore === "number");
  const technicalSignals = group.filter((item) => typeof item.technicalScore === "number");
  const contextRiskSignals = group.filter((item) => typeof item.contextRiskScore === "number");
  const hardSignals = group.filter((item) => typeof item.hardFilterPassed === "boolean");
  const socialLayerSignals = group.filter((item) => typeof item.socialLayerPassed === "boolean");
  const eventLayerSignals = group.filter((item) => typeof item.eventLayerPassed === "boolean");
  const volumeGuardSignals = group.filter((item) => typeof item.volumeGuardPassed === "boolean");
  const flowGuardSignals = group.filter((item) => typeof item.flowGuardPassed === "boolean");
  const technicalGuardSignals = group.filter((item) => typeof item.technicalGuardPassed === "boolean");
  const tripleSignals = group.filter((item) => typeof item.tripleCrownPassed === "boolean");

  const avg = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  };

  const passRatio = (signals: SignalScored[], key: keyof SignalScored): number => {
    if (signals.length === 0) return 1;
    const passed = signals.filter((item) => item[key] === true).length;
    return passed / signals.length;
  };

  return {
    hasQuantSignals: quantSignals.length > 0 || hardSignals.length > 0,
    avgQuantScore: avg(quantSignals.map((item) => item.quantScore ?? 0)),
    avgSocialScore: avg(socialSignals.map((item) => item.socialScore ?? 0)),
    avgEventScore: avg(eventSignals.map((item) => item.eventScore ?? 0)),
    avgVolumeScore: avg(volumeSignals.map((item) => item.volumeScore ?? 0)),
    avgFlowScore: avg(flowSignals.map((item) => item.flowScore ?? 0)),
    avgTechnicalScore: avg(technicalSignals.map((item) => item.technicalScore ?? 0)),
    avgContextRiskScore: avg(contextRiskSignals.map((item) => item.contextRiskScore ?? 0)),
    socialLayerPassed: passRatio(socialLayerSignals, "socialLayerPassed") >= 0.5,
    eventLayerPassed: passRatio(eventLayerSignals, "eventLayerPassed") >= 0.5,
    volumeGuardPassed: passRatio(volumeGuardSignals, "volumeGuardPassed") >= 0.5,
    flowGuardPassed: passRatio(flowGuardSignals, "flowGuardPassed") >= 0.5,
    technicalGuardPassed: passRatio(technicalGuardSignals, "technicalGuardPassed") >= 0.5,
    tripleCrownPassed: passRatio(tripleSignals, "tripleCrownPassed") >= 0.5,
    hardFilterPassed: passRatio(hardSignals, "hardFilterPassed") >= 0.5
  };
}

export async function decideSignals(
  scoredSignals: SignalScored[],
  provider?: LLMProvider,
  deadlineMs?: number,
  opts?: { marketScope?: MarketScope; limits?: PipelineLimits }
): Promise<Decision[]> {
  const limits = opts?.limits ?? LIMITS;
  const marketScope = opts?.marketScope ?? "US";
  const llm = provider ?? createLLMProviderFromEnv();

  const sorted = scoredSignals
    .slice()
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, Math.min(limits.decideTopN, limits.llmMaxSignalsPerRun));

  const grouped = new Map<string, SignalScored[]>();
  for (const sig of sorted) {
    if (!grouped.has(sig.symbol)) grouped.set(sig.symbol, []);
    grouped.get(sig.symbol)!.push(sig);
  }

  const decisions: Decision[] = [];
  let calls = 0;

  for (const [symbol, group] of grouped) {
    if (calls >= limits.llmMaxCallsPerRun) break;
    if (deadlineMs && Date.now() > deadlineMs) break;

    const quant = summarizeGroupQuant(group);
    const signalLines = group
      .slice(0, 5)
      .map((g) => `score=${g.finalScore.toFixed(3)} ${g.reasonSummary ?? ""}`)
      .join("\n");
    const summary = [
      signalLines,
      `정량 종합 점수 평균=${quant.avgQuantScore.toFixed(2)}`,
      `소셜 반응 점수 평균=${quant.avgSocialScore.toFixed(2)}`,
      `이벤트 신호 점수 평균=${quant.avgEventScore.toFixed(2)}`,
      `거래량 점수 평균=${quant.avgVolumeScore.toFixed(2)}`,
      `수급 점수 평균=${quant.avgFlowScore.toFixed(2)}`,
      `기술 신호 점수 평균=${quant.avgTechnicalScore.toFixed(2)}`,
      `과열/맥락 리스크 평균=${quant.avgContextRiskScore.toFixed(2)}`,
      `소셜 레이어=${quant.socialLayerPassed ? "통과" : "미통과"}`,
      `이벤트 레이어=${quant.eventLayerPassed ? "통과" : "미통과"}`,
      `거래량 가드=${quant.volumeGuardPassed ? "통과" : "미통과"}`,
      `수급 가드=${quant.flowGuardPassed ? "통과" : "미통과"}`,
      `기술 가드=${quant.technicalGuardPassed ? "통과" : "미통과"}`,
      `강화 하드 필터=${quant.hardFilterPassed ? "통과" : "미통과"}`,
      `삼관왕 조건=${quant.tripleCrownPassed ? "통과" : "미통과"}`
    ].join("\n");

    const prompt = buildDecisionPrompt({ symbol, signalSummary: summary, marketScope });
    let parsed: ReturnType<typeof DecisionOutputSchema.parse> | null = null;
    let attempts = 0;

    while (attempts < 2 && !parsed) {
      if (deadlineMs && Date.now() > deadlineMs) break;
      const raw = await llm.complete({
        system: prompt.system,
        user: prompt.user,
        maxTokens: limits.llmMaxTokensPerCall,
        model: process.env.LLM_MODEL || process.env.GLM_MODEL || "gpt-4o-mini"
      });
      attempts += 1;
      calls += 1;

      try {
        parsed = DecisionOutputSchema.parse(JSON.parse(extractJson(raw)));
      } catch {
        parsed = null;
      }
    }

    if (!parsed) continue;

    const createdAt = nowIso();

    const buyNowRequested = parsed.verdict === "BUY_NOW";
    const failedReasons: string[] = [];
    if (quant.hasQuantSignals && buyNowRequested) {
      if (!quant.hardFilterPassed) failedReasons.push("기본 안전 기준 미충족(거래량·수급·기술)");
      if (!quant.socialLayerPassed) failedReasons.push("시장 반응 기준 미충족(점수 0.70 미만)");
      if (!quant.eventLayerPassed) failedReasons.push("이벤트 기준 미충족(공시/뉴스 촉매 부족)");
      if (!quant.volumeGuardPassed) failedReasons.push("거래량 기준 미충족(급증 신호 부족)");
      if (!quant.flowGuardPassed) failedReasons.push("수급 기준 미충족(외국인/기관 순매수 부족)");
      if (!quant.technicalGuardPassed) failedReasons.push("기술 기준 미충족(이평선 조건 부족)");
      if (quant.avgContextRiskScore >= 0.8) failedReasons.push("과열 위험 높음(52주 고점 근접/과열 신호)");
    }

    const downgradedByHybridGate = buyNowRequested && failedReasons.length > 0;
    const riskNotes = downgradedByHybridGate
      ? Array.from(new Set([...parsed.risk_notes, ...failedReasons]))
      : parsed.risk_notes;
    const redFlags = downgradedByHybridGate
      ? Array.from(new Set([...parsed.red_flags, "안전 기준 미통과로 즉시 진입이 관망으로 조정됨"]))
      : parsed.red_flags;

    decisions.push({
      symbol,
      verdict: downgradedByHybridGate ? "WATCH" : parsed.verdict,
      confidence: downgradedByHybridGate ? Math.min(parsed.confidence, 0.59) : parsed.confidence,
      timeHorizon: parsed.time_horizon,
      thesisSummary: downgradedByHybridGate
        ? `${parsed.thesis_summary} (핵심 안전 기준 미충족으로 관망으로 조정)`
        : parsed.thesis_summary,
      entryTrigger: downgradedByHybridGate
        ? `핵심 3중 확인(시장 반응/이벤트/거래량·수급·기술) 충족 시 재검토. ${parsed.entry_trigger}`
        : parsed.entry_trigger,
      invalidation: parsed.invalidation,
      riskNotes,
      bullCase: parsed.bull_case,
      bearCase: parsed.bear_case,
      redFlags,
      catalysts: parsed.catalysts,
      sourcesUsed: group.map((g) => g.id || "").filter(Boolean),
      llmModel: process.env.LLM_MODEL || process.env.GLM_MODEL || "gpt-4o-mini",
      promptVersion: "v2_hybrid_quant_social",
      schemaVersion: "v1",
      createdAt
    });
  }

  return decisions;
}
