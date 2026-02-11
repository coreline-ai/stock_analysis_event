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

## WS-P 로컬 개발 UX / 자동 실행

- [x] `docker-compose.yml` 로컬 Postgres 추가 (host port `15432`)
- [x] 마이그레이션 러너 추가 (`scripts/db_migrate.ts`, `npm run db:migrate`)
- [x] 원커맨드 로컬 부팅 (`npm run dev:local` = db up + migrate + dev server)
- [x] 대시보드에서 `DATABASE_URL` 미설정 시 즉시 실행 가능한 안내 표시
- [x] 로컬 검증: `/api/health` 200, `/api/agent/trigger` 200(무토큰 dev 기본), `/dashboard` 200

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

- [x] API 토큰 미제공 시 401 (운영/인증강제 모드)
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

---

## GUI 개발 착수 분석 (코드 기준)

- [x] App Router 화면 인벤토리 분석: `app/page.tsx`, `app/dashboard/page.tsx`
- [x] API 인벤토리 분석: `app/api/health`, `app/api/agent/*`, `app/api/cron/run`
- [x] 도메인/DB 스키마 분석: `src/core/domain/types.ts`, `db/migrations/001_init.sql`
- [x] 실행 파이프라인 분석: `src/core/pipeline/run_pipeline.ts`
- [x] 인증/가드 분석: `src/security/auth.ts`, `src/security/cron_auth.ts`, `src/config/runtime.ts`

### 현재 지원 기능 목록 (코드에 존재)

- Health Check: `GET /api/health`
- 수동 실행: `POST /api/agent/trigger` (운영 또는 인증강제 모드에서 `x-api-token` 필요)
- 실행 이력 조회: `GET /api/agent/status` (`limit`, `offset`)
- 판단 결과 조회: `GET /api/agent/decisions` (`limit`, `offset`)
- 데일리 리포트 조회: `GET /api/agent/reports` (`limit`, `offset`)
- 크론 실행: `POST /api/cron/run` (`x-cron-secret` 필요)
- 대시보드 화면: 최신 decision/report 요약 렌더링
- 자동 파이프라인 단계: Gather -> Normalize -> Score -> Decide -> Report -> DB 기록

### 현재 GUI 공백/개선 포인트

- [x] 브라우저 내 인증 토큰 입력/보관/적용 UI 없음
- [x] 수동 실행 버튼/실행 상태 표시(loading, success, fail) UI 없음
- [x] 실행 이력(`agent_runs`) 상세 테이블/필터 UI 없음
- [x] decision 고급 필터(심볼, verdict, confidence, 기간) UI 없음
- [x] report 상세 보기/마크다운 보기/내보내기 UI 없음
- [x] source별 수집량/스코어 분포 시각화 UI 없음
- [x] 에러 코드별 사용자 가이드 UI 없음

---

## WS-Q GUI 전면 개발 계획 (병렬)

본 섹션은 "현재 기능을 사용자가 GUI로 쉽게 사용"하도록 만드는 구현 계획이다.

### Q-0 정보 구조(IA) 제안

- [x] ` / `: 제품 소개 + 실행 진입 버튼 + 현재 시스템 상태 요약
- [x] ` /dashboard `: 운영 콕핏 (실행 상태, KPI, 최근 결과, 위험 알림)
- [x] ` /dashboard/decisions `: 판단 탐색 화면 (필터/검색/페이지네이션/상세 패널)
- [x] ` /dashboard/reports `: 리포트 탐색 화면 (일자 목록 + 상세 마크다운 뷰)
- [x] ` /dashboard/runs `: 실행 이력 화면 (stage timing, 실패 원인, 수집량)
- [x] ` /dashboard/signals `: 원시/스코어 시그널 탐색 화면
- [x] ` /dashboard/settings `: 로컬/운영 환경 가이드 + 토큰/실행 옵션

### WS-Q1 공통 GUI 기반 (병렬 트랙 A)

- [x] 앱 셸(상단 네비 + 좌측 메뉴 + 콘텐츠) 구성
- [x] 공통 상태 배너(Research-Only, No Trade Execution) 고정 표시
- [x] 공통 API 클라이언트 모듈 추가 (`ok/error` 표준 응답 처리)
- [x] 공통 에러 토스트/알림 컴포넌트 추가
- [x] 공통 로딩 스켈레톤 컴포넌트 추가
- [x] 공통 EmptyState 컴포넌트 추가
- [x] 반응형 레이아웃(모바일/태블릿/데스크톱) 기준 확정

