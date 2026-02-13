import assert from "node:assert";
import { detectSentiment } from "@/core/pipeline/stages/score/sentiment";
import { detectSentimentKr } from "@/core/pipeline/stages/score/sentiment_kr";
import { calculateFreshness } from "@/core/pipeline/stages/score/freshness";
import { extractTickerCandidates, normalizeKrSymbol, normalizeSymbol } from "@/core/pipeline/stages/normalize/symbol_map";
import { extractKrTickerCandidatesByName } from "@/core/pipeline/stages/normalize/kr_ticker_cache";
import { parseRssItems } from "@/core/pipeline/stages/gather/news";
import { parseAtom } from "@/core/pipeline/stages/gather/sec";
import { buildGatherTasks, runGather } from "@/core/pipeline/stages/gather";
import { buildKrMarketMetadata } from "@/core/pipeline/stages/gather/kr_market_meta";
import { scoreSignals } from "@/core/pipeline/stages/score";
import { analyzeKrQuantSignal } from "@/core/pipeline/stages/score/quant_kr";
import { buildDecisionPrompt } from "@/core/pipeline/stages/decide/prompts";
import { DecisionOutputSchema } from "@/core/pipeline/stages/decide/schema";
import { decideSignals } from "@/core/pipeline/stages/decide";
import { parseMarketScope, parseStrategyKey } from "@/core/pipeline/strategy_keys";
import { buildDailyReport } from "@/core/pipeline/stages/report/daily_report";
import type { LLMProvider } from "@/adapters/llm/provider";
import { acquireLock, releaseLock } from "@/adapters/lock/db_lock";
import type { SignalScored } from "@/core/domain/types";

function testSentiment() {
  assert.ok(detectSentiment("buy rocket moon") > 0);
  assert.ok(detectSentiment("short dump crash") < 0);
  assert.equal(detectSentiment("neutral text"), 0);
}

function testKrSentiment() {
  assert.ok(detectSentimentKr("급등 상한가 매수") > 0);
  assert.ok(detectSentimentKr("급락 하한가 매도") < 0);
  assert.equal(detectSentimentKr("중립 텍스트"), 0);
}

function testFreshness() {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const freshNow = calculateFreshness(now);
  const freshOld = calculateFreshness(old);
  assert.ok(freshNow >= freshOld);
}

function testTickerExtract() {
  const candidates = extractTickerCandidates("I like $AAPL and $TSLA");
  assert.ok(candidates.includes("AAPL"));
  assert.ok(candidates.includes("TSLA"));
  assert.equal(normalizeSymbol("aapl"), "AAPL");
  assert.equal(normalizeSymbol("$$"), null);
}

function testKrTickerNameExtract() {
  const symbols = extractKrTickerCandidatesByName("삼성전자와 SK하이닉스 동반 강세");
  assert.ok(symbols.includes("005930"));
  assert.ok(symbols.includes("000660"));
}

function testKrSymbolNormalizationCompat() {
  assert.equal(normalizeKrSymbol("005930"), "005930");
  assert.equal(normalizeKrSymbol("A005930"), "005930");
  assert.equal(normalizeKrSymbol("005930.KS"), "005930");
  assert.equal(normalizeKrSymbol("005930.kq"), "005930");
  assert.equal(normalizeKrSymbol("ABC"), null);
}

function testKrMarketMetaExtraction() {
  const meta = buildKrMarketMetadata({
    title: "외국인 순매수 120억, 기관 순매도 30억, 거래량 180%, 5일선 상회, 20일선 하회",
    body: null,
    base: { market_scope: "KR" }
  });

  assert.equal(meta.market_scope, "KR");
  assert.equal(meta.volume_ratio, 1.8);
  assert.equal(meta.price_above_ma5, 1);
  assert.equal(meta.price_above_ma20, 0);
  assert.ok(Number(meta.foreign_net_buy) > 0);
  assert.ok(Number(meta.institution_net_buy) < 0);
}

function testRssParse() {
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Apple (AAPL) earnings</title><link>http://x</link><pubDate>Mon, 10 Feb 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const items = parseRssItems(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "Apple (AAPL) earnings");
}

function testAtomParse() {
  const xml = `<feed><entry><id>sec_1</id><title>ACME INC (8-K)</title><updated>2026-02-10T00:00:00Z</updated></entry></feed>`;
  const items = parseAtom(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.form, "8-K");
  assert.equal(items[0]?.company, "ACME INC");
}

