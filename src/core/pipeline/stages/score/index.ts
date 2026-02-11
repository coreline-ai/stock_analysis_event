import { SOURCE_CONFIG } from "@/config/source_config";
import type { SignalScored } from "@/core/domain/types";
import type { NormalizedSignal } from "../normalize";
import { calculateFreshness } from "./freshness";
import { computeSentimentFromMeta, detectSentiment } from "./sentiment";
import { nowIso } from "@/core/utils/time";
import { analyzeKrQuantSignal } from "./quant_kr";

function isKrSignal(item: NormalizedSignal): boolean {
  return /^\d{6}$/.test(item.symbol) || item.metadata?.market_scope === "KR";
}

function resolveSourceWeight(source: string, meta?: Record<string, unknown> | null): number {
  if (source === "reddit" && meta?.subreddit && typeof meta.subreddit === "string") {
    const key = `reddit_${meta.subreddit}` as keyof typeof SOURCE_CONFIG.weights;
    return SOURCE_CONFIG.weights[key] ?? 0.7;
  }
  if (source === "sec" && meta?.form && typeof meta.form === "string") {
    const formKey = meta.form.toLowerCase() === "8-k" ? "sec_8k" : "sec_4";
    const key = formKey as keyof typeof SOURCE_CONFIG.weights;
    return SOURCE_CONFIG.weights[key] ?? 0.7;
  }
  const key = source as keyof typeof SOURCE_CONFIG.weights;
  return SOURCE_CONFIG.weights[key] ?? 0.7;
}

export function scoreSignals(normalized: NormalizedSignal[]): SignalScored[] {
  const scored: SignalScored[] = [];

  for (const item of normalized) {
    const sentimentFromMeta = computeSentimentFromMeta(item.metadata);
    const sentiment = sentimentFromMeta ?? detectSentiment(item.text);
    const freshness = calculateFreshness(item.publishedAt);
    const sourceWeight = resolveSourceWeight(item.source, item.metadata);
    const baseScore = sentiment * freshness * sourceWeight;
    const quant = isKrSignal(item) ? analyzeKrQuantSignal(item, sentiment) : null;
    const quantMultiplier = quant?.quantMultiplier ?? 1;
    const finalScore = baseScore * quantMultiplier;
    const reasonParts = [
      `감성=${sentiment.toFixed(2)}`,
      `신선도=${freshness.toFixed(2)}`,
      `가중치=${sourceWeight.toFixed(2)}`
    ];
    if (quant) {
      reasonParts.push(
        `소셜=${quant.socialScore.toFixed(2)}`,
        `이벤트=${quant.eventScore.toFixed(2)}`,
        `거래량=${quant.volumeScore.toFixed(2)}`,
        `수급=${quant.flowScore.toFixed(2)}`,
        `기술=${quant.technicalScore.toFixed(2)}`,
        `퀀트=${quant.quantScore.toFixed(2)}`,
        `리스크=${quant.contextRiskScore.toFixed(2)}`,
        `승수=${quant.quantMultiplier.toFixed(2)}`,
        `하드필터=${quant.hardFilterPassed ? "통과" : "실패"}`,
        `삼관왕=${quant.tripleCrownPassed ? "통과" : "실패"}`
      );
    }

    scored.push({
      rawId: item.rawId,
      symbol: item.symbol,
      sentimentScore: sentiment,
      freshnessScore: freshness,
      sourceWeight,
      finalScore,
      socialScore: quant?.socialScore,
      eventScore: quant?.eventScore,
      volumeScore: quant?.volumeScore,
      flowScore: quant?.flowScore,
      technicalScore: quant?.technicalScore,
      quantScore: quant?.quantScore,
      contextRiskScore: quant?.contextRiskScore,
      quantMultiplier: quant?.quantMultiplier,
      socialLayerPassed: quant?.socialLayerPassed,
      eventLayerPassed: quant?.eventLayerPassed,
      volumeGuardPassed: quant?.volumeGuardPassed,
      flowGuardPassed: quant?.flowGuardPassed,
      technicalGuardPassed: quant?.technicalGuardPassed,
      tripleCrownPassed: quant?.tripleCrownPassed,
      hardFilterPassed: quant?.hardFilterPassed,
      reasonSummary: reasonParts.join(", "),
      scoredAt: nowIso()
    });
  }

  return scored;
}