### WS-Q2 인증 UX + 실행 제어 (병렬 트랙 B)

- [x] UI에서 `API_TOKEN` 입력/저장(세션 스토리지, 레거시 키 호환) 기능
- [x] 보호 API 호출 시 토큰 자동 주입 로직 추가
- [x] 수동 실행 버튼(`Run Pipeline Now`) 추가
- [x] 실행 중 버튼 잠금 + 진행 상태 표시
- [x] 실행 완료 후 KPI/목록 즉시 새로고침
- [x] 인증 실패(401) 시 재입력 모달 표시
- [x] 금지 env 에러/필수 env 누락 에러 가이드 메시지 제공

### WS-Q3 운영 콕핏 대시보드 (병렬 트랙 C)

- [x] KPI 카드: BUY_NOW/WATCH/AVOID/최근 실행 상태
- [x] KPI 카드: 최근 실행 소요시간/성공률/최근 실패 횟수
- [x] Source 수집량 차트(`gatheredCounts`) 추가
- [x] Stage timing 차트(`stageTimingsMs`) 추가
- [x] 최근 decision 10개 미리보기 리스트
- [x] 최근 report 5개 미리보기 리스트
- [x] 실행 이력 링크/드릴다운 연결

### WS-Q4 Decisions Explorer (병렬 트랙 D)

- [x] verdict 필터(BUY_NOW/WATCH/AVOID)
- [x] 심볼 검색 필터
- [x] confidence 범위 필터
- [x] time horizon 필터(intraday/swing/long_term)
- [x] 페이지네이션(`limit`,`offset`) UI 구현
- [x] decision 상세 패널(thesis/entry/invalidation/risks/catalysts)
- [x] 소스 연결(`sourcesUsed`) 표시 및 연관 run 이동 링크

### WS-Q5 Reports Explorer (병렬 트랙 E)

- [x] 일자별 report 목록 화면
- [x] report 상세 마크다운 렌더러 적용
- [x] topBuyNow/topWatch 배지화 표시
- [x] themes/risks 태그화 표시
- [x] report JSON/Markdown 다운로드 버튼
- [x] 날짜 범위 탐색 UI

### WS-Q6 Runs + Signals Explorer (병렬 트랙 F)

- [x] 실행 이력 테이블(`agent_runs`) 구성
- [x] 상태 필터(success/partial/failed)
- [x] run 상세 패널(수집량, stage timing, error_summary)
- [x] raw signals 탐색 테이블(source, external_id, symbol, published_at)
- [x] scored signals 탐색 테이블(final_score, reason_summary)
- [x] 신호->결정 trace 뷰(재현성 확인 화면)

### WS-Q7 API 보강(필요 시 병렬 트랙 G)

- [x] `GET /api/agent/summary` 추가 (콕핏 집계용)
- [x] `GET /api/agent/signals/raw` 추가 (필터/페이지네이션)
- [x] `GET /api/agent/signals/scored` 추가 (필터/페이지네이션)
- [x] 기존 API 응답에 `meta`(total,limit,offset) 표준화
- [x] 에러 코드 표준화 (`unauthorized`, `missing_env`, `forbidden_env`, `db_error`)
- [x] API 계약 문서(`docs/`) 갱신

### WS-Q8 접근성/성능/운영 품질 (병렬 트랙 H)

- [x] 키보드 탐색 가능(메뉴, 필터, 모달)
- [x] 색 대비 WCAG AA 기준 검토
- [x] 로딩/오류/빈 상태 접근성 라벨 추가
- [x] 리스트 대량 데이터 렌더 최적화(가상화 또는 점진 로딩)
- [x] 초기 렌더 성능 측정(LCP, TTI) 및 예산 설정
- [x] 대시보드 핵심 사용자 플로우 모니터링 이벤트 추가

---

## GUI 통합 테스트 계획 (신규)

### 기능 테스트

- [x] 토큰 입력 후 보호 API 호출 성공
- [x] 무토큰(dev 기본) 호출 성공 + 운영/인증강제 모드 401 UX 처리 정상
- [x] 수동 실행 버튼 클릭 -> 실행 완료 -> 데이터 갱신 정상
- [x] runs/decisions/reports/signals 화면 간 이동 및 필터 정상
- [x] partial/failed run 시 에러 원인 표시 정상
- [x] `MIN_SECONDS_BETWEEN_RUNS` 가드 발생 시 UX 메시지 정상

