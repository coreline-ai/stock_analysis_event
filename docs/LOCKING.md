# Locking Notes

- Redis lock uses TTL. If a runner crashes, TTL expiry releases the lock.
- Release checks the token to avoid deleting another runner's lock.
- If lock not acquired, run exits early as partial.

## Upstash E2E Smoke

- Command: `npm run test:lock:e2e`
- Required env:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Notes:
  - `LOCK_MODE=memory` is ignored for this smoke test.
  - The test verifies stale-token release does not unlock and valid-token release unlocks via Upstash `/eval` compare-and-delete.
