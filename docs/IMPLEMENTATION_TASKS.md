# 구현 테스크 계획서 (병렬)

본 문서는 병렬 개발을 전제로 한 상세 구현 테스크 계획서이다. 각 항목은 완료 시 `[x]`로 체크한다.

---

## 예제 코드 참조 매핑 (포팅 기준)

- [x] Reddit gatherer 기준: `example/MAHORAGA-main/src/strategy/default/gatherers/reddit.ts`
- [x] StockTwits gatherer 기준: `example/MAHORAGA-main/src/strategy/default/gatherers/stocktwits.ts`
- [x] SEC EDGAR gatherer 기준: `example/MAHORAGA-main/src/strategy/default/gatherers/sec.ts`
- [x] Crypto gatherer 기준: `example/MAHORAGA-main/src/strategy/default/gatherers/crypto.ts`
- [x] Sentiment/Freshness 기준: `example/MAHORAGA-main/src/strategy/default/helpers/sentiment.ts`
- [x] Ticker 추출/검증 기준: `example/MAHORAGA-main/src/strategy/default/helpers/ticker.ts`
- [x] Source weight 기준: `example/MAHORAGA-main/src/strategy/default/config.ts`
- [x] LLM 프롬프트 기준: `example/MAHORAGA-main/src/strategy/default/prompts/research.ts`
- [x] LLM 분석 기준(참고): `example/MAHORAGA-main/src/strategy/default/prompts/analyst.ts`

---

## WS-A 부팅/프로젝트 스캐폴딩 (소유: `app/`, `src/`, `package.json`)

- [x] `app/` App Router 기본 구성 완료 (`app/layout.tsx`, `app/page.tsx`)
- [x] `/api/health` 라우트 구현 및 200 응답 확인
- [x] 기본 디렉터리 생성 (`src/core`, `src/adapters`, `src/security`, `src/config`, `db/`)
- [x] `tsconfig.json` 경로 별칭 및 빌드 옵션 기본값 확정
- [x] 기본 스크립트 정리 (`dev`, `build`, `lint`, `test`)
- [x] 로컬 실행 확인 (서버 부팅 + `/api/health`)

## WS-B 보안/인증/환경 가드 (소유: `src/security`, `src/config`)

- [x] API 토큰 검증 미들웨어 구현
- [x] Cron 시크릿 검증 유틸 구현
- [x] `FORBIDDEN` env 존재 시 부팅 실패 로직 구현
- [x] 공통 에러 응답 스키마 정의
- [x] 인증 실패/누락 로그 포맷 통일
- [x] 인증 미들웨어를 API 라우트에서 재사용 가능하도록 모듈화

## WS-C DB 스키마/레포지토리 (소유: `db/`, `src/adapters/db`)

- [x] `docs/conceptual_schema.md` 기반 테이블 정의 확정
- [x] 마이그레이션 도구 선정 및 초기 마이그레이션 작성
- [x] DB 클라이언트 구현 (`DATABASE_URL`)
- [x] 레포지토리 구현: `signals_raw`, `signals_scored`, `decisions`, `daily_reports`, `agent_runs`
- [x] CRUD 스모크 테스트 완료
- [x] 중복 방지 인덱스/유니크 제약 반영
- [x] 기본 쿼리: 최신 결정/리포트/실행이력 조회 API용 메서드 추가

## WS-D 락/러너/중복 실행 (소유: `src/adapters/lock`, `app/api/cron`)

- [x] Redis 락 어댑터 구현 (Upstash 우선)
- [x] `MIN_SECONDS_BETWEEN_RUNS` 실행 간격 가드 구현
- [x] `/api/cron/run` 구현 및 락 획득 시 실행
- [x] 실패/중단 시 `agent_runs` 기록
- [x] 락 TTL 만료/해제 시나리오 정리
- [x] Cron 트리거 시 타임박스/처리량 제한 적용

## WS-E 코어 도메인/파이프라인 골격 (소유: `src/core`)

- [x] 도메인 타입 정의 (`SignalRaw`, `SignalScored`, `Decision`, `DailyReport`, `AgentRun`)
- [x] 파이프라인 인터페이스 정의 (gather/normalize/score/decide/report)
- [x] `run_pipeline.ts` 골격 구현 (단계 순서/에러 처리 포함)
- [x] 어댑터 주입 구조 정의 (DB/LLM/Lock)
- [x] 파이프라인 공통 컨텍스트 설계 (run_id, limits, now, logger)
- [x] 단계별 입력/출력 타입 명시 및 변환 규칙 문서화

## WS-F Gather 포팅 (소유: `src/core/pipeline/stages/gather`)

- [x] Reddit gatherer 포팅 (공개 API 기반)
- [x] StockTwits gatherer 포팅 (차단 시 graceful skip)
- [x] SEC EDGAR gatherer 포팅 (ATOM 파싱 + ticker 매핑)
- [x] Crypto gatherer 리서치 모드 구현 (키 없으면 비활성)
- [x] News gatherer 추가 (키 없으면 RSS, 키 있으면 API)
- [x] rate limit/backoff 정책 통일 (sleep, retry)
- [x] 수집 결과 `signals_raw` 저장 규칙 확정 (source, external_id, published_at)
- [x] ticker 추출/검증 유틸 포팅 및 캐시 적용
- [x] 각 gatherer별 최소/최대 수집량 제한 적용 (`GATHER_MAX_ITEMS_PER_SOURCE`)

## WS-G Normalize/Score (소유: `src/core/pipeline/stages/normalize`, `score`)

