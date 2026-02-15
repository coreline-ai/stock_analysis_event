# DeepStock Research Engine

<div align="center">
  <img src="public/coreline-icon.svg" alt="Coreline" width="56" />
  <br />
  <strong>Coreline · Research-Only Stock Analysis Engine</strong>
  <br />
  <sub>브로커 주문 실행 없이 시그널 수집 · 점수화 · 판단 · 리포트 생성</sub>
</div>

<br />
<img width="1518" height="911" alt="스크린샷 2026-02-15 오후 4 40 31" src="https://github.com/user-attachments/assets/ae8d587e-e1d0-4c06-b93f-27a2ccaf7c50" />
<p align="center">

</p>

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
</div>

## 개요
DeepStock는 미국/한국 시장 데이터를 수집하고, 정량/이벤트/시장반응 신호를 점수화해 AI 판단과 리포트를 생성하는 **리서치 전용** 시스템입니다.

- 실거래 주문 기능 없음
- 수동 트리거 기반 실행(주기 스케줄 제거)
- 대시보드 중심 운영(`Signals`, `Decisions`, `Reports`, `Runs`)

## 핵심 기능
- 다중 소스 수집: Reddit, StockTwits, SEC, News, Naver, DART 등
- 파이프라인 처리: Gather → Normalize → Score → Decide → Report
- AI 판단: `BUY_NOW` / `WATCH` / `AVOID` + 신뢰도 + 보유 기간
- 시각화: 리스크 히트맵, 근거 시그널 그래프, 트리거 도달률
- 보호 장치: 실행 락, 하드 데드라인, 환경 변수 가드

## 시스템 구조
```text
app/                # Next.js 앱 라우트 + 대시보드 UI
app/api/            # API 엔드포인트
src/core/           # 파이프라인/도메인 로직
src/adapters/       # DB/LLM/외부 소스 어댑터
db/                 # DB 스키마/마이그레이션
scripts/            # 테스트/진단/운영 스크립트
```

## 빠른 시작
```bash
npm install
cp .env.example .env
# .env 값 채우기 (최소: DATABASE_URL, LLM_PROVIDER, provider API key)

npm run db:up
npm run db:migrate
npm run dev
```

기본 접속:
- 앱: `http://localhost:3000`
- 대시보드: `http://localhost:3000/dashboard`

## 필수 환경 변수
최소 실행 기준:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
LLM_PROVIDER=glm   # glm | openai | gemini

# provider별 키 중 하나 이상
GLM_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

주요 실행 설정:

```env
DEFAULT_MARKET_SCOPE=KR        # US | KR | ALL
DEFAULT_STRATEGY_KEY=kr_default
RUN_MAX_SECONDS=25
PIPELINE_PERSIST_RESERVE_MS=3500
MIN_SECONDS_BETWEEN_RUNS=120

API_TOKEN=CHANGE_ME_LONG_RANDOM
DEV_AUTH_BYPASS=true
```

참고: 전체 항목은 `.env.example`를 기준으로 관리합니다.

## 실행 방식
분석 실행은 API 또는 대시보드 버튼으로 수행합니다.

```bash
curl -X POST http://localhost:3000/api/agent/trigger \
  -H "Content-Type: application/json" \
  -H "x-api-token: $API_TOKEN" \
  -d '{"marketScope":"KR","strategyKey":"kr_default"}'
```

## 주요 API
| Endpoint | Method | 설명 |
|---|---|---|
| `/api/health` | `GET` | 헬스 체크 |
| `/api/agent/summary` | `GET` | 대시보드 요약 |
| `/api/agent/trigger` | `POST` | 분석 파이프라인 수동 실행 |
| `/api/agent/status` | `GET` | 실행 이력 조회 |
| `/api/agent/decisions` | `GET` | 판단 결과 조회 |
| `/api/agent/reports` | `GET` | 일일 리포트 조회 |
| `/api/agent/signals/raw` | `GET` | 원시 신호 조회 |
| `/api/agent/signals/scored` | `GET` | 점수 신호 조회 |
| `/api/agent/symbol-report` | `GET` | 개별 종목 리포트 |
| `/api/agent/symbols/resolve` | `GET` | 심볼 코드 해석 |
| `/api/agent/symbols/search` | `GET` | 심볼 검색 |

## 자주 쓰는 스크립트
```bash
npm run dev                 # 개발 서버
npm run dev:3333            # 개발 서버(3333)
npm run build               # 프로덕션 빌드
npm run start               # 프로덕션 실행
npm run lint                # 린트
npm test                    # 기본 테스트
npm run test:gui            # GUI 품질 테스트
npm run test:gui:features   # GUI 기능 테스트
npm run db:up               # 로컬 DB up
npm run db:down             # 로컬 DB down
npm run db:migrate          # 마이그레이션
```

## 운영 메모
- Research-only 모드로 브로커/트레이딩 관련 env가 감지되면 실행을 차단합니다.
- 실행 중복 방지를 위해 DB 기반 lock(`pipeline_locks`)을 사용합니다.
- 긴 실행 방지를 위해 파이프라인/스테이지 타임박스를 적용합니다.

## 문제 해결
- `db_error(...)`: `DATABASE_URL`/DB 프로세스/마이그레이션 상태 확인
- `missing_env`: 필수 env 누락 (`DATABASE_URL`, `LLM_PROVIDER`, provider key)
- `unauthorized`: `x-api-token` 또는 `API_TOKEN` 불일치
- `forbidden_env`: 금지된 거래 관련 env 제거 필요

## 라이선스
MIT License. 자세한 내용은 `LICENSE`를 참고하세요.