### 품질 테스트

- [x] 모바일(390px), 태블릿(768px), 데스크톱(1280px) 레이아웃 검증
- [x] 주요 브라우저(Chrome/Safari) 동작 검증
- [x] 접근성 스캔(axe 또는 동등 도구) 경고 0 목표
- [x] 장시간 사용 시 메모리/성능 회귀 없음 확인

### E2E 시나리오

- [x] 시나리오-1: 첫 진입 -> 토큰 입력 -> 수동 실행 -> 콕핏 확인
- [x] 시나리오-2: decisions 필터링 -> 상세 확인 -> 관련 report 확인
- [x] 시나리오-3: run 실패 케이스 확인 -> 오류 가이드 따라 복구
- [x] 시나리오-4: signals 탐색 -> scored/decision trace 확인

---

## GUI 단계별 머지 전략

- [x] 1차: WS-Q1, WS-Q2 (공통 기반 + 인증/실행 UX)
- [x] 2차: WS-Q3, WS-Q4 (콕핏 + decision 탐색)
- [x] 3차: WS-Q5, WS-Q6 (report/run/signal 탐색)
- [x] 4차: WS-Q7, WS-Q8 (API 보강 + 품질 고도화)
- [x] 5차: GUI 통합 테스트 완료 후 릴리즈 태깅

---

## WS-R 미국/한국 분리 실행 (2버튼 + 전략 수행)

`docs/implementation_plan.md` 분석 결과를 반영한 신규 구현 워크스트림.
목표는 대시보드에서 `미국 분석 실행`/`한국 분석 실행` 버튼을 분리하고, 버튼별로 실제 전략(수집/정규화/판단/리포트)이 분기 실행되도록 만드는 것이다.

### WS-R0 요구사항 확정/계약 정의 (소유: `docs/`, `app/api/agent`)

- [x] 실행 스코프 enum 정의: `US | KR | ALL` (기본값 `US`)
- [x] 전략 키 정의: `us_default`, `kr_default`
- [x] `POST /api/agent/trigger` 요청 스키마 확장: `{ marketScope, strategyKey }`
- [x] 응답 스키마 확장: 실행된 `marketScope`, `strategyKey`, `runId` 포함
- [x] API 계약 문서 업데이트 (`docs/API_GUI_CONTRACT.md`)
- [x] 태스크/운영 문서 동기화 (`docs/IMPLEMENTATION_TASKS.md`, `docs/PROD_DEPLOYMENT.md`)

### WS-R1 도메인/런타임 확장 (소유: `src/core/domain`, `src/config`)

- [x] 도메인 타입 확장: `MarketScope` 타입 추가 (`US | KR | ALL`)
- [x] `runPipeline` 옵션 확장: `marketScope`, `strategyKey` 입력 지원
- [x] 런타임 기본값 환경변수 추가: `DEFAULT_MARKET_SCOPE`, `DEFAULT_STRATEGY_KEY`
- [x] 안전 가드 추가: 지원하지 않는 스코프/전략 키 요청 시 400 반환
- [x] 로깅 구조 확장: run 시작/종료 로그에 스코프/전략 키 기록

### WS-R2 파이프라인 분기 실행 (소유: `src/core/pipeline`)

- [x] Gather 단계에서 `marketScope` 기반 소스 선택 분기 구현
- [x] `US` 실행 시 미국 소스만 수집 (`reddit`, `stocktwits`, `sec`, `news`, `crypto`)
- [x] `KR` 실행 시 한국 소스만 수집 (`naver`, `dart`, `kr_community`, `kr_news`, `kr_research`, `kr_global_context`)
- [x] `ALL` 실행 시 양쪽 소스 병합 실행
- [x] Normalize 단계에서 미국 티커/한국 종목코드 검증 분기 재검토
- [x] Score 단계에서 한글/영문 감정 분석기 자동 분기 검증
- [x] Decide 단계 프롬프트 분기 검증 (US: 영문 시장 맥락, KR: 한국 시장 맥락)
- [x] Report 단계에 실행 스코프 표기 (`미국`, `한국`, `통합`) 추가

### WS-R3 전략 실행 관리 (소유: `src/core/pipeline`, `src/adapters/db/repositories`)

