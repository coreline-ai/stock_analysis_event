# Locking Notes

- Redis lock uses TTL. If a runner crashes, TTL expiry releases the lock.
- Release checks the token to avoid deleting another runner's lock.
- If lock not acquired, run exits early as partial.
