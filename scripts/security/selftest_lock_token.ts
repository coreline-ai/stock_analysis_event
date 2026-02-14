import assert from "node:assert";
import { acquireLock, releaseLock } from "@/adapters/lock/db_lock";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,}$/;

async function run(): Promise<void> {
  const snapshot = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const key1 = `selftest-lock-${Date.now()}-a`;
  const key2 = `selftest-lock-${Date.now()}-b`;
  const handle1 = await acquireLock(key1, 5000);
  const handle2 = await acquireLock(key2, 5000);
  assert.ok(handle1);
  assert.ok(handle2);
  assert.notEqual(handle1?.token, handle2?.token);
  assert.ok(TOKEN_PATTERN.test(handle1!.token), `unexpected token format: ${handle1!.token}`);
  assert.ok(TOKEN_PATTERN.test(handle2!.token), `unexpected token format: ${handle2!.token}`);

  await releaseLock(handle1!);
  await releaseLock(handle2!);

  if (snapshot) process.env.DATABASE_URL = snapshot;
  else delete process.env.DATABASE_URL;

  console.log("selftest_lock_token passed");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
