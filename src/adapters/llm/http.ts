import { getNumberEnv } from "@/config/runtime";

const DEFAULT_LLM_FETCH_TIMEOUT_MS = 25000;

export function getLlmFetchTimeoutMs(): number {
  return Math.max(1000, getNumberEnv("LLM_FETCH_TIMEOUT_MS", DEFAULT_LLM_FETCH_TIMEOUT_MS));
}

export async function fetchLlmWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = getLlmFetchTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("llm_fetch_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
