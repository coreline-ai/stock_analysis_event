import { getEnv } from "@/config/runtime";

export interface LockHandle {
  key: string;
  token: string;
}

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function acquireMemoryLock(key: string, ttlMs: number): LockHandle | null {
  const existing = memoryLocks.get(key);
  const now = Date.now();
  if (existing && existing.expiresAt > now) return null;
  const token = `${now}-${Math.random().toString(36).slice(2)}`;
  memoryLocks.set(key, { token, expiresAt: now + ttlMs });
  return { key, token };
}

function releaseMemoryLock(handle: LockHandle): void {
  const existing = memoryLocks.get(handle.key);
  if (!existing) return;
  if (existing.token !== handle.token) return;
  memoryLocks.delete(handle.key);
}

export async function acquireLock(key: string, ttlMs: number): Promise<LockHandle | null> {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (getEnv("LOCK_MODE") === "memory") {
    return acquireMemoryLock(key, ttlMs);
  }
  if (!url || !token) {
    return { key, token: "no-lock" };
  }

  // TTL-based lock: if the holder crashes, TTL expiry releases the lock automatically.
  const lockToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await fetch(
    `${url}/set/${encodeURIComponent(key)}?value=${encodeURIComponent(lockToken)}&nx=true&px=${ttlMs}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST"
    }
  );
  const data = (await res.json()) as { result: string | null };
  if (data.result === "OK") {
    return { key, token: lockToken };
  }
  return null;
}

export async function releaseLock(handle: LockHandle): Promise<void> {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (getEnv("LOCK_MODE") === "memory") {
    releaseMemoryLock(handle);
    return;
  }
  if (!url || !token || handle.token === "no-lock") return;

  const res = await fetch(`${url}/get/${encodeURIComponent(handle.key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST"
  });
  const data = (await res.json()) as { result: string | null };
  if (data.result !== handle.token) return;

  await fetch(`${url}/del/${encodeURIComponent(handle.key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST"
  });
}
