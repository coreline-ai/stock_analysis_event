import { getEnv } from "@/config/runtime";
import { query } from "@/adapters/db/client";

export interface LockHandle {
  key: string;
  token: string;
}

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function hasDatabaseConfigured(): boolean {
  const value = getEnv("DATABASE_URL");
  return typeof value === "string" && value.trim().length > 0;
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

async function acquireDbLock(key: string, ttlMs: number): Promise<LockHandle | null> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rows = await query<{ lock_key: string }>(
    `
    WITH cleanup AS (
      DELETE FROM pipeline_locks
      WHERE lock_key = $1
        AND expires_at <= NOW()
    ),
    inserted AS (
      INSERT INTO pipeline_locks (lock_key, lock_token, expires_at, created_at)
      VALUES ($1, $2, NOW() + ($3::text || ' milliseconds')::interval, NOW())
      ON CONFLICT (lock_key) DO NOTHING
      RETURNING lock_key
    )
    SELECT lock_key FROM inserted
    `,
    [key, token, ttlMs]
  );
  if (rows.length === 0) return null;
  return { key, token };
}

async function releaseDbLock(handle: LockHandle): Promise<void> {
  await query(
    `
    DELETE FROM pipeline_locks
    WHERE lock_key = $1
      AND lock_token = $2
    `,
    [handle.key, handle.token]
  );
}

export async function acquireLock(key: string, ttlMs: number): Promise<LockHandle | null> {
  if (!hasDatabaseConfigured()) {
    return acquireMemoryLock(key, ttlMs);
  }
  return acquireDbLock(key, ttlMs);
}

export async function releaseLock(handle: LockHandle): Promise<void> {
  if (!hasDatabaseConfigured()) {
    releaseMemoryLock(handle);
    return;
  }
  await releaseDbLock(handle);
}
