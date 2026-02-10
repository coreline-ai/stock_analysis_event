import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { fetchJson } from "./http";

export async function gatherStockTwits(limit = 15): Promise<SignalRaw[]> {
  const results: SignalRaw[] = [];
  const trending = await fetchJson<any>("https://api.stocktwits.com/api/2/trending/symbols.json", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  const symbols: Array<{ symbol: string }> = trending?.symbols ?? [];

  for (const entry of symbols.slice(0, limit)) {
    const sym = entry.symbol;
    const stream = await fetchJson<any>(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(sym)}.json?limit=30`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9"
        }
      }
    );
    const messages: Array<{ id?: number; entities?: { sentiment?: { basic?: string } }; created_at?: string }> =
      stream?.messages ?? [];

    let bullish = 0;
    let bearish = 0;
    for (const msg of messages) {
      const sentiment = msg.entities?.sentiment?.basic;
      if (sentiment === "Bullish") bullish++;
      if (sentiment === "Bearish") bearish++;
    }
    const total = messages.length || 1;
    const sentimentScore = (bullish - bearish) / total;

    const externalId = `stocktwits_${sym}_${messages[0]?.id ?? messages[0]?.created_at ?? "na"}`;
    results.push({
      source: "stocktwits",
      externalId,
      symbolCandidates: [sym],
      title: `StockTwits trending ${sym}`,
      body: `Bullish ${bullish} / Bearish ${bearish} out of ${messages.length}`,
      url: `https://stocktwits.com/symbol/${encodeURIComponent(sym)}`,
      author: null,
      publishedAt: messages[0]?.created_at ? new Date(messages[0].created_at).toISOString() : null,
      collectedAt: nowIso(),
      engagement: { messages: messages.length },
      rawPayload: {
        sentiment: sentimentScore,
        bullish,
        bearish,
        source_detail: "stocktwits_trending"
      }
    });
  }

  return results;
}
