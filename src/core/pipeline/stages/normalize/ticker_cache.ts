import { withRetry } from "@/core/utils/retry";

let secTickers: Set<string> | null = null;
let secNameEntries: Array<{ alias: string; ticker: string }> | null = null;
let secTickerToName: Map<string, string> | null = null;
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function normalizeSecName(input: string): string {
  return input
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCompanySuffix(input: string): string {
  return input
    .replace(
      /\b(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|HOLDINGS|HOLDING|LIMITED|LTD|PLC|GROUP)\b\.?$/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function buildCompanyAliases(title: string): string[] {
  const normalized = normalizeSecName(title);
  if (!normalized) return [];
  const stripped = stripCompanySuffix(normalized);
  const aliases = new Set<string>();
  aliases.add(normalized);
  if (stripped && stripped !== normalized) aliases.add(stripped);
  return Array.from(aliases).filter((alias) => alias.length >= 6);
}

export async function refreshSecTickersIfNeeded(): Promise<void> {
  if (secTickers && Date.now() - lastRefresh < REFRESH_INTERVAL_MS) return;

  const data = await withRetry(
    async () => {
      const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": "deepstock-research-only" }
      });
      if (!res.ok) throw new Error(`sec_tickers_failed_${res.status}`);
      return (await res.json()) as Record<string, { ticker: string; title?: string }>;
    },
    { retries: 2, baseDelayMs: 500 }
  ).catch(() => null);

  if (!data) return;
  const entries = Object.values(data);
  secTickers = new Set(entries.map((e) => e.ticker.toUpperCase()));
  secTickerToName = new Map<string, string>();
  const aliasMap = new Map<string, string>();
  for (const entry of entries) {
    const ticker = entry.ticker?.toUpperCase();
    const title = entry.title ?? "";
    if (!ticker || !title) continue;
    secTickerToName.set(ticker, title);
    for (const alias of buildCompanyAliases(title)) {
      if (!aliasMap.has(alias)) aliasMap.set(alias, ticker);
    }
  }
  secNameEntries = Array.from(aliasMap.entries())
    .map(([alias, ticker]) => ({ alias, ticker }))
    .sort((a, b) => b.alias.length - a.alias.length);
  lastRefresh = Date.now();
}

export function isKnownSecTicker(symbol: string): boolean {
  if (!secTickers) return true; // if not loaded, do not filter
  return secTickers.has(symbol.toUpperCase());
}

export function extractSecTickerCandidatesByName(text: string, limit = 3): string[] {
  if (!secNameEntries || secNameEntries.length === 0) return [];
  const normalized = normalizeSecName(text);
  if (!normalized) return [];
  const matches = new Set<string>();
  for (const entry of secNameEntries) {
    if (!normalized.includes(entry.alias)) continue;
    matches.add(entry.ticker);
    if (matches.size >= limit) break;
  }
  return Array.from(matches);
}

export function lookupSecTickerName(symbol: string): string | null {
  if (!secTickerToName) return null;
  return secTickerToName.get(symbol.toUpperCase()) ?? null;
}