- [x] 전략별 제한치 프리셋 도입 (`GATHER_MAX_*`, `DECIDE_TOP_N`, `LLM_MAX_*`)
- [x] `us_default` 프리셋 정의 및 적용
- [x] `kr_default` 프리셋 정의 및 적용
- [x] 전략 키별 실행 이력 비교 가능하도록 `agent_runs` 기록 확장
- [x] 동일 스코프/전략 중복 실행 락 키 분리 (`pipeline:US`, `pipeline:KR`)

### WS-R4 DB/조회 모델 확장 (소유: `db/migrations`, `src/adapters/db/repositories`)

- [x] 마이그레이션 추가: `agent_runs`에 `market_scope`, `strategy_key` 컬럼
- [x] 필요 시 `decisions`, `daily_reports`에 `market_scope` 컬럼 추가
- [x] 리포지토리 insert/list 함수에 스코프/전략 필드 반영
- [x] 기존 데이터와 호환되도록 nullable/default 처리
- [x] 기존 API 페이지네이션 계약 유지 확인

### WS-R5 Trigger API 확장 (소유: `app/api/agent/trigger`)

- [x] `POST /api/agent/trigger` body 파싱 추가
- [x] body 미지정 시 기존 동작과 호환 (`marketScope=US`, `strategyKey=us_default`)
- [x] 잘못된 body 입력 시 표준 에러 코드로 반환 (`invalid_request`)
- [x] 인증/금지 env/DB 에러 매핑 유지
- [x] API 테스트 케이스 추가 (`US`, `KR`, invalid 값)

### WS-R6 GUI 2버튼 실행 UX (소유: `app/dashboard/_components`)

- [x] 상단 실행 버튼을 2개로 분리:
- [x] `미국 분석 실행` 버튼 추가
- [x] `한국 분석 실행` 버튼 추가
- [x] 버튼별 로딩 상태 독립 관리 (`runningUS`, `runningKR`)
- [x] 버튼 클릭 시 각기 다른 payload로 trigger 호출
- [x] 성공 토스트에 실행 스코프/전략 키 노출
- [x] 실패 토스트에 스코프별 가이드 노출 (예: KR 실행 시 DART 키 안내)
- [x] 접근성: 버튼 aria-label/키보드 포커스 순서 검증

### WS-R7 GUI 필터/표시 확장 (소유: `app/dashboard/page.tsx`, `app/dashboard/runs/page.tsx`, `app/dashboard/reports/page.tsx`, `app/dashboard/decisions/page.tsx`)

- [x] 콕핏에 최근 실행 스코프 배지 표시 (`미국`, `한국`, `통합`)
- [x] Runs 화면에 스코프/전략 컬럼 및 필터 추가
- [x] Decisions 화면에 스코프 필터 추가 (US/KR/ALL)
- [x] Reports 화면에 스코프 필터 추가
- [x] Summary API 집계에 스코프별 KPI 카드 추가 (US 결정 수, KR 결정 수)
- [x] URL 쿼리와 필터 상태 동기화 (`?scope=US`)

### WS-R8 자동 실행/운영 설정 (소유: `scripts/`, `.env.example`, `docs/`)

- [x] `dev:active` 주기 실행에 스코프 옵션 추가 (`AUTO_TRIGGER_SCOPE`)
- [x] `scripts/dev_up.sh` launch env에 스코프/전략 기본값 전달
- [x] `.env.example`에 KR 관련 필수/권장 변수 재정리 (`KR_MARKET_ENABLED`, `DART_API_KEY`)
- [x] 운영 문서에 KR 실행 전제조건 명시 (API 키, 수집 소스 제한, 요청량)

### WS-R9 테스트 계획 (신규)

#### 기능 테스트

- [x] `미국 분석 실행` 클릭 시 US 소스만 수집되고 run 기록 스코프 `US`
- [x] `한국 분석 실행` 클릭 시 KR 소스만 수집되고 run 기록 스코프 `KR`
- [x] 두 버튼 연속 실행 시 락 충돌 없이 독립 동작
- [x] KR 실행에서 DART 키 누락 시 명확한 에러 메시지 노출
- [x] 기존 단일 실행 흐름(레거시 호출) 호환 유지

#### API/데이터 테스트

- [x] `POST /api/agent/trigger` with `{marketScope:\"US\"}` 정상
- [x] `POST /api/agent/trigger` with `{marketScope:\"KR\"}` 정상
- [x] 잘못된 `marketScope` 입력 시 400 + `invalid_request`
- [x] `agent_runs` 조회 시 `market_scope`, `strategy_key` 값 확인
- [x] reports/decisions 조회에서 스코프 필터 정확성 확인

