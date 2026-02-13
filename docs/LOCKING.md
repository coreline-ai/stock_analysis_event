# Locking Notes

- 파이프라인 락은 `pipeline_locks` 테이블(DB 기반)로 관리한다.
- 락 획득 시 만료된 동일 키를 정리한 뒤 `INSERT ... ON CONFLICT DO NOTHING`으로 단일 소유자를 보장한다.
- 락 해제는 `lock_key + lock_token` 일치 조건으로만 삭제하여 원자성을 보장한다.
- 실행 중 프로세스가 중단되어도 `expires_at` TTL이 지나면 다음 실행이 락을 재획득할 수 있다.

## E2E Smoke

- Command: `npm run test:lock:e2e`
- Required env:
  - `DATABASE_URL`
- 검증 항목:
  - 동시 획득 시 1회만 성공
  - stale token 해제 시 락 유지
  - valid token 해제 시 락 삭제
  - TTL 만료 후 재획득 가능