function testScoring() {
  const normalized = [
    { rawId: "1", source: "reddit", symbol: "AAPL", text: "buy rocket", publishedAt: new Date().toISOString() }
  ];
  const scored = scoreSignals(normalized as any);
  assert.equal(scored.length, 1);
  assert.ok(scored[0]?.finalScore !== undefined);
}

function testDecisionSchema() {
  const valid = {
    verdict: "BUY_NOW",
    confidence: 0.7,
    time_horizon: "swing",
    thesis_summary: "ok",
    entry_trigger: "breakout",
    invalidation: "breakdown",
    risk_notes: ["risk"],
    bull_case: ["bull"],
    bear_case: ["bear"],
    red_flags: ["flag"],
    catalysts: ["cat"]
  };
  assert.ok(DecisionOutputSchema.parse(valid));
  assert.throws(() => DecisionOutputSchema.parse({ ...valid, verdict: "NOPE" }));
}

function testPromptScopeSplit() {
  const us = buildDecisionPrompt({ symbol: "AAPL", signalSummary: "score=0.8 strong momentum", marketScope: "US" });
  assert.ok(us.system.includes("US market research analyst"));
  assert.ok(us.user.includes("MARKET: US"));

  const kr = buildDecisionPrompt({ symbol: "005930", signalSummary: "score=0.8 외국인 순매수", marketScope: "KR" });
  assert.ok(kr.system.includes("한국 주식시장"));
  assert.ok(kr.user.includes("MARKET: KR"));
  assert.ok(kr.user.includes("005930"));
}

function testKrHybridQuantAnalysis() {
  const result = analyzeKrQuantSignal({
    rawId: "raw-1",
    source: "dart",
    symbol: "005930",
    text: "종토방 토론 폭증, 거래량 200% 급증, 외국인 순매수, 5일선 상회, 공시 호재",
    publishedAt: new Date().toISOString(),
    metadata: { market_scope: "KR" }
  }, 0.9);
  assert.ok(result.quantScore > 0.4);
  assert.ok(result.quantMultiplier > 1.05);
  assert.equal(result.socialLayerPassed, true);
  assert.equal(result.eventLayerPassed, true);
  assert.equal(result.volumeGuardPassed, true);
  assert.equal(result.flowGuardPassed, true);
  assert.equal(result.technicalGuardPassed, true);
  assert.equal(result.tripleCrownPassed, true);
}

function testKrHybridVolumeGuardFail() {
  const result = analyzeKrQuantSignal(
    {
      rawId: "raw-2",
      source: "kr_news",
      symbol: "005930",
      text: "거래량 보통 수준, 외국인 순매수 약함, 20일선 하회",
      publishedAt: new Date().toISOString(),
      metadata: { market_scope: "KR", volume_ratio: 1.2 }
    },
    0.8
  );
  assert.equal(result.volumeGuardPassed, false);
  assert.equal(result.hardFilterPassed, false);
}

function testTriggerPayloadValidation() {
  assert.equal(parseMarketScope("US"), "US");
  assert.equal(parseMarketScope("kr"), "KR");
  assert.equal(parseMarketScope("ALL"), "ALL");
  assert.equal(parseMarketScope(undefined), "US");
  assert.equal(parseMarketScope("invalid"), null);

  assert.equal(parseStrategyKey("us_default", "US"), "us_default");
  assert.equal(parseStrategyKey("kr_default", "KR"), "kr_default");
  assert.equal(parseStrategyKey(undefined, "US"), "us_default");
  assert.equal(parseStrategyKey("all_default", "US"), null);
  assert.equal(parseStrategyKey("kr_default", "US"), null);
}