#### 회귀 테스트

- [x] 기존 `/api/health`, `/api/agent/status`, `/api/agent/reports` 회귀 없음
- [x] 미국 파이프라인 성능/결과 품질 회귀 없음
- [x] 한국 파이프라인 추가 후 빌드/테스트(`npm test`, `npm run build`) 통과

검증 로그 (2026-02-11):
- `npm test` 통과
- `npm run build` 통과
- `POST /api/agent/trigger` (`US`, `KR`, invalid, legacy/no-body) 확인
- `GET /api/agent/status?scope=US|KR`로 소스 분기/스코프 기록 확인
- US+KR 동시 트리거(병렬 요청)로 락 충돌 없음 확인
- `DART_API_KEY` 누락 상태 KR 트리거 실패 메시지(`Missing required env: DART_API_KEY`) 확인

### WS-R10 병렬 개발 배치 (권장)

- [x] 트랙 A (백엔드): WS-R0, WS-R1, WS-R2, WS-R3, WS-R5
- [x] 트랙 B (DB/API): WS-R4, WS-R7(조회 API 연계), WS-R9(API/데이터 테스트)
- [x] 트랙 C (프런트): WS-R6, WS-R7(UI), WS-R9(기능 테스트)
- [x] 트랙 D (운영): WS-R8, WS-R9(회귀/운영 시나리오)
- [x] 병합 순서: A -> B -> C -> D

---

## WS-S 무료 한국 소스 확장 (한경/커뮤니티/인베스팅)

사용자 확정 요구사항(100% 무료 소스) 반영:
- 한경 컨센서스 추가
- 증권플러스/팍스넷/씽크풀 커뮤니티 신호 강화
- 인베스팅닷컴 코리아 글로벌 맥락 추가
- 인포맥스 제외(유료)

### WS-S1 수집기 구현

- [x] `kr_research` 수집기 구현 (`src/core/pipeline/stages/gather/kr_research.ts`)
- [x] `kr_global_context` 수집기 구현 (`src/core/pipeline/stages/gather/kr_global_context.ts`)
- [x] `kr_community`를 증권플러스/팍스넷/씽크풀 중심 쿼리로 확장
- [x] 수집 메타에 `source_detail`, `market_scope`, `query` 기록

### WS-S2 파이프라인 연결

- [x] `SignalSource` 타입에 `kr_research`, `kr_global_context` 추가
- [x] Gather task 등록 및 토글 env 추가 (`KR_RESEARCH_ENABLED`, `KR_GLOBAL_CONTEXT_ENABLED`)
- [x] Normalize KR 소스 집합에 신규 2개 소스 포함
- [x] Source weight 확장 (`kr_research=0.92`, `kr_global_context=0.75`)
- [x] 대시보드 소스 라벨 한글 추가

### WS-S3 문서/환경 동기화

- [x] `.env.example`에 신규 토글 변수 반영
- [x] `docs/implementation_plan.md`에 무료 한국 소스 확정안 명시
- [x] `docs/implementation_plan.md`에 인포맥스 제외 근거 명시

### WS-S4 검증

- [x] `npm test` 통과
- [x] `npm run build` 통과

---

## WS-T implementation_plan 추가분 구현 (Hybrid + KR 종목명 연계)

`docs/implementation_plan.md`의 추가 기획 중 코드 미반영 항목을 구현한다.

### WS-T1 KR 종목명/티커 캐시 연계

- [x] `kr_ticker_cache` 모듈 추가 (`src/core/pipeline/stages/normalize/kr_ticker_cache.ts`)
- [x] DART `corpCode.xml` 기반 24h 캐시 갱신 로직 추가
- [x] 기본 KR 대표 종목 시드 맵 추가 (키 미설정 시 fallback)
- [x] KR/ALL 파이프라인 실행 시 KR 티커 캐시 갱신 시도
- [x] Decide 프롬프트에 `종목코드(종목명)` 형식 표시
- [x] Daily report에 KR 종목명 표시 반영
- [x] DB 마이그레이션 추가: `kr_ticker_map` (`db/migrations/003_kr_ticker_map.sql`)

### WS-T2 Hybrid Quant-Social 전략 반영

