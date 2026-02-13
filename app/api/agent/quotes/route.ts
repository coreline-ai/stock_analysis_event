import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";

interface QuoteItem {
  symbol: string;
  marketScope: "US" | "KR";
  price: number;
  currency: "USD" | "KRW";
  asOf: string;
  source: "stooq" | "naver";
}

const CACHE_TTL_MS = 45 * 1000;
const quoteCache = new Map<string, { expiresAt: number; item: QuoteItem | null }>();

function parseSymbols(raw: string | null): string[] {
  if (!raw) return [];
  const deduped = new Set<string>();
  for (const token of raw.split(",")) {
    const value = token.trim().toUpperCase();
    if (!value) continue;
    deduped.add(value);
    if (deduped.size >= 20) break;
  }
  return Array.from(deduped);
}

function inferScope(symbol: string): "US" | "KR" {
  if (/^\d{6}$/.test(symbol)) return "KR";
  return "US";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "N/D") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseStooqAsOf(date: string, time: string): string {
  if (/^\d{8}$/.test(date) && /^\d{6}$/.test(time)) {
    const y = date.slice(0, 4);
    const m = date.slice(4, 6);
    const d = date.slice(6, 8);
    const hh = time.slice(0, 2);
    const mm = time.slice(2, 4);
    const ss = time.slice(4, 6);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  }
  return new Date().toISOString();
}

async function fetchUsQuote(symbol: string): Promise<QuoteItem | null> {
  const stooqSymbol = `${symbol.toLowerCase()}.us`;
  const res = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`, {
    cache: "no-store"
  });
  if (!res.ok) return null;
  const csv = (await res.text()).trim();
  const cols = csv.split(",");
  if (cols.length < 7) return null;
  const price = parseNumber(cols[6]);
  if (price === null) return null;
  return {
    symbol,
    marketScope: "US",
    price,
    currency: "USD",
    asOf: parseStooqAsOf(cols[1] ?? "", cols[2] ?? ""),
    source: "stooq"
  };
}

async function fetchKrQuote(symbol: string): Promise<QuoteItem | null> {
  const res = await fetch(
    `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${encodeURIComponent(symbol)}|SERVICE_RECENT_ITEM:${encodeURIComponent(symbol)}`,
    {
      cache: "no-store",
      headers: {
        "user-agent": "stock-analysis-event/1.0"
      }
    }
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    result?: {
      areas?: Array<{ datas?: Array<Record<string, unknown>> }>;
    };
  };
  const areas = payload.result?.areas ?? [];
  for (const area of areas) {
    const rows = area.datas ?? [];
    for (const row of rows) {
      if ((row.cd as string | undefined)?.trim() !== symbol) continue;
      const price = parseNumber(row.nv);
      if (price === null) return null;
      const asOf =
        (row.nxtOverMarketPriceInfo as { localTradedAt?: string } | undefined)?.localTradedAt ?? new Date().toISOString();
      return {
        symbol,
        marketScope: "KR",
        price,
        currency: "KRW",
        asOf,
        source: "naver"
      };
    }
  }
  return null;
}

async function fetchQuote(symbol: string): Promise<QuoteItem | null> {
  return inferScope(symbol) === "KR" ? fetchKrQuote(symbol) : fetchUsQuote(symbol);
}

async function fetchQuoteWithCache(symbol: string): Promise<QuoteItem | null> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() <= cached.expiresAt) {
    return cached.item;
  }
  const item = await fetchQuote(symbol);
  quoteCache.set(symbol, { expiresAt: Date.now() + CACHE_TTL_MS, item });
  if (quoteCache.size > 200) {
    const oldest = quoteCache.keys().next().value;
    if (oldest) quoteCache.delete(oldest);
  }
  return item;
}

export async function GET(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);

    const symbols = parseSymbols(req.nextUrl.searchParams.get("symbols"));
    if (symbols.length === 0) {
      return jsonError("invalid_request", 400, "invalid_request");
    }

    const results = await Promise.all(symbols.map((symbol) => fetchQuoteWithCache(symbol)));
    const items: QuoteItem[] = [];
    const unavailable: string[] = [];

    for (let idx = 0; idx < symbols.length; idx += 1) {
      const symbol = symbols[idx]!;
      const quote = results[idx];
      if (quote) items.push(quote);
      else unavailable.push(symbol);
    }

    if (items.length === 0) {
      return jsonError("quote_unavailable", 503, "quote_unavailable");
    }
    return jsonOk({ items, unavailable });
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/quotes", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
