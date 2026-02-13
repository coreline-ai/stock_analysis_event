# DEEPSTOCK 리브랜딩 전환 계획 (legacy_brand 완전 제거)

본 계획은 코드, DB, 스크립트, 문서, 실행 환경 전체에서 `legacy_brand` 문자열/식별자를 제거하고 `deepstock`으로 전환하기 위한 실행 체크리스트다.

## 0. 운영 원칙 (Single Source of Truth)

- 리브랜딩 진행 상태 체크박스의 단일 기준 문서는 본 문서(`docs/DEEPSTOCK_REBRANDING_PLAN.md`)다.
- 다른 문서(`docs/IMPLEMENTATION_TASKS.md` 포함)에는 리브랜딩 상태를 체크박스로 중복 관리하지 않는다.
- 타 문서는 진행 현황을 "참조 링크/서술"로만 갱신한다.
- 적용 시작일: 2026-02-13

## 1. 목표와 완료 기준

- [x] 목표 1: 저장소 내 `legacy_brand` 문자열 0건
- [x] 목표 2: 실행 환경/런타임 로그/락 키/PID 파일명에서 `legacy_brand` 0건
- [x] 목표 3: DB 스키마/데이터/접속정보에서 `legacy_brand` 0건
- [x] 목표 4: CI 통과 + 수동 스모크 테스트 통과

## 2. 현재 기준선 (이미 수행)

- [x] 코드/문서/설정 전수 스캔 완료: `116`건 (`npm run branding:check`, baseline 기준)
- [x] 분류 집계 완료: `docs 88`, `scripts 20`, `.env.example 1`, `docker-compose.yml 5`, `app 2` (현재 baseline)
- [x] 이름 기반 파일/폴더 탐지 완료: `example/LEGACY_BRAND-main`, `example/LEGACY_BRAND-main/docs/legacy_brand.svg`, `example/LEGACY_BRAND-main/src/durable-objects/legacy_brand-harness.ts`
- [x] 운영 DB 데이터 기준선 점검 완료: 주요 테이블 row 단위 텍스트 검색에서 `0건`
- [x] 리브랜딩 치환 규칙 최종 승인

## 3. 치환 규칙 (강제)

- [x] `LEGACY_BRAND` -> `DEEPSTOCK`
- [x] `LegacyBrand` -> `Deepstock`
- [x] `legacy_brand` -> `deepstock`
- [x] `LEGACY_BRAND_API_TOKEN` -> `DEEPSTOCK_API_TOKEN`
- [x] `LEGACY_BRAND_DEV_AUTH_BYPASS` -> `DEEPSTOCK_DEV_AUTH_BYPASS`
- [x] `legacy_brand_api_token`(sessionStorage key) -> `deepstock_api_token`
- [x] `legacy_brand:pipeline:*`(락 키) -> `deepstock:pipeline:*`

## 4. 병렬 워크스트림

### WS-0 Foundation (공통 기반)

태스크 ID 규칙: `WS-{워크스트림}-{순번}` (예: `WS-0-1`, `WS-3-2`)

- [x] `docs/DEEPSTOCK_REBRANDING_PLAN.md` 기준 태스크 번호 확정
- [x] 리네이밍 기준 사전 작성 (`docs/DEEPSTOCK_RENAME_MAP.md`)
- [x] 금지어 검사 스크립트 추가 (`scripts/check_branding_terms.ts`)
- [x] 금지어 검사 CI 단계 추가 (`.github/workflows/ci.yml`)

테스트
- [x] `npm run test`에 금지어 검사 포함
- [x] `npm run branding:check`로 baseline 결과 일치 검증

### WS-1 Runtime/Core/API (소유: `src/`, `app/api/`)

- [x] `package.json`/`package-lock.json` 프로젝트명 `deepstock-*`로 교체
- [x] 파이프라인 락 키 `legacy_brand:pipeline:*` -> `deepstock:pipeline:*`
- [x] User-Agent 문자열 `legacy_brand-research-only` -> `deepstock-research-only`
- [x] API/보안 코드 내 `LEGACY_BRAND_*` 레거시 fallback 제거
- [x] 신규 `DEEPSTOCK_*` 키 기준으로 auth/env 정리

테스트
- [x] 단위 테스트: auth/env 경로 (`scripts/env_checks.ts`) 갱신 후 통과
- [x] API 스모크: `/api/health`, `/api/agent/trigger`, `/api/agent/status`
- [x] 런타임 로그에서 `legacy_brand` 미출력 확인

