# DeepStock Research Engine

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT">
</div>

<div align="center">
  <h3>브로커 실행 없이 자동으로 시그널을 수집, 점수화, 생성하는 리서치 전용 주식 분석 엔진</h3>
  <p>미국 및 한국 시장을 위한 연구 품질의 타이밍 인사이트 제공</p>
</div>

---

## 🚀 주요 기능

- **다중 소스 시그널 수집**: Reddit, StockTwits, SEC, 뉴스, 크립토, 한국 시장 소스에서 시그널 수집
- **AI 기반 의사결정**: 신뢰도 수준과 전략 추천을 포함한 매수/보유/매도 의사결정 생성
- **포괄적인 일일 리포트**: 테마, 리스크, 시장 인사이트를 포함한 상세 일일 요약 생성
- **모듈형 파이프라인 아키텍처**: 타임박스 및 안전 가드를 포함한 독립적 단계
- **리서치 전용 설계**: 브로커 실행 없음 - 분석 전용으로 설계됨
- **다중 시장 지원**: 미국 및 한국 시장 동시 지원
- **실시간 데이터 처리**: 효율적인 데이터 처리를 통한 빠른 파이프라인 실행

## 📊 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    DeepStock Research                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────┐ │
│  │  Frontend   │  │   API       │  │  Pipeline   │  │ DB  │ │
│  │ (Next.js)   │  │ (Next.js)   │  │ (Core)      │  │     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 파이프라인 단계

1. **Gather**: 다양한 소스에서 시그널 수집
2. **Normalize**: 시그널 데이터 표준화 및 보강
3. **Score**: 시그널 중요도 및 관련성 평가
4. **Decide**: AI 기반 트레이딩 의사결정 생성
5. **Report**: 일일 요약 리포트 생성

## 📥 설치

```bash
# 저장소 클론
git clone https://github.com/yourusername/deepstock-research-only.git
cd deepstock-research-only

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 구성 정보 추가

# 개발 서버 시작
npm run dev
```

## ⚙️ 설정

### 데이터베이스 설정

프로젝트는 PostgreSQL 데이터베이스를 사용하며, 다음 환경 변수를 통해 구성합니다:

```env
# 데이터베이스 연결
DATABASE_URL=postgresql://user:password@localhost:5432/deepstock
```

### 파이프라인 설정

```env
# 시장 범위 (US, KR, ALL)
DEFAULT_MARKET_SCOPE=US

# 데이터 소스 활성화
KR_MARKET_ENABLED=true
NAVER_ENABLED=true
DART_ENABLED=true
KR_COMMUNITY_ENABLED=true
KR_NEWS_ENABLED=true
KR_RESEARCH_ENABLED=true
KR_GLOBAL_CONTEXT_ENABLED=true

# 파이프라인 제한
GATHER_MAX_ITEMS_PER_SOURCE=200
SCORE_TOP_N=50
DECIDE_TOP_N=10
RUN_MAX_SECONDS=25
MIN_SECONDS_BETWEEN_RUNS=120

# LLM 설정
LLM_MAX_SIGNALS_PER_RUN=10
LLM_MAX_CALLS_PER_RUN=10
LLM_MAX_TOKENS_PER_CALL=1500
```

### 보안 설정

```env
# 브로커 실행 방지 (리서치 전용)
BROKER_EXECUTION_DISABLED=true

# API 인증
API_SECRET_KEY=your-secret-key
```

## 🚀 사용 방법

### API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|----------|--------|-------------|
| `/api/health` | GET | 시스템 상태 확인 |
| `/api/agent/trigger` | POST | 파이프라인 실행 트리거 (인증 필요) |
| `/api/agent/symbols/search` | GET | 심볼 검색 |
| `/api/agent/symbols/resolve` | GET | 심볼 정보 확인 |
| `/api/agent/symbol-report` | GET | 심볼 분석 리포트 |

### 대시보드

웹 인터페이스를 `http://localhost:3000/dashboard`에서 접속하여:

- 수집된 시그널 및 소스 확인
- 신뢰도 수준과 함께 점수화된 결과 확인
- AI 생성 트레이딩 의사결정 확인
- 포괄적인 일일 리포트 검토
- 시스템 설정 및 기본 설정 구성

## 🛠️ 개발

### 테스트 실행

```bash
# 모든 테스트 실행
npm test

# GUI 품질 검사 실행
npm run test:gui

# GUI 기능 검사 실행
npm run test:gui:features

# 브랜딩 검사 실행
npm run branding:check

# 데이터베이스 마이그레이션 실행
npm run db:migrate
```

### 개발 스크립트

```bash
# 개발 서버 시작
npm run dev

# 3333 포트에서 개발 서버 시작
npm run dev:3333

# Docker를 통한 개발 서버 시작
npm run dev:up

# 개발 환경 중지
npm run dev:down

# 개발 상태 확인
npm run dev:status
```

## 🔍 코드 분석 (상세)

### 코어 파이프라인 구조

#### 파이프라인 실행 흐름 ([src/core/pipeline/run_pipeline.ts](src/core/pipeline/run_pipeline.ts))

