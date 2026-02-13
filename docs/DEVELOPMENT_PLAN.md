# DEEPSTOCK Research-Only (Vercel) 개발 계획
## Implementation Plan (Milestones / PR Breakdown / Checklist)

---

## 0. 계획의 범위

본 개발 계획은 다음을 전제로 한다:

- 대상: 기존 DEEPSTOCK를 리팩토링하여 Research-Only Signal & Timing Engine으로 전환
- 배포: Vercel (프론트 + API Routes, 수동 트리거 전용)
- 금지: 실제 매매 자동화(주문 실행)는 어떤 형태로도 포함하지 않음
- 목표: “지금 사야 할 시점(BUY_NOW 등)” 판단 + 근거 + 리포트 + 대시보드 제공

본 문서는 일정/작업 단위/PR 분할/검증 체크리스트를 제공한다.

---

## 1. 최상위 마일스톤 (M0~M5)

- M0: 리포지토리/환경/기반 인프라 준비
- M1: 데이터 모델/저장소/인증 토큰 기반 API 뼈대
- M2: Gather + Normalize + Score 파이프라인 이식
- M3: Decision Engine(LLM) + 스키마 검증 + 저장
- M4: Manual Trigger Runner + Lock + 타임박스 + 비용상한
- M5: 대시보드(UI) + 운영 관측 + 안정화

---

## 2. PR 단위 개발 계획 (권장)

각 PR은 “작고 검증 가능한 단위”로 쪼개며, PR마다 완료 기준(DoD)을 둔다.

---

### PR-001: Vercel 프로젝트 부팅 + 기본 라우팅
목표:
- Next.js 프로젝트 생성 및 배포 파이프라인 준비
- 기본 API 라우트 및 health 확인

작업:
- Next.js 앱 셋업 (App Router 또는 Pages Router 중 1개 확정)
- /api/health 엔드포인트 추가
- 기본 환경변수 로딩 체계 추가

완료 기준(DoD):
- Vercel에 배포 성공
- /api/health가 200 응답
- 로컬 개발 서버에서 동일 동작

---

### PR-002: 인증(토큰) 미들웨어 + 보안 스캐폴딩
목표:
- 외부 호출 엔드포인트 보호
- 수동 트리거 호출 보호 기반 마련

작업:
- API 토큰 검증 유틸 구현
- 인증 실패 시 표준 에러 응답 정의

완료 기준(DoD):
- 토큰 없으면 401
- 토큰 있으면 정상
- 수동 트리거 엔드포인트는 토큰 없으면 401

---

### PR-003: DB(Postgres) 연결 + 마이그레이션 프레임
목표:
- D1 대체 영속 저장소 확정
- 마이그레이션 및 로컬 실행 가능 상태

작업:
- DATABASE_URL 기반 DB 연결
- 마이그레이션 도구 선택 (SQL migrations 또는 Prisma 등)
- 최소 테이블 생성:
  - signals_raw
  - signals_scored
  - decisions
  - daily_reports
  - agent_runs

완료 기준(DoD):
- 로컬/배포 환경에서 테이블 생성 가능
- DB 연결 실패 시 명확한 에러
- 간단한 insert/select smoke test 통과

---

### PR-004: Redis(Upstash 등) 연결 + 분산 락 구현
목표:
- 중복 실행 방지 기반 마련

작업:
- Redis REST 클라이언트 연결
- 락 유틸 구현 (key, ttl, acquire, release)
- 락 획득 실패 시 graceful exit

완료 기준(DoD):
- 동일 key에 대해 동시 실행 시 1개만 획득
- TTL 만료로 자동 해제 확인
- 락 장애 시 fallback 정책(실행 중지/경고) 명시

---

### PR-005: Core Pipeline 골격 분리 (플랫폼 독립 영역)
목표:
- 기존 DEEPSTOCK 로직을 “Core Pipeline”로 분리할 틀 마련

작업:
- src/core/pipeline.ts 생성
- gather/normalize/score/decide/report 단계 인터페이스 정의
- Storage/LLM/Lock은 adapter 인터페이스로 분리

완료 기준(DoD):
- Core Pipeline이 Vercel/Cloudflare 의존 없이 컴파일
- 테스트 스켈레톤(단위 테스트 자리) 생성

---

### PR-006: Gather 모듈 이식 (공개 소스 기반)
목표:
- Reddit/StockTwits/뉴스 등 공개 소스 수집

작업:
- gather_reddit, gather_stocktwits, gather_news 함수 이식/작성
- signals_raw 저장
- 요청 실패/파싱 실패 예외 처리
- 중복 제거 키 전략 정의 (source + external_id + timestamp 등)

완료 기준(DoD):
- 수집 실행 시 signals_raw에 데이터가 쌓임
- 실패 시 agent_runs에 오류 기록
- 동일 입력 반복 시 중복이 폭증하지 않음

---

### PR-007: Normalize + Score 모듈 이식
목표:
- SOURCE_CONFIG 기반 가중치/신선도/감성 반영 점수 생성

작업:
- symbol 정규화 규칙 정의
- freshness 계산
- source_weight 적용
- 최종 score 계산
- signals_scored 저장

완료 기준(DoD):
- 상위 N개 시그널 조회 가능
- 스코어가 일관되게 계산됨
- 스코어링 파라미터는 설정 파일로 분리

---

### PR-008: LLM Adapter + Decision 스키마 검증
목표:
- LLM 호출을 어댑터로 캡슐화
- Decision 출력 스키마를 강제 검증

작업:
- LLM Provider 인터페이스 정의
- 모델/온도/토큰 제한 파라미터 정의
- Decision 스키마 검증(예: zod)
- 실패 시 1회 재시도 정책(선택)