검증 로그 (2026-02-13, WS-1):
- `npx tsx scripts/env_checks.ts` 통과
- `curl /api/health` 200, `POST /api/agent/trigger` 성공 응답, `GET /api/agent/status` 성공 응답 확인
- 런타임 로그 파일 내용 기준 금지어 미검출 확인

### WS-2 DB/Infra (소유: `docker-compose.yml`, `db/`, `.env*`)

- [x] DB 접속 문자열 기본값 `postgres://deepstock:deepstock@.../deepstock`로 변경
- [x] `docker-compose.yml`의 `POSTGRES_USER/PASSWORD/DB` 및 volume 이름 변경
- [x] DB migration 추가: 텍스트 컬럼/JSONB/배열 컬럼에 `legacy_brand` 문자열 일괄 치환 SQL
- [x] DB 검사 SQL/스크립트 추가: 전체 테이블 row 텍스트 기준 `ilike '%legacy_brand%'` 검사

테스트
- [x] 로컬 DB 재기동 테스트 (`npm run db:down && npm run db:up && npm run db:migrate`)
- [x] 데이터 무결성 검증: row count 전후 비교
- [x] DB 스캔 결과 `0건` 확인

### WS-3 DevOps Scripts/로컬 실행 (소유: `scripts/`)

- [x] `/tmp/legacy_brand-*` PID/로그 파일명 -> `/tmp/deepstock-*`
- [x] `launchctl` 임시 파일명/agent label에서 `legacy_brand` 제거
- [x] `dev_up/dev_down/dev_status/dev_local` 내부 env/문구 치환
- [x] GUI test script의 storage key/token key 치환

테스트
- [x] `npm run dev:up`, `npm run dev:status`, `npm run dev:down` 정상 동작
- [x] `npm run dev:local` 수동 트리거 기반 동작
- [x] 로그 파일 경로/파일명에 `legacy_brand` 부재 확인

### WS-4 Frontend/GUI (소유: `app/dashboard/`)

- [x] UI 텍스트(타이틀/도움말/설명) `LEGACY_BRAND` -> `DEEPSTOCK`
- [x] sessionStorage legacy key `legacy_brand_api_token` 제거/이관 정책 적용
- [x] 설정 페이지 예시 connection string 치환

테스트
- [x] 대시보드 전체 페이지 렌더링 테스트
- [x] `scripts/gui_quality_check.ts`, `scripts/gui_feature_check.ts` 통과
- [x] 브라우저 개발자도구 `sessionStorage` key 검증

### WS-5 Docs/예제/레퍼런스 (소유: `docs/`, `example/`)

- [x] `docs/*` 전체에서 `LEGACY_BRAND/legacy_brand` 치환
- [x] `example/LEGACY_BRAND-main` 폴더명 변경 계획 수립 (`example/deepstock-main`)
- [x] 파일명 `legacy_brand.svg`, `legacy_brand-harness.ts` 리네이밍 + 참조 경로 수정
- [x] 외부 링크/레퍼런스 텍스트도 deepstock 표기로 통일

테스트
- [x] 문서 링크 무결성 점검 (`rg 'LEGACY_BRAND|legacy_brand' docs example`)
- [x] 예제 코드 참조 경로 깨짐 여부 검증 (`rg 'example/LEGACY_BRAND-main'`)

### WS-6 CI/품질 게이트 (소유: `.github/workflows/ci.yml`, `scripts/`)

- [x] CI에 금지어 스캔 단계 추가
- [x] CI에 DB 문자열 스캔(옵션) 추가
- [x] 릴리즈 전 `branding-clean` 체크리스트 자동화

테스트
- [x] PR에서 `legacy_brand` 문자열 삽입 시 CI fail 확인
- [x] 모든 테스트/빌드 통과 시 CI green 확인

검증 로그 (2026-02-13, WS-2~WS-6):
- `rg -nI -i "\\u006d\\u0061\\u0068\\u006f\\u0072\\u0061\\u0067\\u0061" --hidden --glob '!.git' --glob '!node_modules' .` 결과 `0건`
- `npm run branding:clean` 통과 (`branding:check current_total=0`, `db branding scan passed`)
- DB 무결성: 재기동 전후 row count 동일  
  `before={"signals_raw":214,"signals_scored":195,"decisions":13,"daily_reports":1,"agent_runs":12,"kr_ticker_map":0}`  
  `after={"signals_raw":214,"signals_scored":195,"decisions":13,"daily_reports":1,"agent_runs":12,"kr_ticker_map":0}`
