# Conceptual Schema (Draft)
## DEEPSTOCK Research-Only 데이터 모델 (문서 기준 스키마)

본 문서는 "DB migrations 작성 전" 단계에서
데이터 모델을 합의/고정하기 위한 개념 스키마이다.

- 컬럼/타입은 MVP 진행에 따라 변경될 수 있다.
- 단, 엔티티의 역할/관계는 유지한다.
- 원본 DEEPSTOCK(reference) 코드 분석 이후 확정한다.

---

## 1. 엔티티 목록

- signals_raw
- signals_scored
- decisions
- daily_reports
- agent_runs

---

## 2. signals_raw (원천 수집 데이터)

목적:
- 공개 소스에서 가져온 원문/메타데이터를 보관
- 재현성 및 디버깅 목적

주요 필드(개념):
- id
- source (reddit | stocktwits | news | etc)
- external_id (소스 고유 ID)
- symbol_candidates (추출된 티커 후보)
- title
- body
- url
- author (가능 시)
- published_at
- collected_at
- engagement (likes/upvotes/replies 등 가능 시)
- raw_payload (원본 JSON/HTML 파싱 결과 일부)

인덱스(개념):
- (source, external_id) unique
- collected_at
- published_at

---

## 3. signals_scored (정규화/스코어링 결과)

목적:
- 판단 단계의 입력으로 사용할 정규화/랭킹 결과 저장

주요 필드(개념):
- id
- raw_id (signals_raw 참조)
- symbol (정규화 티커)
- sentiment_score
- freshness_score
- source_weight
- final_score
- reason_summary (스코어링 근거 요약)
- scored_at

인덱스(개념):
- symbol
- final_score desc
- scored_at

---

## 4. decisions (핵심 산출물: 시점 판단)

목적:
- BUY_NOW / WATCH / AVOID 판단 및 근거 저장
- 실제 주문 실행은 절대 포함하지 않음

주요 필드(개념):
- id
- symbol
- verdict (BUY_NOW | WATCH | AVOID)
- confidence
- time_horizon (intraday | swing | long_term)
- thesis_summary
- entry_trigger
- invalidation
- risk_notes (array/json)
- bull_case (array/json)
- bear_case (array/json)
- red_flags (array/json)
- catalysts (array/json)
- sources_used (signals_scored id 목록)
- llm_model
- prompt_version
- schema_version
- created_at

인덱스(개념):
- created_at
- verdict
- symbol

---

## 5. daily_reports (데일리 리포트)

목적:
- 하루 단위 요약/테마/리스크를 저장
- 대시보드 및 export의 기본 단위

주요 필드(개념):
- id
- report_date (YYYY-MM-DD)
- summary_markdown (또는 summary_json)
- top_buy_now (결정 id 목록)
- top_watch (결정 id 목록)
- themes (array/json)
- risks (array/json)
- created_at

인덱스(개념):
- report_date unique

---

## 6. agent_runs (실행 이력)

목적:
- 실행 단위의 성공/실패/처리량/비용 추적

주요 필드(개념):
- id
- trigger_type (manual, legacy 데이터에 cron이 존재할 수 있음)
- started_at
- finished_at
- status (success | partial | failed)
- gathered_counts (json)
- scored_count
- decided_count
- llm_calls
- llm_tokens_estimated
- error_summary
- created_at

인덱스(개념):
- started_at
- status

---

## 7. 관계 요약

- signals_raw 1:N signals_scored
- decisions N:M signals_scored (sources_used로 연결)
- daily_reports 1:N decisions (top lists로 연결)
- agent_runs 1:N (signals_scored / decisions / daily_reports 생성 결과를 간접 참조)

---

## 8. 다음 단계

- reference/DEEPSTOCK-original 코드 분석을 통해
  - 실제 필요한 필드
  - 필드 명칭/타입
  - 인덱스
  를 확정한다.

- 확정 이후:
  - db/migrations/에 실제 마이그레이션 파일 생성
  - 본 문서는 “설계 기록”으로 유지
