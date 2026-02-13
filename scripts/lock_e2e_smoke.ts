import assert from "node:assert";
import { acquireLock, releaseLock } from "@/adapters/lock/redis_lock";

const COMPARE_AND_DELETE_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

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

async function upstashJson<T>(path: string): Promise<T> {
  const url = requireEnv("UPSTASH_REDIS_REST_URL");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`upstash_http_${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

async function assertEvalPathWorks(key: string): Promise<void> {
  const goodToken = `eval-good-${Date.now()}`;
  const staleToken = `eval-stale-${Date.now()}`;

  await upstashJson<{ result: string }>("/set/" + encodeURIComponent(key) + "?value=" + encodeURIComponent(goodToken));
  const staleEval = await upstashJson<{ result: number }>(
    `/eval/${encodeURIComponent(COMPARE_AND_DELETE_LUA)}/1/${encodeURIComponent(key)}/${encodeURIComponent(staleToken)}`
  );
  assert.equal(staleEval.result, 0, "eval compare-and-delete with stale token must return 0");

  const getAfterStale = await upstashJson<{ result: string | null }>("/get/" + encodeURIComponent(key));
  assert.equal(getAfterStale.result, goodToken, "eval stale token must not delete lock key");

  const validEval = await upstashJson<{ result: number }>(
    `/eval/${encodeURIComponent(COMPARE_AND_DELETE_LUA)}/1/${encodeURIComponent(key)}/${encodeURIComponent(goodToken)}`
  );
  assert.equal(validEval.result, 1, "eval compare-and-delete with valid token must return 1");

  const getAfterDelete = await upstashJson<{ result: string | null }>("/get/" + encodeURIComponent(key));
  assert.equal(getAfterDelete.result, null, "eval valid token must delete lock key");
}

async function run(): Promise<void> {
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");

  const previousLockMode = process.env.LOCK_MODE;
  if (process.env.LOCK_MODE === "memory") {
    delete process.env.LOCK_MODE;
  }

  const ttlMs = 4000;
  const key = `deepstock:lock:e2e:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const evalKey = `${key}:eval`;

  try {
    await assertEvalPathWorks(evalKey);

    const handle1 = await acquireLock(key, ttlMs);
    assert.ok(handle1, "first acquire should succeed");

    const handle2 = await acquireLock(key, ttlMs);
    assert.equal(handle2, null, "second acquire should fail while lock is held");

    // stale token release must not delete current lock
    await releaseLock({ key, token: `stale-token-${Date.now()}` });
    const handleAfterStaleRelease = await acquireLock(key, ttlMs);
    assert.equal(handleAfterStaleRelease, null, "stale token release must not unlock");

    await releaseLock(handle1!);

    const handle3 = await acquireLock(key, ttlMs);
    assert.ok(handle3, "acquire should succeed after valid token release (/eval compare-and-delete)");
    await releaseLock(handle3!);

    // TTL safety: if release fails silently, this eventually unlocks
    const handle4 = await acquireLock(key, ttlMs);
    if (!handle4) {
      await sleep(ttlMs + 200);
      const handleAfterTtl = await acquireLock(key, ttlMs);
      assert.ok(handleAfterTtl, "lock should be acquirable after ttl");
      await releaseLock(handleAfterTtl!);
    } else {
      await releaseLock(handle4);
    }

    console.log("Upstash lock E2E smoke passed (/eval included).");
  } finally {
    if (previousLockMode === undefined) delete process.env.LOCK_MODE;
    else process.env.LOCK_MODE = previousLockMode;
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
