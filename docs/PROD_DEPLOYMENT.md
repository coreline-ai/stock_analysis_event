# Production Deployment Guide (Vercel)

이 문서는 Research-Only 운영 배포를 위한 체크리스트다.

## 1) 필수 환경 변수

- `MAHORAGA_API_TOKEN`
- `CRON_SECRET`
- `DATABASE_URL`
- `OPENAI_API_KEY`

권장:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PUBLIC_BASE_URL`
- `GATHER_MAX_ITEMS_PER_SOURCE`
- `SCORE_TOP_N`
- `DECIDE_TOP_N`
- `LLM_MAX_SIGNALS_PER_RUN`
- `LLM_MAX_CALLS_PER_RUN`
- `LLM_MAX_TOKENS_PER_CALL`
- `MIN_SECONDS_BETWEEN_RUNS`
- `RUN_MAX_SECONDS`

## 2) 금지 환경 변수

아래 키가 존재하면 부팅이 실패한다.

- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `BROKER_MODE`
- `TRADING_ENABLED`

## 3) Vercel 배포 절차

1. GitHub 연동 및 프로젝트 생성
2. 환경 변수 등록
3. 빌드/배포 실행
4. `/api/health` 확인

## 4) Cron 설정 (Vercel)

- 경로: `/api/cron/run`
- 헤더: `x-cron-secret: <CRON_SECRET>`

예시 스케줄:
- 매 10분: `*/10 * * * *`

## 5) DB 마이그레이션

- `db/migrations/001_init.sql`을 운영 DB에 적용

## 6) 운영 확인

- `/api/agent/status` 정상 응답
- `/api/agent/decisions` 정상 응답
- `/api/agent/reports` 정상 응답

## 7) 운영 주의사항

- `LLM_PROVIDER=stub`는 운영에서 사용하지 않는다.
- 비용 제한(`LLM_MAX_*`)을 반드시 설정한다.

## 8) 배포 전 점검

- `npm test`
- `npx tsx scripts/env_checks.ts`
