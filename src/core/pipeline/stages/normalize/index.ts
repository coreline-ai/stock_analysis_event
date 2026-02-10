import type { SignalRaw, SignalSource } from "@/core/domain/types";
import { extractTickerCandidates, normalizeSymbol } from "./symbol_map";
import { isKnownSecTicker } from "./ticker_cache";

export interface NormalizedSignal {
  rawId: string;
  source: SignalSource;
  symbol: string;
  text: string;
  publishedAt?: string | null;
  engagement?: Record<string, number> | null;
  metadata?: Record<string, unknown> | null;
}

export function normalizeSignals(rawSignals: SignalRaw[]): NormalizedSignal[] {
  const normalized: NormalizedSignal[] = [];
  const seen = new Set<string>();

  for (const raw of rawSignals) {
    const baseText = `${raw.title ?? ""} ${raw.body ?? ""}`.trim();
    const candidates = raw.symbolCandidates.length > 0 ? raw.symbolCandidates : extractTickerCandidates(baseText);

    for (const candidate of candidates) {
      const symbol = normalizeSymbol(candidate);
      if (!symbol) continue;

      if (raw.source !== "crypto" && !isKnownSecTicker(symbol)) continue;

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
