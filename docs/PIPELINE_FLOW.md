# Pipeline Flow (Input/Output)

본 문서는 파이프라인 단계별 입력/출력 타입과 변환 규칙을 요약한다.

## 1) Gather

- 입력: 없음
- 출력: `SignalRaw[]`
- 규칙:
  - `source + external_id` 조합이 유일해야 한다.
  - `symbol_candidates`는 텍스트 기반 후보 리스트를 포함한다.

## 2) Normalize

- 입력: `SignalRaw[]`
- 출력: `NormalizedSignal[]`
- 규칙:
  - 텍스트에서 티커 후보를 추출하고 블랙리스트/형식 검증을 통과해야 한다.
  - SEC 티커 캐시 기반으로 유효 심볼만 통과한다.
  - `(raw_id, symbol)` 중복은 제거한다.

## 3) Score

- 입력: `NormalizedSignal[]`
- 출력: `SignalScored[]`
- 규칙:
  - `sentiment`, `freshness`, `source_weight`로 `final_score` 계산
  - 상위 `SCORE_TOP_N`만 이후 단계로 전달

## 4) Decide

- 입력: `SignalScored[]`
- 출력: `Decision[]`
- 규칙:
  - LLM 호출 제한(`LLM_MAX_*`)과 타임박스(`RUN_MAX_SECONDS`) 적용
  - 스키마 검증 실패 시 재시도 1회
  - 결정은 `BUY_NOW | WATCH | AVOID` 중 하나

## 5) Report

- 입력: `Decision[]`
- 출력: `DailyReport`
- 규칙:
  - BUY_NOW/WATCH 요약, 리스크/테마 섹션 포함
