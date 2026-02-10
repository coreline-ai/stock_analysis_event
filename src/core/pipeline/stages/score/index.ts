import { SOURCE_CONFIG } from "@/config/source_config";
import type { SignalScored } from "@/core/domain/types";
import type { NormalizedSignal } from "../normalize";
import { calculateFreshness } from "./freshness";
import { computeSentimentFromMeta, detectSentiment } from "./sentiment";
import { nowIso } from "@/core/utils/time";

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

    const finalScore = sentiment * freshness * sourceWeight;
    scored.push({
      rawId: item.rawId,
      symbol: item.symbol,
      sentimentScore: sentiment,
      freshnessScore: freshness,
      sourceWeight,
      finalScore,
      reasonSummary: `sentiment=${sentiment.toFixed(2)}, fresh=${freshness.toFixed(2)}, weight=${sourceWeight.toFixed(2)}`,
      scoredAt: nowIso()
    });
  }

  return scored;
}
