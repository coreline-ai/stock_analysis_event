import assert from "node:assert";
import { acquireLock, releaseLock } from "@/adapters/lock/db_lock";
import { query } from "@/adapters/db/client";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureLockTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS pipeline_locks (
      lock_key TEXT PRIMARY KEY,
      lock_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function run(): Promise<void> {
  requireEnv("DATABASE_URL");
  await ensureLockTable();

  const ttlMs = 4000;
  const key = `deepstock:lock:e2e:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const rowFor = async () =>
    query<{ lock_key: string; lock_token: string }>(
      `
      SELECT lock_key, lock_token
      FROM pipeline_locks
      WHERE lock_key = $1
      `,
      [key]
    );

  try {
    const handle1 = await acquireLock(key, ttlMs);
    assert.ok(handle1, "first acquire should succeed");

    const row1 = await rowFor();
    assert.equal(row1.length, 1, "lock row must exist after acquire");
    assert.equal(row1[0]?.lock_token, handle1?.token);

    const handle2 = await acquireLock(key, ttlMs);
    assert.equal(handle2, null, "second acquire should fail while lock is held");

    await releaseLock({ key, token: `stale-token-${Date.now()}` });
    const rowAfterStale = await rowFor();
    assert.equal(rowAfterStale.length, 1, "stale release must not delete row");
    assert.equal(rowAfterStale[0]?.lock_token, handle1?.token, "stale release must not change lock token");

    await releaseLock(handle1!);
    const rowAfterRelease = await rowFor();
    assert.equal(rowAfterRelease.length, 0, "valid release must delete row");

    const handle3 = await acquireLock(key, ttlMs);
    assert.ok(handle3, "acquire should succeed after valid token release");
    await releaseLock(handle3!);

    const handle4 = await acquireLock(key, ttlMs);
    assert.ok(handle4, "acquire should succeed for ttl validation");

    let handleAfterTtl = await acquireLock(key, ttlMs);
    const ttlDeadline = Date.now() + ttlMs + 8000;
    while (!handleAfterTtl && Date.now() < ttlDeadline) {
      await sleep(300);
      handleAfterTtl = await acquireLock(key, ttlMs);
    }
    if (!handleAfterTtl) {
      const debugRows = await query<{ lock_key: string; lock_token: string; expires_at: string; now: string }>(
        `
        SELECT lock_key, lock_token, expires_at::text, NOW()::text AS now
        FROM pipeline_locks
        WHERE lock_key = $1
        `,
        [key]
      );
      throw new Error(`lock should be acquirable after ttl: ${JSON.stringify(debugRows)}`);
    }
    await releaseLock(handleAfterTtl);

    console.log("DB lock E2E smoke passed.");
  } finally {
    await query(`DELETE FROM pipeline_locks WHERE lock_key = $1`, [key]).catch(() => {});
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
