# 🇰🇷 한국 주식 시장 통합 설계 문서

현재 시스템은 미국 주식/코인 전용으로 구축되어 있다. 본 문서는 기존 파이프라인 아키텍처를 유지하면서 **한국 주식(KOSPI/KOSDAQ)** 지원을 추가하기 위한 구체적인 설계 계획이다.

> [!IMPORTANT]
> **설계 원칙**: 기존 미국 파이프라인은 전혀 건드리지 않는다. 한국 전용 모듈을 **병렬로 추가**하고, 공통 인터페이스([SignalRaw](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts#3-17), [SignalScored](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts#18-29), [Decision](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts#32-52))를 그대로 사용한다.

## 2026-02-11 무료 한국 소스 확정안

- 한경 컨센서스: 로그인 없이 접근 가능한 무료 리포트/기사 기반 신호 수집 (`kr_research`)
- 증권플러스/팍스넷/씽크풀: 커뮤니티 심리 신호 수집 (`kr_community`)
- 인베스팅닷컴 코리아: 환율/야간선물/거시 맥락 신호 수집 (`kr_global_context`)
- 인포맥스: 유료 단말/서비스 기반이므로 본 구축 범위에서 제외
- 구현 원칙: 유료 API 미사용, 공개 페이지 또는 공개 RSS/기사 인덱스 기반 수집만 허용

## 2026-02-11 구현 반영 상태

- `kr_research`, `kr_community`, `kr_global_context` 수집기 반영 완료
- KR source 분기/가중치/정규화/대시보드 라벨 반영 완료
- KR 종목명 캐시(`kr_ticker_cache`) 및 프롬프트/리포트 종목명 표기 반영 완료
- Hybrid Quant-Social 반영 완료:
  - Soft scoring: 퀀트 승수(`quantMultiplier`) 적용
  - Hard filter: 거래량/수급 미충족 시 `BUY_NOW -> WATCH` 자동 강등
- 강화 수식/조건 반영 완료:
  - 삼관왕 레이어 강제: `social>=0.7`, `event>=0.5`, `hardFilter(volume/flow/technical)` 모두 충족 시 `tripleCrown=true`
  - 강화 하드게이트: `BUY_NOW`는 `tripleCrown` 및 가드 조건 충족 시에만 허용
  - Contextual Risk 반영: `52주 고점/과열/매도우위` 신호를 `contextRiskScore`로 정량화해 soft scoring 감쇠
- KR 실효성 보강 완료:
  - KR 종목명 기반 티커 추출(`삼성전자` -> `005930`) 추가
  - `signals/raw`, `signals/scored` API `scope=US|KR` 필터 정합성 보강
- GUI 반영 완료:
  - Signals 화면에서 `scope` 필터로 KR/US 데이터를 분리 탐색
  - 하이브리드 핵심 지표(`quant/hardFilter/tripleCrown`)를 테이블/상세 패널에 구조화 표시
- 런타임 안정화 반영 완료:
  - KR 실행 시 `DART_API_KEY` 미설정이면 DART 소스만 스킵하고 나머지 무료 소스로 계속 실행
  - `signals/scored` 조회에서 하이브리드 필드 존재 레코드를 우선 노출해 GUI 상세 지표 일관성 보강

---

## 현재 아키텍처 요약

```mermaid
graph LR
    A["Gather<br/>(5개 소스)"] --> B["Normalize<br/>(티커 추출/검증)"]
    B --> C["Score<br/>(감정×신선도×가중치)"]
    C --> D["Decide<br/>(LLM 판단)"]
    D --> E["Report<br/>(데일리 리포트)"]
```

| 단계 | 미국 전용 의존성 | 한국 적용 시 변경 필요 |
|---|---|---|
| Gather | Reddit, StockTwits, SEC, News, Crypto | ✅ 한국 소스 추가 필요 |
| Normalize | 영문 2~5자 티커, SEC 목록 검증 | ✅ 숫자 6자리 코드, KRX 목록 검증 |
| Score | 영어 감정 키워드 | ✅ 한글 감정 키워드 추가 |
| Decide | LLM 프롬프트 (영문, 미국 시장 맥락) | ✅ 한국 시장 맥락 프롬프트 |
| Report | 영문 템플릿 | ✅ 한글 템플릿 |

---

## Proposed Changes

### 1단계: Gather — 한국 데이터 소스 추가

#### [NEW] [naver_stock.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/naver_stock.ts)

**네이버 증권 인기 종목 + 뉴스 수집기**

네이버 증권은 한국 투자자가 가장 많이 사용하는 플랫폼이다. 공개적으로 접근 가능한 엔드포인트를 활용한다.

- **수집 대상**:
  - 인기 검색 종목 (실시간 검색 순위)
  - 종목 토론방 (종토방) 인기 글
  - 종목 뉴스 (네이버 금융 뉴스 RSS)
- **수집 방식**: HTML 스크래핑 또는 비공식 JSON 엔드포인트
- **출력**: [SignalRaw](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts#3-17) (기존 인터페이스 그대로 사용)
- **필드 매핑**:
  ```
  source: "naver"
  externalId: "naver_{종목코드}_{글ID}"
  symbolCandidates: ["005930"]  ← 6자리 숫자 코드
  title: 글 제목 (한글)
  body: 글 본문 (한글)
  engagement: { views: 1234, likes: 56, comments: 78 }
  rawPayload: { market: "kospi", stockName: "삼성전자" }
  ```

> [!WARNING]
> 네이버는 비공식 API이므로 구조 변경 위험이 있다. User-Agent 설정과 요청 간격(1~2초) 조절 필수. 과도한 요청 시 IP 차단 가능성 있음.

---

#### [NEW] [krx_disclosure.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/krx_disclosure.ts)

**KRX/DART 공시 수집기** (SEC EDGAR의 한국 버전)

- **수집 대상**: 주요 공시 (매출 공시, 대주주 변동, 유상증자, 자사주 매입 등)
- **데이터 소스**: **DART OpenAPI** (`https://opendart.fss.or.kr`)
  - API 키 필요 (무료 발급, 일일 10,000회)
  - REST API, JSON 응답
  - 환경변수: `DART_API_KEY`
- **출력**: [SignalRaw](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts#3-17)
- **필드 매핑**:
  ```
  source: "dart"
  externalId: "dart_{공시번호}"
  symbolCandidates: ["005930"]
  title: "삼성전자 - 매출액 또는 손익구조 30% 이상 변동"
  rawPayload: { reportType: "주요사항보고서", corpName: "삼성전자" }
  ```

> [!NOTE]
> DART OpenAPI는 한국의 SEC EDGAR에 해당하는 **공식 정부 API**이다. SEC `company_tickers.json`처럼 **전체 상장사 목록 API**도 제공한다 (`/api/corpCode.xml`). 이를 KRX 티커 캐시로 활용할 수 있다.

---

#### [NEW] [kr_community.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/kr_community.ts)

**한국 투자 커뮤니티 수집기**

- **수집 대상**: 인기 종목 토론 및 심리 데이터
- **세부 소스**:
  1. **네이버 종토방**: 가장 높은 트래픽, 스크래핑 기반
  2. **팍스넷(Paxnet) & 씽크풀(ThinkPool)**: 전통의 종토방, 밈 주식/급등주 심리 파악 용이
  3. **증권플러스(두나무)**: 소셜 투표(상승/하락 예상) 데이터 수집 → **투자 심리 지표**로 활용
- **출력**: `SignalRaw`

---

#### [NEW] [kr_research.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/kr_research.ts)

**한국 증권사 리포트 요약 수집기**

- **데이터 소스**: **한경 컨센서스 (Hankyung Consensus)**
- **특징**: 로그인 없는 **100% 무료** 고품질 텍스트 데이터
- **수집 방식**: 리포트 목록 스크래핑 및 주요 요약문(Summary) 추출
- **가중치**: 전문가 의견이므로 0.90 이상의 높은 가중치 부여

---

#### [NEW] [kr_global_context.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/kr_global_context.ts)

**글로벌 매크로 맥락 수집기**

- **데이터 소스**: **인베스팅닷컴 코리아 (Investing.com KR)**
- **수집 대상**: 
  - 야간 선물 지수 (한국 시장 개장 전 영향도)
  - 원/달러 환율 추이
  - 외국인이 보는 한국 시장 토론
- **활용**: 한국 종목의 'Decide' 단계에서 거시 경제 맥락으로 LLM에게 전달

---

#### [NEW] [kr_news.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/kr_news.ts)

**한국 금융 뉴스 수집기**

- **수집 대상**: 주식/경제 뉴스
- **데이터 소스**:
  - 네이버 금융 뉴스 RSS (`https://news.naver.com` 경제 섹션)
  - 한국경제/매일경제 RSS (공개)
- **수집 방식**: RSS XML 파싱 (현재 [news.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/news.ts)의 [parseRssItems](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/news.ts#7-23) 재사용 가능)
- **검색 키워드**: `"주식 시장"`, `"실적 발표"`, `"상장"`, `"공시"` 등

---

#### [MODIFY] [index.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/index.ts)

[runGather()](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/gather/index.ts#14-43) 함수에 한국 소스 4개 추가 등록:

```diff
 const tasks = [
   { name: "reddit", fn: () => gatherReddit(25) },
   { name: "stocktwits", fn: () => gatherStockTwits(15) },
   { name: "sec", fn: () => gatherSecEdgar(20) },
   { name: "news", fn: () => gatherNews(20) },
-  { name: "crypto", fn: () => gatherCrypto() }
+  { name: "crypto", fn: () => gatherCrypto() },
+  { name: "naver", fn: () => gatherNaver(20) },
+  { name: "dart", fn: () => gatherDart(20) },
+  { name: "kr_community", fn: () => gatherKrCommunity(20) },
+  { name: "kr_news", fn: () => gatherKrNews(20) }
 ];
```

#### [MODIFY] [types.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts)

[SignalSource](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/domain/types.ts#1-2) 타입에 한국 소스 추가:

```diff
-export type SignalSource = "reddit" | "stocktwits" | "sec" | "news" | "crypto";
+export type SignalSource = "reddit" | "stocktwits" | "sec" | "news" | "crypto"
+  | "naver" | "dart" | "kr_community" | "kr_news";
```

---

### 2단계: Normalize — 한국 종목코드 지원

#### [NEW] [kr_symbol_map.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/normalize/kr_symbol_map.ts)

**한국 종목코드 정규화 모듈**

미국 티커(`AAPL`)와 한국 종목코드(`005930`)는 포맷이 완전히 다르므로 별도 모듈이 필요하다.

- **정규화 규칙**:
  ```
  ✅ 통과: 숫자 6자리 (예: 005930, 035420)
  ❌ 차단: 6자리가 아닌 숫자, 순수 영문
  ```
- **추출 규칙**: 한글 텍스트에서 종목코드/종목명 추출
  ```
  패턴 A: "삼성전자(005930)" → 괄호 안 6자리 숫자
  패턴 B: "005930" → 독립된 6자리 숫자
  패턴 C: "삼성전자" → 종목명 → KRX 캐시에서 코드로 변환
  ```
- **블랙리스트**: 한국 맥락의 오탐 방지
  ```
  숫자 블랙리스트: 전화번호 패턴, 날짜 패턴, 금액 패턴 등
  종목명 블랙리스트: "한국", "증권", "투자" 등 일반 명사
  ```

---

#### [NEW] [kr_ticker_cache.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/normalize/kr_ticker_cache.ts)

**KRX/DART 종목 목록 캐시** (SEC [ticker_cache.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/normalize/ticker_cache.ts)의 한국 버전)

- **데이터 소스**: DART OpenAPI `/api/corpCode.xml` 또는 KRX `data.krx.co.kr`
- **캐싱 전략**: 24시간 캐시 (현재 SEC 캐시와 동일)
- **저장 구조**:
  ```typescript
  // 코드 → 이름 양방향 매핑
  Map<string, string>  // "005930" → "삼성전자"
  Map<string, string>  // "삼성전자" → "005930"
  Set<string>          // 유효 코드 집합
  ```
- **검증 함수**: `isKnownKrxTicker(code: string): boolean`

---

#### [MODIFY] [index.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/normalize/index.ts)

[normalizeSignals()](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/normalize/index.ts#15-47) 함수에 한국 소스 분기 추가:

```diff
 for (const candidate of candidates) {
-  const symbol = normalizeSymbol(candidate);
-  if (!symbol) continue;
-  if (raw.source !== "crypto" && !isKnownSecTicker(symbol)) continue;
+  // 한국 소스인 경우 한국 정규화 로직 사용
+  const isKrSource = ["naver","dart","kr_community","kr_news"].includes(raw.source);
+  const symbol = isKrSource
+    ? normalizeKrSymbol(candidate)
+    : normalizeSymbol(candidate);
+  if (!symbol) continue;
+  if (isKrSource && !isKnownKrxTicker(symbol)) continue;
+  if (!isKrSource && raw.source !== "crypto" && !isKnownSecTicker(symbol)) continue;
```

---

### 3단계: Score — 한글 감정 분석

#### [NEW] [sentiment_kr.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/score/sentiment_kr.ts)

**한글 감정 키워드 사전**

현재 영어 감정 분석([sentiment.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/score/sentiment.ts))과 동일한 키워드 매칭 방식을 한글로 확장한다.

```typescript
// 긍정 (Bullish) 키워드
const KR_BULLISH = [
  "급등", "상한가", "대박", "폭등", "돌파", "신고가", "매수",
  "상승", "호재", "실적 개선", "턴어라운드", "저평가",
  "외국인 매수", "기관 매수", "수급 양호", "목표가 상향",
  "바닥", "반등", "갭상승", "양봉"
];

// 부정 (Bearish) 키워드
const KR_BEARISH = [
  "급락", "하한가", "폭락", "손절", "매도", "하락", "악재",
  "실적 악화", "고평가", "외국인 매도", "기관 매도",
  "수급 악화", "목표가 하향", "물타기", "음봉", "깡통",
  "반대매매", "공매도"
];
```

- **적용 범위**: `source`가 한국 소스(`naver`, `dart`, `kr_community`, `kr_news`)인 경우에만 한글 사전 사용
- **기존 영어 사전은 그대로 유지** (미국 소스용)

#### [MODIFY] [sentiment.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/score/sentiment.ts)

기존 [detectSentiment](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/score/sentiment.ts#1-42)를 언어 감지 후 분기하도록 수정:

```diff
+import { detectSentimentKr } from "./sentiment_kr";
+
 export function detectSentiment(text: string): number {
+  // 한글이 포함되어 있으면 한글 감정 분석 사용
+  if (/[가-힣]/.test(text)) return detectSentimentKr(text);
   const lower = text.toLowerCase();
   // ... 기존 영어 로직 유지
```

#### [MODIFY] [source_config.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/config/source_config.ts)

한국 소스별 가중치 추가:

```diff
 weights: {
   stocktwits: 0.85,
   // ... 기존 미국 소스 유지
+  naver: 0.70,           // 네이버 증권 (종토방 = 노이즈 높음)
+  dart: 0.95,            // DART 공시 (공식, SEC 수준)
+  kr_community: 0.55,    // DC갤 등 커뮤니티 (노이즈 매우 높음)
+  kr_news: 0.80,         // 한경/매경 뉴스
 },
```

---

### 4단계: Decide — LLM 프롬프트 한국 시장 맥락 추가

#### [MODIFY] [prompts.ts](file:///Users/hwanchoi/projects/stock_analysis_event/src/core/pipeline/stages/decide/prompts.ts)

종목이 한국 종목인지(6자리 숫자) 감지하여 프롬프트를 분기한다.

**한국 전용 프롬프트 추가 요소**:

```
System 프롬프트 변경:
"You are a Korean stock market research analyst.
 Analyze Korean market signals considering:
 - KRX trading hours (09:00-15:30 KST)
 - Foreign investor flow (외국인 수급)
 - Institutional investor flow (기관 수급)
 - KOSPI/KOSDAQ market characteristics
 - Korean regulatory environment (금융위, 공매도 규제 등)
 Output valid JSON only. Respond in Korean."

User 프롬프트 변경:
"SYMBOL: 005930 (삼성전자)
 MARKET: KOSPI
 SIGNALS:
 score=0.85 DART 공시: 매출 30% 증가 공시
 score=0.72 네이버 종토방: 외국인 매수세 강화
 ...
 Return JSON with verdict, confidence, thesis (한글), risks..."
```

> [!NOTE]
> 한국 종목은 `symbol`이 `005930`처럼 숫자 6자리이므로, 프롬프트에 **종목명**(`삼성전자`)도 함께 표시해야 LLM이 맥락을 이해할 수 있다. 이를 위해 `kr_ticker_cache`의 코드→이름 매핑을 활용한다.

---

### 5단계: Report — 한글 리포트 템플릿

#### [MODIFY] Report 생성 로직

- 한국 종목이 포함된 경우 리포트 섹션을 한글로 생성
- `topBuyNow`에 한국 종목이 있으면 종목명도 함께 표시
  - 예: `005930 (삼성전자)` vs `AAPL`
- 한국 시장 특화 섹션 추가 가능:
  - 외국인/기관 수급 동향
  - KOSPI/KOSDAQ 시장 구분

---

### 6단계: 환경변수 및 설정

#### [MODIFY] [.env.example](file:///Users/hwanchoi/projects/stock_analysis_event/.env.example)

```diff
+# -------------------------
+# Korean Market Sources (OPTIONAL)
+# -------------------------
+# DART 공시 API (https://opendart.fss.or.kr)
+DART_API_KEY=
+
+# 한국 소스 활성화 (기본: false)
+KR_MARKET_ENABLED=false
+
+# 네이버 증권 수집 활성화
+NAVER_ENABLED=true
+
+# 한국 커뮤니티 수집 활성화
+KR_COMMUNITY_ENABLED=false
```

---

### 7단계: DB 마이그레이션

#### [NEW] [002_kr_market.sql](file:///Users/hwanchoi/projects/stock_analysis_event/db/migrations/002_kr_market.sql)

기존 DB 스키마는 `symbol TEXT` 필드를 사용하므로, 한국 종목코드(`"005930"`)도 문자열로 저장 가능하다. **스키마 변경은 최소화**한다.

```sql
-- 한국 종목코드-종목명 매핑 캐시 테이블
CREATE TABLE IF NOT EXISTS kr_ticker_map (
  code TEXT PRIMARY KEY,          -- "005930"
  name TEXT NOT NULL,             -- "삼성전자"
  market TEXT NOT NULL,           -- "KOSPI" | "KOSDAQ"
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kr_ticker_map_name ON kr_ticker_map (name);

-- signals_raw.source에 한국 소스 추가 (기존 TEXT 타입이므로 변경 불필요)
-- decisions/signals_scored.symbol도 TEXT이므로 숫자 코드 저장 가능
```

> [!TIP]
> 기존 테이블 구조가 `TEXT` 기반이라 한국 종목코드를 수용하기 위한 스키마 변경이 거의 없다. 이는 설계가 잘 된 부분이다.

---


## [NEW] Hybrid Quant-Social Strategy Fusion

소셜 시그널의 '빠른 포착'과 퀀트/기술적 분석의 '신뢰성 검증'을 결합한 하이브리드 전략을 도입합니다.

### Triple Crown(삼관왕) 검증 전략
단순 호재가 아닌, 실제 "신뢰할 수 있는 상승"을 정의하는 3가지 레이어입니다.

1.  **관심도(Social Layer)**: 네이버 종토방, 팍스넷, StockPlus 등에서 언급량 및 긍정 반응 폭발 (Sentiment > 0.7)
2.  **모멘텀(Event Layer)**: DART 공시(실적 호조, 계약 체결) 또는 주요 뉴스 트리거 발생
3.  **신뢰도(Quant/Supply-Demand Layer)**: 
    *   **거래량 가드**: 전일 대비 거래량 200% 이상 또는 최근 20일 평균 거래량의 150% 돌파
    *   **수급 확인**: 외국인 또는 기관의 순매수세 동반 (최소 장중 수급 추정치 반영)
    *   **기술적 위치**: 주가가 5일/20일 이동평균선 위에 위치 (데드 캣 바운스 방지)

### 융합 매커니즘 (The Mix)

*   **Hard Filter (관문식)**: 기술적 지표(예: 거래량 미달)를 충족하지 못하면 아무리 소셜 반응이 좋아도 `BUY_NOW` 등급 부여 금지.
*   **Soft Scoring (가중치)**: 퀀트 점수(수급 점수 등)를 기존 `finalScore`에 곱하여 최종 랭킹 결정.
*   **LLM Contextual Weighting**: LLM에게 "현재 주가는 52주 고점 대비 90% 수준(과열권)이며, 소셜은 긍정적이나 기관은 매도 중"이라는 상충된 정보를 전달하여 비판적 결정을 유도.

---

## Verification Plan

### Automated Tests

기존 테스트 프레임워크([scripts/run_tests.ts](file:///Users/hwanchoi/projects/stock_analysis_event/scripts/run_tests.ts))에 한국 관련 테스트를 추가한다.

#### 1. 한국 종목코드 정규화 테스트
```bash
npm test
```
- `normalizeKrSymbol("005930")` → `"005930"` ✅
- `normalizeKrSymbol("00593")` → `null` ❌ (5자리)
- `normalizeKrSymbol("AAPL")` → `null` ❌ (영문)
- `extractKrTickerCandidates("삼성전자(005930) 급등")` → `["005930"]` ✅

#### 2. 한글 감정 분석 테스트
```bash
npm test
```
- `detectSentimentKr("급등 대박 상한가")` → 양수 ✅
- `detectSentimentKr("폭락 손절 하한가")` → 음수 ✅
- `detectSentimentKr("보통 텍스트")` → 0 ✅

#### 3. 기존 미국 테스트 회귀 방지
```bash
npm test
```
- 기존 모든 테스트가 통과하는지 확인 (영어 감정 분석, 미국 티커 추출 등)

#### 4. 파이프라인 스모크 테스트
```bash
DATABASE_URL=postgres://deepstock:deepstock@127.0.0.1:15432/deepstock \
KR_MARKET_ENABLED=true DART_API_KEY=test LLM_PROVIDER=stub \
npx tsx scripts/pipeline_smoke_test.ts
```
- 한국 소스가 포함된 상태에서 전체 파이프라인이 에러 없이 완주하는지 확인

### Manual Verification

#### 1. DART API 연동 확인
- DART API 키 발급 후 `/api/corpCode.xml`로 전체 상장사 목록 다운로드 확인
- 응답에서 종목코드 + 회사명 파싱이 정상인지 확인

#### 2. 대시보드에서 한국 종목 표시 확인
- 브라우저에서 `http://localhost:3333/dashboard/decisions` 접속
- 한국 종목(`005930`)이 포함된 Decision이 정상 렌더링되는지 확인
- 종목코드 옆에 한글 종목명(`삼성전자`)이 표시되는지 확인

#### 3. 한글 리포트 확인
- `http://localhost:3333/dashboard/reports`에서 한국 종목이 포함된 리포트의 한글 출력 확인

---

## 구현 순서 (권장)

```mermaid
gantt
    title 한국 주식 통합 구현 로드맵
    dateFormat  YYYY-MM-DD
    section 1차 (기반)
    KRX 티커 캐시 + 종목코드 정규화  :a1, 2026-02-12, 2d
    한글 감정 키워드 사전             :a2, after a1, 1d
    DART 공시 수집기                  :a3, after a1, 2d
    한국 뉴스 RSS 수집기             :a4, after a1, 1d
    section 2차 (확장)
    네이버 증권 수집기               :b1, after a4, 2d
    LLM 한국 프롬프트                :b2, after a3, 1d
    한글 리포트 템플릿               :b3, after b2, 1d
    section 3차 (고도화)
    커뮤니티 수집기                  :c1, after b1, 2d
    대시보드 한국 종목 UX 개선       :c2, after b3, 2d
    통합 테스트 + 회귀 테스트        :c3, after c2, 2d
```

| 단계 | 범위 | 예상 소요 |
|---|---|---|
| **1차** | KRX 캐시 + 코드 정규화 + DART + 뉴스 RSS + 한글 감정 | 3~4일 |
| **2차** | 네이버 증권 + LLM 프롬프트 + 한글 리포트 | 2~3일 |
| **3차** | 커뮤니티 + 대시보드 UX + 통합 테스트 | 3~4일 |
