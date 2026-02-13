# Production Deployment Guide (Vercel)

이 문서는 Research-Only 운영 배포를 위한 체크리스트다.

## 1) 필수 환경 변수

- `API_TOKEN` (또는 레거시 `DEEPSTOCK_API_TOKEN`)
- `DATABASE_URL`
- `LLM_PROVIDER` (`glm` 권장)
- `GLM_API_KEY` (또는 `OPENAI_API_KEY`)

권장:
- `DEFAULT_MARKET_SCOPE` (`US` | `KR` | `ALL`)
- `DEFAULT_STRATEGY_KEY` (`us_default` | `kr_default` | `all_default`)
- `PUBLIC_BASE_URL`
- `GATHER_MAX_ITEMS_PER_SOURCE`
- `SCORE_TOP_N`
- `DECIDE_TOP_N`
- `LLM_MAX_SIGNALS_PER_RUN`
- `LLM_MAX_CALLS_PER_RUN`
- `LLM_MAX_TOKENS_PER_CALL`
- `MIN_SECONDS_BETWEEN_RUNS`
- `RUN_MAX_SECONDS`
- `PIPELINE_PERSIST_RESERVE_MS`
- `KR_MARKET_ENABLED`
- `DART_API_KEY` (KR 실행 시 권장)
- `NAVER_ENABLED`
- `DART_ENABLED`
- `KR_COMMUNITY_ENABLED`
- `KR_NEWS_ENABLED`
- `US_*`, `KR_*`, `ALL_*` 전략별 제한치 오버라이드 (`*_GATHER_MAX_ITEMS_PER_SOURCE`, `*_DECIDE_TOP_N`, `*_LLM_MAX_*`)
  - `US_RUN_MAX_SECONDS`, `KR_RUN_MAX_SECONDS` 포함

참고:
- 분산 락은 `DATABASE_URL`의 `pipeline_locks` 테이블을 사용한다.

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
5. 분석 실행은 대시보드 또는 `POST /api/agent/trigger` 수동 호출로만 수행

## 4) DB 마이그레이션

- `db/migrations/*.sql` 전체를 순서대로 운영 DB에 적용
- 분산 락용 `db/migrations/006_pipeline_locks.sql` 포함 적용

## 5) 운영 확인

- `/api/agent/status` 정상 응답
- `/api/agent/decisions` 정상 응답
- `/api/agent/reports` 정상 응답

## 6) 운영 주의사항

- `LLM_PROVIDER=stub`는 운영에서 사용하지 않는다.
- GLM 사용 시 `GLM_BASE_URL`, `GLM_MODEL`, `GLM_TEMPERATURE`, `GLM_THINKING_TYPE=disabled`를 명시한다.
- 비용 제한(`LLM_MAX_*`)을 반드시 설정한다.

## 7) 배포 전 점검

- `npm test`
- `npx tsx scripts/env_checks.ts`