완료 기준(DoD):
- LLM 응답이 스키마 미준수 시 reject 처리
- 스키마 준수 응답은 decisions 테이블 저장 가능
- 프롬프트 버전/스키마 버전 기록 가능

---

### PR-009: Decision Engine(핵심) 연결
목표:
- “지금 사야 할 시점” 판단 생성

작업:
- verdict: BUY_NOW | WATCH | AVOID
- confidence, time_horizon, thesis_summary, entry_plan 포함
- sources_used로 입력 시그널 연결
- decisions 저장
- 실패/부분 실패 정책 적용

완료 기준(DoD):
- 상위 N개 종목에 대해 decisions 생성
- Decision마다 사용한 signals_scored 레코드 연결
- 부분 실패가 전체 실패로 번지지 않음

---

### PR-010: Daily Report 생성
목표:
- 데일리 리포트 생성 및 저장

작업:
- 오늘의 BUY_NOW/WATCH 요약
- 테마/공통 리스크 요약
- daily_reports 저장 (JSON + markdown 둘 중 1개 또는 둘 다)

완료 기준(DoD):
- date 기준 리포트 조회 가능
- 리포트가 decisions 기반으로 재현 가능

---

### PR-011: Manual Trigger 엔드포인트 + 타임박스 + 비용 상한
목표:
- 수동 실행 경로 완성
- 서버리스 시간 제한 고려

작업:
- /api/agent/trigger 엔드포인트 구현/강화
- API 토큰 검증
- 락 획득 후 실행
- 타임박스: 최대 처리량 N, 최대 실행 단계 제한
- 비용 상한: 실행당 LLM 호출 수 제한
- agent_runs에 실행 결과 기록

완료 기준(DoD):
- 사용자 트리거 호출로 gather→score→decide→report가 실행됨
- 중복 실행 방지 동작
- 시간/비용 제한 초과 시 graceful stop + 기록

---

### PR-012: /api/agent/status + 조회 API 완성
목표:
- 대시보드가 붙을 API 완성

작업:
- /api/agent/status: 최신 실행, BUY_NOW top, WATCH, 최신 리포트
- /api/agent/decisions: 날짜/심볼 필터
- /api/agent/reports: 날짜 조회
- /api/agent/trigger: 수동 실행(토큰 보호)

완료 기준(DoD):
- 대시보드 구현 없이도 API로 핵심 정보 확인 가능
- 인증 없는 접근 차단

---

### PR-013: 대시보드 UI (MVP)
목표:
- 리서치 결과 소비 UX 제공

작업:
- 메인: BUY_NOW 리스트(신뢰도/요약/트리거/리스크)
- WATCH 리스트
- 종목 상세: 히스토리 + 근거 + 입력 시그널
- 데일리 리포트 화면

완료 기준(DoD):
- 웹에서 핵심 정보만으로 “오늘 볼 것” 결정 가능
- 링크/필터/검색 최소 제공

---

### PR-014: 알림(선택) + 운영성 강화
목표:
- BUY_NOW 발생 시 알림
- 운영 관측 강화

작업:
- Discord/Slack/Email 중 1개 선택
- 알림 정책: BUY_NOW만, 또는 confidence 임계치 이상만
- run 실패/성공 요약 알림(선택)

완료 기준(DoD):
- BUY_NOW 발생 시 알림 1회
- 중복 알림 방지 정책 존재

---

### PR-015: 안정화/정리 (Refactor Pass)
목표:
- 유지보수 가능한 구조 확정

작업:
- 모듈 경계 재정리
- 설정 파라미터 문서화
- 로깅/에러 응답 표준화
- 테스트 추가 (핵심 로직 위주)

완료 기준(DoD):
- 핵심 파이프라인 단위 테스트 최소 5개 이상
- 설정 변경만으로 상위 N, 모델, 임계치 조정 가능

---

## 3. 필수 설정(환경 변수) 체크리스트

- DATABASE_URL
- LLM_API_KEY (공급자에 맞는 키)
- DEEPSTOCK_API_TOKEN
- REDIS_URL / REDIS_TOKEN (또는 Upstash 주입 값)

금지(존재하면 실패):
- 브로커/주문 관련 키/시크릿

---

## 4. MVP 정의 (가장 작은 완료 기준)

MVP는 다음이 완료되면 달성으로 본다:

- 사용자 수동 트리거로 필요 시 파이프라인 수행
- signals_raw와 signals_scored 저장
- BUY_NOW/WATCH/AVOID decisions 생성 및 저장
- daily_reports 생성 및 저장
- /api/agent/status로 핵심 결과 조회 가능
- 실제 매매 실행 경로가 존재하지 않음

---

## 5. 리스크 및 대응

- 공개 소스 수집은 차단/포맷 변경 위험이 있다
  - 대응: 소스별 파서 분리, 실패 허용, 소스 교체 가능 구조
- 서버리스 실행 시간 제한이 있다
  - 대응: 타임박스, 처리량 제한, 단계별 부분 실행
- 중복 실행 시 LLM 비용 폭주 위험
  - 대응: 분산 락 + 호출 상한 + 실행 이력 기록

---

## 6. 산출물 목록

- REFACTORING_PLAN.md (기획서, 이미 작성)
- PRD.md
- TRD.md
- DEVELOPMENT_PLAN.md (본 문서)
- .env.example
- DB migrations
- API 스펙(추후)

---

## 7. 다음 액션

- PR-001부터 순서대로 진행
- PR-003(DB)와 PR-004(Redis)는 병렬 가능
- PR-006~PR-010은 파이프라인 구현 단계로 집중
- PR-011에서 수동 트리거 경로 완성 후 UI로 이동