function testGatherScopeTasks() {
  const prevKrEnabled = process.env.KR_MARKET_ENABLED;
  const prevNaver = process.env.NAVER_ENABLED;
  const prevDart = process.env.DART_ENABLED;
  const prevCommunity = process.env.KR_COMMUNITY_ENABLED;
  const prevKrNews = process.env.KR_NEWS_ENABLED;
  const prevKrResearch = process.env.KR_RESEARCH_ENABLED;
  const prevKrGlobalContext = process.env.KR_GLOBAL_CONTEXT_ENABLED;

  process.env.KR_MARKET_ENABLED = "true";
  process.env.NAVER_ENABLED = "true";
  process.env.DART_ENABLED = "true";
  process.env.KR_COMMUNITY_ENABLED = "true";
  process.env.KR_NEWS_ENABLED = "true";
  process.env.KR_RESEARCH_ENABLED = "true";
  process.env.KR_GLOBAL_CONTEXT_ENABLED = "true";

  const usNames = buildGatherTasks("US").map((task) => task.name);
  assert.deepEqual(usNames, ["reddit", "stocktwits", "sec", "news", "crypto"]);

  const krNames = buildGatherTasks("KR").map((task) => task.name);
  assert.deepEqual(krNames, ["naver", "dart", "kr_community", "kr_news", "kr_research", "kr_global_context"]);

  const allNames = buildGatherTasks("ALL").map((task) => task.name);
  assert.ok(allNames.includes("news"));
  assert.ok(allNames.includes("dart"));

  process.env.KR_MARKET_ENABLED = prevKrEnabled;
  process.env.NAVER_ENABLED = prevNaver;
  process.env.DART_ENABLED = prevDart;
  process.env.KR_COMMUNITY_ENABLED = prevCommunity;
  process.env.KR_NEWS_ENABLED = prevKrNews;
  process.env.KR_RESEARCH_ENABLED = prevKrResearch;
  process.env.KR_GLOBAL_CONTEXT_ENABLED = prevKrGlobalContext;
}

async function testKrMissingDartKeyGracefulSkip() {
  const prevKrEnabled = process.env.KR_MARKET_ENABLED;
  const prevNaver = process.env.NAVER_ENABLED;
  const prevDart = process.env.DART_ENABLED;
  const prevCommunity = process.env.KR_COMMUNITY_ENABLED;
  const prevKrNews = process.env.KR_NEWS_ENABLED;
  const prevKrResearch = process.env.KR_RESEARCH_ENABLED;
  const prevKrGlobalContext = process.env.KR_GLOBAL_CONTEXT_ENABLED;
  const prevDartKey = process.env.DART_API_KEY;
  const prevDartFallback = process.env.DART_NEWS_FALLBACK_ENABLED;

  process.env.KR_MARKET_ENABLED = "true";
  process.env.NAVER_ENABLED = "false";
  process.env.DART_ENABLED = "true";
  process.env.KR_COMMUNITY_ENABLED = "false";
  process.env.KR_NEWS_ENABLED = "false";
  process.env.KR_RESEARCH_ENABLED = "false";
  process.env.KR_GLOBAL_CONTEXT_ENABLED = "false";
  process.env.DART_NEWS_FALLBACK_ENABLED = "false";
  delete process.env.DART_API_KEY;

  const result = await runGather("KR");
  assert.equal(result.signals.length, 0);
  assert.equal(result.counts.dart, 0);

  process.env.KR_MARKET_ENABLED = prevKrEnabled;
  process.env.NAVER_ENABLED = prevNaver;
  process.env.DART_ENABLED = prevDart;
  process.env.KR_COMMUNITY_ENABLED = prevCommunity;
  process.env.KR_NEWS_ENABLED = prevKrNews;
  process.env.KR_RESEARCH_ENABLED = prevKrResearch;
  process.env.KR_GLOBAL_CONTEXT_ENABLED = prevKrGlobalContext;
  if (prevDartFallback === undefined) delete process.env.DART_NEWS_FALLBACK_ENABLED;
  else process.env.DART_NEWS_FALLBACK_ENABLED = prevDartFallback;
  if (prevDartKey === undefined) delete process.env.DART_API_KEY;
  else process.env.DART_API_KEY = prevDartKey;
}

async function testDecideRetryAndDeadline() {
  let calls = 0;
  const provider: LLMProvider = {
    name: "stub",
    async complete() {
      calls += 1;
      if (calls === 1) return "not json";
      return JSON.stringify({
        verdict: "WATCH",
        confidence: 0.5,
        time_horizon: "intraday",
        thesis_summary: "summary",
        entry_trigger: "trigger",
        invalidation: "invalidation",
        risk_notes: ["risk"],
        bull_case: ["bull"],
        bear_case: ["bear"],
        red_flags: ["flag"],
        catalysts: ["cat"]
      });
    }
  };

  const input: SignalScored[] = [
    {
      id: "1",
      rawId: "r1",
      symbol: "AAPL",
      sentimentScore: 0.5,
      freshnessScore: 0.8,
      sourceWeight: 0.7,
      finalScore: 0.3,
      scoredAt: new Date().toISOString()
    }
  ];

  const decisions = await decideSignals(input, provider);
  assert.equal(decisions.length, 1);

  const deadlineDecisions = await decideSignals(input, provider, Date.now() - 1);
  assert.ok(deadlineDecisions.length === 0);
}

