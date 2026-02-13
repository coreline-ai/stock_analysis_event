"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "./api_client";

export interface SymbolSuggestion {
  symbol: string;
  name: string | null;
  display: string;
  marketScope: "US" | "KR";
}

interface SymbolSearchResponse {
  items: SymbolSuggestion[];
}

interface UseSymbolSuggestionsInput {
  query: string;
  scope: string;
  token: string;
  enabled?: boolean;
}

export function useSymbolSuggestions(input: UseSymbolSuggestionsInput) {
  const [items, setItems] = useState<SymbolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!input.enabled || input.scope !== "KR") {
      setItems([]);
      setLoading(false);
      return;
    }
    const trimmed = input.query.trim();
    if (trimmed.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const res = await apiRequest<SymbolSearchResponse>(
        `/api/agent/symbols/search?q=${encodeURIComponent(trimmed)}&scope=KR&limit=8`,
        { token: input.token }
      );
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setItems([]);
        return;
      }
      setItems(res.data.items ?? []);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [input.query, input.scope, input.token, input.enabled]);

  return { items, loading };
}

export function useAllSymbolSuggestions(input: UseSymbolSuggestionsInput) {
  const [items, setItems] = useState<SymbolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!input.enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    const trimmed = input.query.trim();
    if (trimmed.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const res = await apiRequest<SymbolSearchResponse>(
        `/api/agent/symbols/search?q=${encodeURIComponent(trimmed)}&scope=${encodeURIComponent(input.scope)}&limit=10`,
        { token: input.token }
      );
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setItems([]);
        return;
      }
      setItems(res.data.items ?? []);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [input.query, input.scope, input.token, input.enabled]);

  return { items, loading };
}
