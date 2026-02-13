"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api_client";

function isKrTickerCode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol.trim());
}

function stableCodeKey(codes: string[]): string {
  return codes.slice().sort().join(",");
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

export function formatKrSymbol(symbol: string, names: Record<string, string>): string {
  const trimmed = symbol.trim();
  if (!isKrTickerCode(trimmed)) return symbol;
  const name = names[trimmed];
  return name ? `${trimmed} (${name})` : trimmed;
}

export function formatKrSymbolCandidates(candidates: string[], names: Record<string, string>): string {
  return candidates.map((symbol) => formatKrSymbol(symbol, names)).join(", ");
}

