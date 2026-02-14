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

function toUnitSentiment(sentiment: number): number {
  return Math.max(0, Math.min(1, (sentiment + 1) / 2));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1.5, score));
}

function countHits(text: string, keywords: string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) count += 1;
  }
  return count;
}

function computeUsEventScore(item: NormalizedSignal, text: string): number {
  const sourceBoost =
    item.source === "sec"
      ? 0.7
      : item.source === "news"
        ? 0.45
        : item.source === "stocktwits"
          ? 0.2
          : item.source === "reddit"
            ? 0.15
            : 0.1;
  const catalystHits = countHits(text, [
    "earnings",
    "guidance",
    "revenue",
    "eps",
    "upgrade",
    "downgrade",
    "target price",
    "merger",
    "acquisition",
    "buyback",
    "dividend",
    "contract",
    "approval"
  ]);
  const filingHits = countHits(text, ["8-k", "10-q", "10-k", "sec filing", "form 4", "insider"]);
  return clamp01(sourceBoost + Math.min(0.3, catalystHits * 0.08) + Math.min(0.25, filingHits * 0.12));
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
    let finalScore = baseScore * quantMultiplier;
    let usEventScore: number | null = null;
    if (quant) {
      const sentimentUnit = toUnitSentiment(sentiment);
      const hybridEvidence = sentimentUnit * 0.4 + quant.quantScore * 0.6;
      const gateBoost = quant.hardFilterPassed ? 1.08 : 0.94;
      finalScore = clampScore(hybridEvidence * freshness * sourceWeight * quantMultiplier * gateBoost);
    } else {
      const sentimentUnit = toUnitSentiment(sentiment);
      usEventScore = computeUsEventScore(item, item.text.toLowerCase());
      const usEvidence = sentimentUnit * 0.35 + usEventScore * 0.65;
      finalScore = clampScore(usEvidence * freshness * sourceWeight);
    }
    const reasonParts = [
      `감성=${sentiment.toFixed(2)}`,
      `신선도=${freshness.toFixed(2)}`,
      `가중치=${sourceWeight.toFixed(2)}`
    ];
    if (quant) {
      reasonParts.push(
        `시장반응=${quant.socialScore.toFixed(2)}`,
        `이벤트=${quant.eventScore.toFixed(2)}`,
        `거래량=${quant.volumeScore.toFixed(2)}`,
        `수급=${quant.flowScore.toFixed(2)}`,
        `기술=${quant.technicalScore.toFixed(2)}`,
        `숫자근거=${quant.quantScore.toFixed(2)}`,
        `과열위험=${quant.contextRiskScore.toFixed(2)}`,
        `보정계수=${quant.quantMultiplier.toFixed(2)}`,
        `증거점수=${(toUnitSentiment(sentiment) * 0.4 + quant.quantScore * 0.6).toFixed(2)}`,
        `기본안전=${quant.hardFilterPassed ? "통과" : "미통과"}`,
        `3중확인=${quant.tripleCrownPassed ? "통과" : "미통과"}`
      );
    } else if (usEventScore !== null) {
      const sentimentUnit = toUnitSentiment(sentiment);
      reasonParts.push(`미국이벤트=${usEventScore.toFixed(2)}`, `증거점수=${(sentimentUnit * 0.35 + usEventScore * 0.65).toFixed(2)}`);
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