```typescript
export async function runPipeline(opts: RunPipelineOptions): Promise<RunPipelineResult> {
  // 1. 환경 검증 및 초기 설정
  assertNoForbiddenEnv();
  const defaultScope = parseMarketScope(getEnv("DEFAULT_MARKET_SCOPE", "US"), "US");

  // 2. 시장 범위 및 전략 설정
  const marketScope = opts.marketScope ?? defaultScope;
  const strategyKey = parseStrategyKey(opts.strategyKey ?? defaultStrategy, marketScope);

  // 3. 락 획득 (동시 실행 방지)
  const lockHandle = await lockAdapter.acquire(`deepstock:pipeline:${marketScope.toLowerCase()}`, 10 * 60 * 1000);

  // 4. 데이터 수집 단계
  const gatherResult = await runWithDeadline("gather", () => runGather(marketScope, limits));

  // 5. 데이터 정규화 및 점수화
  let normalized = normalizeSignals(rawWithIds);
  if (marketScope === "KR" || marketScope === "ALL") {
    normalized = await enrichKrNormalizedSignals(normalized, hardDeadlineMs);
  }

  // 6. AI 기반 의사결정 생성
  const generatedDecisions = await decideSignals(scoredWithIds, llmProvider, decideDeadlineMs, { marketScope, limits: effectiveLimits });

  // 7. 리포트 생성
  const report = generateReport(persistedDecisions, scoredWithIds, marketScope);

  // 8. 실행 기록 저장
  await insertAgentRun({
    triggerType: opts.triggerType,
    marketScope,
    strategyKey,
    startedAt,
    finishedAt: nowIso(),
    status,
    gatheredCounts,
    scoredCount: scoredSignals.length,
    decidedCount: persistedDecisions.length,
    llmCalls: generatedDecisions.length,
    llmTokensEstimated: generatedDecisions.length * limits.llmMaxTokensPerCall,
    stageTimingsMs: stageTimings,
    errorSummary,
    createdAt: startedAt
  });
}
```

### 데이터베이스 모델

#### 일일 리포트 저장소 ([src/adapters/db/repositories/daily_reports_repo.ts](src/adapters/db/repositories/daily_reports_repo.ts))

```typescript
export async function upsertDailyReport(report: DailyReport): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO daily_reports
      (report_date, market_scope, summary_markdown, top_buy_now, top_watch, themes, risks, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (report_date, market_scope)
    DO UPDATE SET
      summary_markdown = EXCLUDED.summary_markdown,
      top_buy_now = EXCLUDED.top_buy_now,
      top_watch = EXCLUDED.top_watch,
      themes = EXCLUDED.themes,
      risks = EXCLUDED.risks,
      created_at = EXCLUDED.created_at
    RETURNING id
    `,
    [
      report.reportDate,
      report.marketScope ?? "US",
      report.summaryMarkdown,
      report.topBuyNow,
      report.topWatch,
      report.themes,
      report.risks,
      report.createdAt
    ]
  );
  return rows[0]?.id ?? "";
}
```

### 데이터 수집 모듈

#### 수집 작업 구성 ([src/core/pipeline/stages/gather/index.ts](src/core/pipeline/stages/gather/index.ts))

```typescript
export function buildGatherTasks(scope: MarketScope): GatherTask[] {
  const usTasks: GatherTask[] = [
    { name: "reddit", fn: () => gatherReddit(25) },
    { name: "stocktwits", fn: () => gatherStockTwits(15) },
    { name: "sec", fn: () => gatherSecEdgar(20) },
    { name: "news", fn: () => gatherNews(20) },
    { name: "crypto", fn: () => gatherCrypto() }
  ];

  const krEnabled = getBooleanEnv("KR_MARKET_ENABLED", true);
  const krTasks: GatherTask[] = [];

  if (krEnabled) {
    if (getBooleanEnv("NAVER_ENABLED", true)) {
      krTasks.push({ name: "naver", fn: () => gatherNaver(25) });
    }
    if (getBooleanEnv("DART_ENABLED", true)) {
      krTasks.push({ name: "dart", fn: () => gatherDart(30) });
    }
    // ... 기타 한국 시장 소스
  }

  return scope === "US" ? usTasks : scope === "KR" ? krTasks : [...usTasks, ...krTasks];
}
```

### 보안 및 안정성

#### 환경 변수 검증 ([src/config/runtime.ts](src/config/runtime.ts))

```typescript
export function assertNoForbiddenEnv() {
  const forbiddenKeys = ["BROKER_API_KEY", "BROKER_SECRET", "TRADING_API_KEY"];
  for (const key of forbiddenKeys) {
    if (process.env[key]) {
      throw new Error(`Forbidden environment variable detected: ${key}`);
    }
  }
}
```

### 성능 최적화

#### 타임박스 시스템 ([src/core/pipeline/run_pipeline.ts](src/core/pipeline/run_pipeline.ts))

```typescript
const effectiveRunMaxSeconds = targetSymbol ? Math.max(limits.runMaxSeconds, symbolRunMaxSeconds) : limits.runMaxSeconds;
const persistReserveMs = Math.max(1000, getNumberEnv("PIPELINE_PERSIST_RESERVE_MS", 3500));
const hardDeadlineMs = Date.now() + effectiveRunMaxSeconds * 1000;
const decideDeadlineMs = hardDeadlineMs - persistReserveMs;

async function runWithDeadline<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const remainingMs = hardDeadlineMs - Date.now();
  if (remainingMs <= 0) throw new Error("timebox_exceeded");

  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timebox_exceeded")), remainingMs);
    })
  ]);
}
```

## 🤝 기여 방법

기여는 환영합니다! 다음 단계를 따라주세요:

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경 사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치로 푸시 (`git push origin feature/AmazingFeature`)
5. 풀 리퀘스트 열기

### 코드 표준

- TypeScript最佳实践 따르기
- 일관된 코드 스타일 유지
- 포괄적인 테스트 작성
- 문서화 업데이트
- 제출 전 모든 테스트 통과 확인

## 📄 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

```
MIT License

Copyright (c) 2024 DeepStock Research

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```