- [x] 심볼 정규화 규칙 구현
- [x] 중복 제거 키 전략 구현
- [x] sentiment/freshness/source_weight 스코어링 구현
- [x] `signals_scored` 저장 (Top N 제한 적용)
- [x] Source weight 설정 분리 (`src/config/source_config.ts`)
- [x] freshness 계산 로직 포팅 (half-life 기반)
- [x] 스코어링 근거 요약 생성 (`reason_summary`)

## WS-H LLM/Decision (소유: `src/adapters/llm`, `src/core/pipeline/stages/decide`)

- [x] LLM Provider 인터페이스 정의 및 OpenAI 구현
- [x] Decision 스키마(Zod) 정의 (`BUY_NOW|WATCH|AVOID`)
- [x] Decision 프롬프트 설계 (Research-Only)
- [x] LLM 호출 제한 (`LLM_MAX_*`) 및 재시도 정책 구현
- [x] `decisions` 저장 + `sources_used` 연결
- [x] 프롬프트/스키마 버전 관리 필드 추가
- [x] LLM 응답 실패 시 부분 실패 처리 및 기록

## WS-I Report (소유: `src/core/pipeline/stages/report`)

- [x] 데일리 리포트 생성 로직 구현
- [x] `daily_reports` 저장 및 날짜 유니크 처리
- [x] 리포트에 포함될 섹션 템플릿 정의 (BUY_NOW/WATCH/테마/리스크)

## WS-J API/대시보드 (소유: `app/api`, `app/(ui)`)

- [x] 상태 조회 API (`agent_runs` 기반)
- [x] 결정 조회 API (`decisions` 필터 포함)
- [x] 리포트 조회 API (`daily_reports`)
- [x] 수동 트리거 API (인증 + 실행)
- [x] 대시보드 UI (결정/리포트/상태 표시)
- [x] 엔드포인트 확정 (TREE.md 기준): `app/api/agent/status`, `decisions`, `reports`, `trigger`
- [x] 기본 필터/페이지네이션 정의

## WS-K 관측/실행 이력 (소유: `src/core/utils`, `src/adapters/db/repositories`)

- [x] `agent_runs` 기록 유틸 (시작/종료/상태/에러)
- [x] 구조화 로그 유틸 (`run_id` 연결)
- [x] LLM 비용/토큰 누적 기록
- [x] 단계별 실행 시간 측정 및 저장

---

## WS-L 테스트/품질 작업 (병렬 가능)

- [x] gatherer별 단위 테스트 (Reddit/StockTwits/SEC/News) 기본 파싱 검증
- [x] sentiment/freshness/ticker 유틸 단위 테스트
- [x] 스코어링 Top N 정렬 테스트
- [x] Decision 스키마 검증 테스트 (유효/무효 케이스)
- [x] LLM 호출 제한/재시도 로직 테스트
- [x] DB 레포지토리 CRUD 테스트 (로컬 테스트 DB)
- [x] Cron 락 획득/해제 테스트

---

## WS-M 운영/배포 준비 (Prod)

- [x] 운영 배포 체크리스트 문서화 (`docs/PROD_DEPLOYMENT.md`)
- [x] Vercel Cron 설정 가이드 추가
- [x] prod 환경변수 검증/권장값 정리
- [x] 배포 전 점검 스크립트/가이드 추가

## WS-N CI 통합

- [x] GitHub Actions CI 추가 (install + test)
- [x] CI에서 `npm test` 실행
- [x] 실패 시 로그 확인 가이드 문서화

## WS-O 대시보드/UI 고도화

- [x] 글로벌 스타일/타이포/컬러 시스템 추가
- [x] 홈 화면 정보 구조 개선
- [x] 대시보드 레이아웃 개선 (요약 카드 + 리스트 + 메타)
- [x] 빈 상태/에러 상태 UI 개선

---

## 통합/머지 순서

- [x] 1차 머지: WS-A, WS-B, WS-C, WS-E
- [x] 2차 머지: WS-F, WS-G, WS-H, WS-K
- [x] 3차 머지: WS-D, WS-I, WS-J

---

## 최종 테스트 계획 (체크리스트)

### 환경/부팅

- [x] `FORBIDDEN` env 존재 시 부팅 실패 확인
- [x] 필수 env 누락 시 명확한 에러 출력 확인

### 인증/보안

- [x] API 토큰 미제공 시 401
- [x] Cron 시크릿 미제공 시 401

### 파이프라인

- [x] Gather 단독 실행 성공
- [x] Normalize + Score 실행 성공
- [x] Decide 실행 성공 (LLM 호출 제한 적용)
- [x] Report 생성 성공
- [x] 부분 실패 발생 시 전체 실패로 번지지 않음 확인

### DB

- [x] `signals_raw` insert 확인
- [x] `signals_scored` insert 확인
- [x] `decisions` insert 확인
- [x] `daily_reports` insert 확인
- [x] `agent_runs` 기록 확인
- [x] `source + external_id` 중복 방지 동작 확인

### 락/중복 실행

- [x] 동시 실행 시 1회만 실행됨
- [x] 락 TTL 만료 후 재실행 가능
- [x] `MIN_SECONDS_BETWEEN_RUNS` 가드 동작 확인

### API

- [x] `/api/health` 200
- [x] `/api/agent/status` 정상 응답
- [x] `/api/agent/decisions` 정상 응답
- [x] `/api/agent/reports` 정상 응답
- [x] `/api/agent/trigger` 정상 실행
- [x] 인증 실패 시 표준 에러 응답 확인

### 리서치 전용 보장

- [x] 브로커/주문 실행 경로 없음 확인
- [x] 관련 env 존재 시 시스템 차단 확인
