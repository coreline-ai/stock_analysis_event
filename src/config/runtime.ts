export const FORBIDDEN_ENV_KEYS = [
  "ALPACA_API_KEY",
  "ALPACA_API_SECRET",
  "BROKER_MODE",
  "TRADING_ENABLED"
] as const;

export function assertNoForbiddenEnv(): void {
  const present = FORBIDDEN_ENV_KEYS.filter((k) => Boolean(process.env[k]));
  if (present.length > 0) {
    throw new Error(`Forbidden env detected: ${present.join(", ")}`);
  }
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

export function getEnv(key: string, fallback?: string): string | undefined {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  return value;
}

export function getNumberEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function getBooleanEnv(key: string, fallback = false): boolean {
  const value = process.env[key];
  if (!value) return fallback;
  return value.toLowerCase() === "true" || value === "1";
}
