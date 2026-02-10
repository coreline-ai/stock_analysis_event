import assert from "node:assert";
import { detectSentiment } from "@/core/pipeline/stages/score/sentiment";
import { calculateFreshness } from "@/core/pipeline/stages/score/freshness";
import { extractTickerCandidates, normalizeSymbol } from "@/core/pipeline/stages/normalize/symbol_map";
import { parseRssItems } from "@/core/pipeline/stages/gather/news";
import { parseAtom } from "@/core/pipeline/stages/gather/sec";
import { scoreSignals } from "@/core/pipeline/stages/score";
import { DecisionOutputSchema } from "@/core/pipeline/stages/decide/schema";
import { decideSignals } from "@/core/pipeline/stages/decide";
import type { LLMProvider } from "@/adapters/llm/provider";
import { acquireLock, releaseLock } from "@/adapters/lock/redis_lock";
import type { SignalScored } from "@/core/domain/types";

function testSentiment() {
  assert.ok(detectSentiment("buy rocket moon") > 0);
  assert.ok(detectSentiment("short dump crash") < 0);
  assert.equal(detectSentiment("neutral text"), 0);
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

async function testLockFallback() {
  process.env.LOCK_MODE = "memory";
  const handle1 = await acquireLock("test", 50);
  assert.ok(handle1);
  const handle2 = await acquireLock("test", 50);
  assert.equal(handle2, null);

  await new Promise((r) => setTimeout(r, 60));
  const handle3 = await acquireLock("test", 50);
  assert.ok(handle3);
  await releaseLock(handle3!);
  delete process.env.LOCK_MODE;
}

async function run() {
  testSentiment();
  testFreshness();
  testTickerExtract();
  testRssParse();
  testAtomParse();
  testScoring();
  testDecisionSchema();
  await testDecideRetryAndDeadline();
  await testLockFallback();

  console.log("All tests passed (non-DB).");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
