import type { MarketScope } from "@/core/domain/types";

export type StrategyKey = "us_default" | "kr_default" | "all_default";

const STRATEGY_BY_SCOPE: Record<MarketScope, StrategyKey> = {
  US: "us_default",
  KR: "kr_default",
  ALL: "all_default"
};

const ALLOWED_STRATEGIES = new Set<StrategyKey>(["us_default", "kr_default", "all_default"]);

export function parseMarketScope(input: unknown, fallback: MarketScope = "US"): MarketScope | null {
  if (typeof input !== "string" || input.trim().length === 0) return fallback;
  const normalized = input.trim().toUpperCase();
  if (normalized === "US" || normalized === "KR" || normalized === "ALL") return normalized;
  return null;
}

export function defaultStrategyForScope(scope: MarketScope): StrategyKey {
  return STRATEGY_BY_SCOPE[scope];
}

export function parseStrategyKey(input: unknown, scope: MarketScope): StrategyKey | null {
  if (typeof input !== "string" || input.trim().length === 0) return defaultStrategyForScope(scope);
  const normalized = input.trim() as StrategyKey;
  if (!ALLOWED_STRATEGIES.has(normalized)) return null;
  if (normalized !== STRATEGY_BY_SCOPE[scope]) return null;
  return normalized;
}
