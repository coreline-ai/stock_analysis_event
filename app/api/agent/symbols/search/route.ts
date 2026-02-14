import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { searchScoredSymbols } from "@/adapters/db/repositories/signals_scored_repo";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";
import { refreshKrTickersIfNeeded, searchKrTickers } from "@/core/pipeline/stages/normalize/kr_ticker_cache";
import { lookupSecTickerName, refreshSecTickersIfNeeded } from "@/core/pipeline/stages/normalize/ticker_cache";
import type { MarketScope } from "@/core/domain/types";

interface SymbolSuggestionItem {
  symbol: string;
  name: string | null;
  display: string;
  marketScope: "US" | "KR";
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; payload: { items: SymbolSuggestionItem[] } }>();

function parseScope(value: string | null): MarketScope {
  if (!value) return "ALL";
  const normalized = value.toUpperCase();
  if (normalized === "US" || normalized === "KR" || normalized === "ALL") return normalized;
  return "ALL";
}

function getFromCache(key: string): { items: SymbolSuggestionItem[] } | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function setCache(key: string, payload: { items: SymbolSuggestionItem[] }): void {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export async function GET(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);

    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!query) {
      return jsonError("invalid_request", 400, "invalid_request");
    }
    const scope = parseScope(req.nextUrl.searchParams.get("scope"));
    const requestedLimit = Number(req.nextUrl.searchParams.get("limit") ?? "8");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 20) : 8;
    const cacheKey = `${scope}:${limit}:${query.toUpperCase()}`;

    const cached = getFromCache(cacheKey);
    if (cached) {
      return jsonOk(cached);
    }

    const items: SymbolSuggestionItem[] = [];
    const seen = new Set<string>();

    if (scope !== "US") {
      await refreshKrTickersIfNeeded();
      for (const row of searchKrTickers(query, limit)) {
        const key = `KR:${row.code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          symbol: row.code,
          name: row.name,
          display: `${row.code} ${row.name}`,
          marketScope: "KR"
        });
        if (items.length >= limit) break;
      }
    }

    if (scope !== "KR" && items.length < limit) {
      await refreshSecTickersIfNeeded();
      const usSymbols = await searchScoredSymbols(query, limit - items.length, "US");
      for (const symbol of usSymbols) {
        const key = `US:${symbol}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const name = lookupSecTickerName(symbol);
        items.push({
          symbol,
          name,
          display: name ? `${symbol} ${name}` : symbol,
          marketScope: "US"
        });
        if (items.length >= limit) break;
      }
    }

    if (items.length === 0) {
      return jsonError("symbol_not_found", 404, "symbol_not_found");
    }

    const payload = { items };
    setCache(cacheKey, payload);
    return jsonOk(payload);
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/symbols/search", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