- [x] KR 하이브리드 분석 모듈 추가 (`src/core/pipeline/stages/score/quant_kr.ts`)
- [x] Social/Event/Volume/Flow/Technical score 계산 로직 추가
- [x] Soft scoring: `finalScore *= quantMultiplier` 반영
- [x] Hard filter: 거래량/수급 조건 미충족 시 BUY_NOW -> WATCH 강등
- [x] Decision 결과에 하드 필터 강등 사유(리스크/경고) 자동 추가
- [x] `promptVersion` 업데이트 (`v2_hybrid_quant_social`)
- [x] Daily report 판단 기준에 Hybrid 전략 요약 추가

### WS-T3 테스트/검증

- [x] 단위 테스트 추가: KR hybrid quant 계산 검증
- [x] 단위 테스트 추가: Hard filter BUY_NOW 강등 검증
- [x] 기존 회귀 테스트 통과 (`npm test`)
- [x] 빌드 검증 통과 (`npm run build`)

### WS-U 강화 하이브리드 수식/조건 반영

- [x] `social/event/volume/flow/technical/contextRisk` 정량화 수식 강화
- [x] `tripleCrownPassed` 계산 로직 추가 (`social + event + hardFilter`)
- [x] `hardFilterPassed` 기준 강화 (거래량/수급/기술 가드 각각 조건화)
- [x] Soft scoring 수식 강화 (`baseScore * quantMultiplier * riskPenalty`)
- [x] BUY_NOW 하드게이트 강화: 삼관왕/가드 미충족 시 WATCH 강등
- [x] LLM 입력에 `hybrid_*` 세부 라인(레이어 통과/실패, 리스크) 확장
- [x] 리포트에 강화 하이브리드 요약 지표(quant/social/event/contextRisk, triple 통과수) 반영
- [x] 테스트 보강: 삼관왕 통과/거래량 가드 실패/BUY_NOW 강등 케이스 검증
- [x] 검증 완료: `npm test`, `npm run build`

### WS-V KR 실효성/조회 일관성 보강

- [x] KR 종목명 기반 티커 추출 추가 (`extractKrTickerCandidatesByName`)
- [x] Normalize 단계에서 숫자코드 + 종목명 매칭 동시 적용
- [x] KR 런타임에서 `scoredCount=0` 문제 완화 확인
- [x] `/api/agent/signals/raw`에 `scope=US|KR` 필터 적용
- [x] `/api/agent/signals/scored`에 `scope=US|KR` 필터 적용 (raw source join 기반)
- [x] KR/US 스코프 조회 교차 오염 제거 확인
- [x] 검증 완료: `npm test`, `npm run build`, KR 수동 트리거 API 확인

### WS-W 신규 기능 GUI 완전 반영

- [x] Signals 화면에 `scope(US/KR/ALL)` 필터 추가 및 URL 쿼리 동기화
- [x] Signals API 호출에 `scope` 전달 (raw/scored/decisions 동시 적용)
- [x] 스코어 테이블에 하이브리드 핵심 컬럼 노출 (`quant`, `hardFilter`, `tripleCrown`)
- [x] 스코어 상세 패널에 하이브리드 정량 지표 전체 노출
- [x] `signals_scored`에 하이브리드 필드 저장 스키마 확장 (`004_signals_scored_hybrid.sql`)
- [x] scored repository insert/select를 하이브리드 필드 기준으로 확장
- [x] 기존 데이터 nullable 호환 확인 (과거 레코드도 화면 표시 가능)
- [x] 검증 완료: `npm test`, `npm run build`, KR 스코프 API/화면 데이터 확인

### WS-X 런타임 안정화/실사용 보강

- [x] `localhost:3333` dev 런타임 재기동 절차 정리 및 `.next` 캐시 손상 이슈 복구 확인
- [x] dev/build 산출물 분리(`NEXT_DIST_DIR=.next-dev`)로 `vendor-chunks`/chunk 유실 재발 방지
- [x] KR 실행 시 `DART_API_KEY` 미설정이면 DART 소스만 스킵하고 파이프라인 계속 진행하도록 보강
- [x] `signals/scored` 정렬을 하이브리드 필드 우선으로 보강 (`quant_score` null 우선순위 하향)
- [x] GUI 품질 테스트 스크립트를 2버튼 UX(미국/한국 실행) 기준으로 갱신
- [x] 인증/GUI 토큰 표기를 `API_TOKEN` 우선으로 전환 (레거시 `MAHORAGA_*` 호환 유지)
- [x] 검증 완료: `npm test`, `npm run build`, `npm run test:gui`, `POST /api/agent/trigger (KR)` 성공
