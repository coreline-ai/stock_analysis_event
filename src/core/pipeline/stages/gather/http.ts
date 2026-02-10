import { withRetry } from "@/core/utils/retry";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  return withRetry(
    async () => {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
      return (await res.json()) as T;
    },
    { retries: 2, baseDelayMs: 500 }
  ).catch(() => null);
}

export async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  return withRetry(
    async () => {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
      return res.text();
    },
    { retries: 2, baseDelayMs: 500 }
  ).catch(() => null);
}
