import { getEnv } from "@/config/runtime";

export interface LockHandle {
  key: string;
  token: string;
}

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();
const COMPARE_AND_DELETE_LUA = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

function resolveLockConfig(): { url: string; token: string } {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) {
    throw new Error("Missing required env: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN");
  }
  return { url, token };
}

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
  if (getEnv("LOCK_MODE") === "memory") {
    return acquireMemoryLock(key, ttlMs);
  }
  const { url, token } = resolveLockConfig();

  // TTL-based lock: if the holder crashes, TTL expiry releases the lock automatically.
  const lockToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await fetch(
    `${url}/set/${encodeURIComponent(key)}?value=${encodeURIComponent(lockToken)}&nx=true&px=${ttlMs}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST"
    }
  );
  if (!res.ok) {
    throw new Error(`lock_acquire_failed_${res.status}`);
  }
  const data = (await res.json()) as { result: string | null };
  if (data.result === "OK") {
    return { key, token: lockToken };
  }
  return null;
}

export async function releaseLock(handle: LockHandle): Promise<void> {
  if (getEnv("LOCK_MODE") === "memory") {
    releaseMemoryLock(handle);
    return;
  }
  const { url, token } = resolveLockConfig();
  const evalRes = await fetch(
    `${url}/eval/${encodeURIComponent(COMPARE_AND_DELETE_LUA)}/1/${encodeURIComponent(handle.key)}/${encodeURIComponent(handle.token)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST"
    }
  );
  if (!evalRes.ok) return;

  await evalRes.text().catch(() => "");
}
