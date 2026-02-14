"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api_client";

function isKrTickerCode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol.trim());
}

function stableCodeKey(codes: string[]): string {
  return codes.slice().sort().join(",");
}

function isUsTickerSymbol(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol.trim().toUpperCase());
}

export function useKrSymbolNameMap(symbols: string[], token: string): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  const codes = useMemo(() => {
    const deduped = new Set<string>();
    for (const symbol of symbols) {
      if (!isKrTickerCode(symbol)) continue;
      deduped.add(symbol.trim());
      if (deduped.size >= 300) break;
    }
    return Array.from(deduped);
  }, [symbols]);

  const codeKey = useMemo(() => stableCodeKey(codes), [codes]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (codes.length === 0) {
        setNames({});
        return;
      }
      const query = encodeURIComponent(codes.join(","));
      const res = await apiRequest<{ names: Record<string, string> }>(`/api/agent/symbols/resolve?codes=${query}`, { token });
      if (cancelled || !res.ok) return;
      setNames(res.data.names ?? {});
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [codeKey, token]);

  return names;
}

export function useUsSymbolNameMap(symbols: string[], token: string): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  const tickers = useMemo(() => {
    const deduped = new Set<string>();
    for (const symbol of symbols) {
      const upper = symbol.trim().toUpperCase();
      if (!isUsTickerSymbol(upper)) continue;
      deduped.add(upper);
      if (deduped.size >= 300) break;
    }
    return Array.from(deduped);
  }, [symbols]);

  const tickerKey = useMemo(() => stableCodeKey(tickers), [tickers]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (tickers.length === 0) {
        setNames({});
        return;
      }
      const query = encodeURIComponent(tickers.join(","));
      const res = await apiRequest<{ names: Record<string, string> }>(`/api/agent/symbols/resolve?symbols=${query}`, { token });
      if (cancelled || !res.ok) return;
      setNames(res.data.names ?? {});
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tickerKey, token]);

  return names;
}

export function formatKrSymbol(symbol: string, names: Record<string, string>): string {
  const trimmed = symbol.trim();
  if (!isKrTickerCode(trimmed)) return symbol;
  const name = names[trimmed];
  return name ? `${trimmed} (${name})` : trimmed;
}

export function formatUsSymbol(symbol: string, names: Record<string, string>): string {
  const upper = symbol.trim().toUpperCase();
  if (!isUsTickerSymbol(upper)) return symbol;
  const name = names[upper];
  return name ? `${upper} (${name})` : upper;
}

export function formatKrSymbolCandidates(candidates: string[], names: Record<string, string>): string {
  return candidates.map((symbol) => formatKrSymbol(symbol, names)).join(", ");
}
