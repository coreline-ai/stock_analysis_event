import { withRetry } from "@/core/utils/retry";
import { getNumberEnv } from "@/config/runtime";

const DEFAULT_GATHER_FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("gather_fetch_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const timeoutMs = Math.max(1000, getNumberEnv("GATHER_FETCH_TIMEOUT_MS", DEFAULT_GATHER_FETCH_TIMEOUT_MS));
  return withRetry(
    async () => {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
      return (await res.json()) as T;
    },
    { retries: 2, baseDelayMs: 500 }
  ).catch(() => null);
}

export async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  const timeoutMs = Math.max(1000, getNumberEnv("GATHER_FETCH_TIMEOUT_MS", DEFAULT_GATHER_FETCH_TIMEOUT_MS));
  return withRetry(
    async () => {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
      return res.text();
    },
    { retries: 2, baseDelayMs: 500 }
  ).catch(() => null);
}
