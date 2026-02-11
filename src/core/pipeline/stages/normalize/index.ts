import type { SignalRaw, SignalSource } from "@/core/domain/types";
import { extractKrTickerCandidates, extractTickerCandidates, normalizeKrSymbol, normalizeSymbol } from "./symbol_map";
import { isKnownSecTicker } from "./ticker_cache";
import { extractKrTickerCandidatesByName, hasKrTickerUniverse, isKnownKrxTicker } from "./kr_ticker_cache";

export interface NormalizedSignal {
  rawId: string;
  source: SignalSource;
  symbol: string;
  text: string;
  publishedAt?: string | null;
  engagement?: Record<string, number> | null;
  metadata?: Record<string, unknown> | null;
}

const KR_SOURCES = new Set<SignalSource>([
  "naver",
  "dart",
  "kr_community",
  "kr_news",
  "kr_research",
  "kr_global_context"
]);

export function normalizeSignals(rawSignals: SignalRaw[]): NormalizedSignal[] {
  const normalized: NormalizedSignal[] = [];
  const seen = new Set<string>();

  for (const raw of rawSignals) {
    const baseText = `${raw.title ?? ""} ${raw.body ?? ""}`.trim();
    const fallbackCandidates = KR_SOURCES.has(raw.source)
      ? [
          ...extractKrTickerCandidates(baseText),
          ...extractKrTickerCandidatesByName(baseText),
          ...extractTickerCandidates(baseText)
        ]
      : extractTickerCandidates(baseText);
    const candidates =
      raw.symbolCandidates.length > 0
        ? Array.from(new Set([...raw.symbolCandidates, ...fallbackCandidates]))
        : fallbackCandidates;
    const isKrSource = KR_SOURCES.has(raw.source);

    for (const candidate of candidates) {
      const symbol = isKrSource ? normalizeKrSymbol(candidate) : normalizeSymbol(candidate);
      if (!symbol) continue;

      if (isKrSource && hasKrTickerUniverse() && !isKnownKrxTicker(symbol)) continue;
      if (!isKrSource && raw.source !== "crypto" && !isKnownSecTicker(symbol)) continue;

      const key = `${raw.id || ""}:${symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);

      normalized.push({
        rawId: raw.id || "",
        source: raw.source,
        symbol,
        text: baseText,
        publishedAt: raw.publishedAt ?? null,
        engagement: raw.engagement ?? null,
        metadata: raw.rawPayload ?? null
      });
    }
  }

  return normalized;
}
