import { getNumberEnv } from "@/config/runtime";
import type { NormalizedSignal } from ".";

interface KrQuoteSnapshot {
  volumeRatio?: number;
  priceAboveMa5?: 0 | 1;
  priceAboveMa20?: 0 | 1;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

const DEFAULT_KR_QUOTE_FETCH_TIMEOUT_MS = 4000;
const DEFAULT_KR_QUOTE_ENRICH_MAX_SYMBOLS = 40;
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;

const quoteCache = new Map<string, { expiresAt: number; snapshot: KrQuoteSnapshot | null }>();

function clampRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.min(6, value));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((acc, value) => acc + value, 0);
  return total / values.length;
}

function finiteSeries(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function computeKrQuoteSnapshot(closes: Array<number | null | undefined>, volumes: Array<number | null | undefined>): KrQuoteSnapshot | null {
  const closeSeries = finiteSeries(closes);
  const volumeSeries = finiteSeries(volumes);
  if (closeSeries.length < 5 || volumeSeries.length < 2) return null;

  const latestClose = closeSeries[closeSeries.length - 1];
  const ma5 = mean(closeSeries.slice(-5));
  const ma20 = mean(closeSeries.slice(-20));

  const latestVolume = volumeSeries[volumeSeries.length - 1];
  const volumeBase = mean(volumeSeries.slice(-21, -1));

  const snapshot: KrQuoteSnapshot = {};
  if (typeof latestClose === "number" && typeof ma5 === "number") {
    snapshot.priceAboveMa5 = latestClose >= ma5 ? 1 : 0;
  }
  if (typeof latestClose === "number" && typeof ma20 === "number") {
    snapshot.priceAboveMa20 = latestClose >= ma20 ? 1 : 0;
  }
  if (typeof latestVolume === "number" && typeof volumeBase === "number" && volumeBase > 0) {
    snapshot.volumeRatio = clampRatio(latestVolume / volumeBase);
  }

  if (
    snapshot.volumeRatio === undefined &&
    snapshot.priceAboveMa5 === undefined &&
    snapshot.priceAboveMa20 === undefined
  ) {
    return null;
  }
  return snapshot;
}

function mergeSnapshot(base: Record<string, unknown> | null | undefined, snapshot: KrQuoteSnapshot): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(base ?? {}) };
  if (next["volume_ratio"] === undefined && typeof snapshot.volumeRatio === "number") {
    next["volume_ratio"] = snapshot.volumeRatio;
  }
  if (next["price_above_ma5"] === undefined && typeof snapshot.priceAboveMa5 === "number") {
    next["price_above_ma5"] = snapshot.priceAboveMa5;
  }
  if (next["price_above_ma20"] === undefined && typeof snapshot.priceAboveMa20 === "number") {
    next["price_above_ma20"] = snapshot.priceAboveMa20;
  }
  return next;
}

function buildYahooTickers(symbol: string): string[] {
  return [`${symbol}.KS`, `${symbol}.KQ`];
}

async function fetchYahooChart(ticker: string, timeoutMs: number): Promise<YahooChartResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2mo&interval=1d`;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (deepstock-quote-enrichment)"
      }
    });
    if (!res.ok) return null;
    return (await res.json()) as YahooChartResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchKrQuoteSnapshot(symbol: string): Promise<KrQuoteSnapshot | null> {
  const timeoutMs = Math.max(1000, getNumberEnv("KR_QUOTE_FETCH_TIMEOUT_MS", DEFAULT_KR_QUOTE_FETCH_TIMEOUT_MS));
  for (const ticker of buildYahooTickers(symbol)) {
    const data = await fetchYahooChart(ticker, timeoutMs);
    const result = data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!quote) continue;
    const snapshot = computeKrQuoteSnapshot(quote.close ?? [], quote.volume ?? []);
    if (snapshot) return snapshot;
  }
  return null;
}

async function resolveSnapshot(symbol: string): Promise<KrQuoteSnapshot | null> {
  const cached = quoteCache.get(symbol);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.snapshot;

  const snapshot = await fetchKrQuoteSnapshot(symbol);
  quoteCache.set(symbol, { snapshot, expiresAt: now + QUOTE_CACHE_TTL_MS });
  return snapshot;
}

function isKrSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

export async function enrichKrNormalizedSignals(signals: NormalizedSignal[], deadlineMs?: number): Promise<NormalizedSignal[]> {
  const maxSymbols = Math.max(1, getNumberEnv("KR_QUOTE_ENRICH_MAX_SYMBOLS", DEFAULT_KR_QUOTE_ENRICH_MAX_SYMBOLS));
  const symbols = Array.from(new Set(signals.map((item) => item.symbol).filter((symbol) => isKrSymbol(symbol)))).slice(0, maxSymbols);

  const snapshots = new Map<string, KrQuoteSnapshot>();
  for (const symbol of symbols) {
    if (deadlineMs && Date.now() > deadlineMs) break;
    const snapshot = await resolveSnapshot(symbol);
    if (snapshot) snapshots.set(symbol, snapshot);
  }

  if (snapshots.size === 0) return signals;

  for (const item of signals) {
    const snapshot = snapshots.get(item.symbol);
    if (!snapshot) continue;
    item.metadata = mergeSnapshot(item.metadata, snapshot);
  }
  return signals;
}