async function testDecideHardFilterDowngrade() {
  const provider: LLMProvider = {
    name: "stub-buy-now",
    async complete() {
      return JSON.stringify({
        verdict: "BUY_NOW",
        confidence: 0.82,
        time_horizon: "swing",
        thesis_summary: "소셜 신호 강세",
        entry_trigger: "돌파 확인",
        invalidation: "추세 훼손",
        risk_notes: ["변동성"],
        bull_case: ["심리 개선"],
        bear_case: ["재료 약화"],
        red_flags: ["거래량 감소"],
        catalysts: ["커뮤니티 확산"]
      });
    }
  };

  const input: SignalScored[] = [
    {
      id: "2",
      rawId: "r2",
      symbol: "005930",
      sentimentScore: 0.9,
      freshnessScore: 0.8,
      sourceWeight: 0.7,
      finalScore: 0.5,
      quantScore: 0.2,
      socialScore: 0.8,
      eventScore: 0.6,
      quantMultiplier: 0.93,
      hardFilterPassed: false,
      scoredAt: new Date().toISOString()
    }
  ];

  const decisions = await decideSignals(input, provider, undefined, { marketScope: "KR" });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.verdict, "WATCH");
  assert.ok((decisions[0]?.confidence ?? 1) <= 0.59);
  assert.ok(decisions[0]?.riskNotes.some((note) => note.includes("하드 필터")));
}

async function testLockAcquireRelease() {
  const key = `test-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const handle1 = await acquireLock(key, 50);
  assert.ok(handle1);
  const handle2 = await acquireLock(key, 50);
  assert.equal(handle2, null);

  await releaseLock({ key, token: `stale-${Date.now()}` });
  const handleAfterStaleRelease = await acquireLock(key, 50);
  assert.equal(handleAfterStaleRelease, null);

  await releaseLock(handle1!);
  await new Promise((r) => setTimeout(r, 60));
  const handle3 = await acquireLock(key, 50);
  assert.ok(handle3);
  await releaseLock(handle3!);
}

function testDailyReportBuild() {
  const decisions = [
    {
      id: "101",
      symbol: "AAPL",
      verdict: "WATCH" as const,
      confidence: 0.66,
      timeHorizon: "swing" as const,
      thesisSummary: "Earnings momentum with improving guidance",
      entryTrigger: "Break above prior high",
      invalidation: "Close below support",
      riskNotes: ["Macro slowdown", "Valuation compression"],
      bullCase: ["Strong product cycle"],
      bearCase: ["Demand softening"],
      redFlags: ["Guidance miss risk"],
      catalysts: ["Earnings follow-through", "Buyback update"],
      sourcesUsed: ["11"],
      llmModel: "GLM-4.6",
      promptVersion: "v1",
      schemaVersion: "v1",
      createdAt: new Date().toISOString()
    }
  ];
  const scored: SignalScored[] = [
    {
      id: "11",
      rawId: "1",
      symbol: "AAPL",
      sentimentScore: 0.3,
      freshnessScore: 0.8,
      sourceWeight: 0.7,
      finalScore: 0.42,
      reasonSummary: "positive earnings discussion",
      scoredAt: new Date().toISOString()
    }
  ];
  const report = buildDailyReport(decisions, scored);
  assert.ok(report.summaryMarkdown.includes("## 판단 기준"));
  assert.ok(report.summaryMarkdown.includes("근거 시그널"));
  assert.ok(report.summaryMarkdown.includes("AAPL"));
  assert.ok(report.themes.length > 0);
  assert.ok(report.risks.length > 0);
}

async function run() {
  testSentiment();
  testKrSentiment();
  testFreshness();
  testTickerExtract();
  testKrTickerNameExtract();
  testKrSymbolNormalizationCompat();
  testKrMarketMetaExtraction();
  testRssParse();
  testAtomParse();
  testScoring();
  testDecisionSchema();
  testPromptScopeSplit();
  testKrHybridQuantAnalysis();
  testKrHybridVolumeGuardFail();
  testTriggerPayloadValidation();
  testGatherScopeTasks();
  await testDecideRetryAndDeadline();
  await testDecideHardFilterDowngrade();
  await testKrMissingDartKeyGracefulSkip();
  await testLockAcquireRelease();
  testDailyReportBuild();

  console.log("All tests passed (non-DB).");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