- dev scripts: `npm run dev:up`, `npm run dev:status`, `npm run dev:down`, `npm run dev:local` 정상 동작 확인
- GUI: `npm run test:gui`, `npm run test:gui:features` 단독 실행 기준 통과(스크립트 내 서버 자동 기동)
- API E2E: `/api/health`, `/api/agent/trigger`, `/api/agent/status`, `/api/agent/decisions`, `/api/agent/reports` 응답 확인
- KR 수동 실행: `POST /api/agent/trigger {"marketScope":"KR"}` -> `status:"success"`, `reportId:"1"` 확인
- CI fail 시뮬레이션: 임시 파일에 금지어 삽입 후 `branding:check` 실패(`fail_code=1`), 제거 후 재실행 통과(`pass_code=0`)

## 5. 소유권/경계 매트릭스

| Workstream | 소유 경로 | 비소유 경로 | 충돌 위험 |
|---|---|---|---|
| WS-0 Foundation | `docs/DEEPSTOCK_*`, `scripts/check_branding_terms.ts`, `.github/workflows/ci.yml` | `src/`, `app/` | 낮음 |
| WS-1 Runtime/Core/API | `src/`, `app/api/`, `package*.json` | `docs/`, `scripts/` | 중간 |
| WS-2 DB/Infra | `db/`, `.env*`, `docker-compose.yml` | `app/` | 높음 |
| WS-3 Scripts/DevOps | `scripts/` | `src/` | 중간 |
| WS-4 Frontend/GUI | `app/dashboard/` | `src/security/` | 중간 |
| WS-5 Docs/Example | `docs/`, `example/` | `src/` | 낮음 |
| WS-6 CI/Gate | `.github/workflows/`, `scripts/` | `app/` | 낮음 |

## 6. 병합 순서 (Merge Sequence)

- [x] M1: WS-0 Foundation 먼저 병합
- [x] M2: WS-2 DB/Infra 병합
- [x] M3: WS-1 Runtime/Core/API 병합
- [x] M4: WS-3 Scripts + WS-4 Frontend 병렬 병합
- [x] M5: WS-5 Docs/Example 병합
- [x] M6: WS-6 CI/게이트 최종 병합
- [x] M7: 통합 QA 및 태그/배포

## 7. 단계별 테스트 계획 (개발 구간별)

### T-1 사전 점검

- [x] `npm run branding:check` 기준 baseline 확보
- [x] DB row 텍스트 baseline 확보
- [x] baseline 파일 저장 (`docs/DEEPSTOCK_REBRANDING_BASELINE.md`)

### T-2 워크스트림 단위 검증

- [x] WS-1: `npm run test && npm run build`
- [x] WS-2: DB up/migrate + 데이터 검증
- [x] WS-3: `npm run dev:up/dev:status/dev:down`
- [x] WS-4: GUI 기능 테스트 스크립트 실행
- [x] WS-5: 문서 링크/참조 검사
- [x] WS-6: CI dry-run 또는 PR 검증

### T-3 통합 검증

- [x] API end-to-end: health, trigger, status, reports, decisions
- [x] KR 파이프라인 수동 실행 후 리포트 생성 확인
- [x] 런타임 로그/DB/파일 시스템에서 `legacy_brand` 0건 확인

### T-4 릴리즈 게이트

- [x] 최종 금지어 스캔 통과
- [x] 최종 회귀 테스트 통과
- [x] 운영 환경 변수(`DEEPSTOCK_*`) 반영 확인
- [x] 롤백 문서화 완료

## 8. 리스크 및 대응

- [x] 리스크: 레거시 env 키 제거로 운영 장애 가능
- [x] 대응: 배포 전 `.env` 검증 스크립트 + 필수 키 체크
- [x] 리스크: DB 접속정보/볼륨명 변경 시 데이터 유실
- [x] 대응: `pg_dump` 백업 -> 마이그레이션 -> 검증 -> 스위치
- [x] 리스크: 문서/예제 경로 변경으로 링크 깨짐
- [x] 대응: 경로 스캔 + CI 링크 체크

## 9. 진행 현황 보드

- [x] P0 분석/범위 파악 완료
- [x] P1 리네이밍 규칙 확정
- [x] P2 코드/DB/스크립트 리브랜딩 구현
- [x] P3 통합 테스트/회귀 테스트 완료
- [x] P4 배포 및 사후 검증 완료
