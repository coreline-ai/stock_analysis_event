import type { SignalRaw } from "@/core/domain/types";
import { getBooleanEnv, getEnv } from "@/config/runtime";
import { nowIso } from "@/core/utils/time";
import { fetchJson } from "./http";

const COINGECKO_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana"
};

export async function gatherCrypto(): Promise<SignalRaw[]> {
  const enabled = getBooleanEnv("CRYPTO_ENABLED", false);
  if (!enabled) return [];

  const symbols = (getEnv("CRYPTO_SYMBOLS", "BTC,ETH,SOL") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const ids = symbols.map((s) => COINGECKO_MAP[s]).filter(Boolean);
  if (ids.length === 0) return [];

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const data = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(url);
  if (!data) return [];

  const results: SignalRaw[] = [];
  const dateKey = new Date().toISOString().slice(0, 10);
  for (const symbol of symbols) {
    const id = COINGECKO_MAP[symbol];
    if (!id) continue;
    const entry = data[id];
    if (!entry) continue;

    results.push({
      source: "crypto",
      externalId: `crypto_${symbol}_${dateKey}`,
      symbolCandidates: [symbol],
      title: `Crypto ${symbol} 24h change`,
      body: `24h change: ${entry.usd_24h_change?.toFixed(2) ?? "0"}%`,
      url: null,
      author: null,
      publishedAt: new Date().toISOString(),
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: {
        price: entry.usd ?? null,
        momentum: entry.usd_24h_change ?? 0,
        sentiment: (entry.usd_24h_change ?? 0) / 100
      }
    });
  }

  return results;
}
