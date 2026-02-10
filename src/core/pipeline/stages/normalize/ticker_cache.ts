import { withRetry } from "@/core/utils/retry";

let secTickers: Set<string> | null = null;
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function refreshSecTickersIfNeeded(): Promise<void> {
  if (secTickers && Date.now() - lastRefresh < REFRESH_INTERVAL_MS) return;

  const data = await withRetry(
    async () => {
      const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": "mahoraga-research-only" }
      });
      if (!res.ok) throw new Error(`sec_tickers_failed_${res.status}`);
      return (await res.json()) as Record<string, { ticker: string }>;
    },
    { retries: 2, baseDelayMs: 500 }
  ).catch(() => null);

  if (!data) return;
  secTickers = new Set(Object.values(data).map((e) => e.ticker.toUpperCase()));
  lastRefresh = Date.now();
}

export function isKnownSecTicker(symbol: string): boolean {
  if (!secTickers) return true; // if not loaded, do not filter
  return secTickers.has(symbol.toUpperCase());
}
