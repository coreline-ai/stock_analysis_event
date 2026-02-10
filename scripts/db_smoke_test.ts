import assert from "node:assert";
import { insertSignalRaw, listRecentRawSignals } from "@/adapters/db/repositories/signals_raw_repo";
import { insertSignalScored } from "@/adapters/db/repositories/signals_scored_repo";
import { insertDecision, listDecisions } from "@/adapters/db/repositories/decisions_repo";
import { upsertDailyReport, listReports } from "@/adapters/db/repositories/daily_reports_repo";
import { insertAgentRun, listAgentRuns } from "@/adapters/db/repositories/agent_runs_repo";
import { nowIso } from "@/core/utils/time";

async function run() {
  const rawId = await insertSignalRaw({
    source: "news",
    externalId: "smoke_test_news_1",
    symbolCandidates: ["AAPL"],
    title: "Apple earnings",
    body: "Apple beats estimates",
    url: "http://example.com",
    author: "test",
    publishedAt: nowIso(),
    collectedAt: nowIso(),
    engagement: { views: 1 },
    rawPayload: { test: true }
  });

  assert.ok(rawId);

  const scoredId = await insertSignalScored({
    rawId,
    symbol: "AAPL",
    sentimentScore: 0.5,
    freshnessScore: 0.9,
    sourceWeight: 0.7,
    finalScore: 0.315,
    reasonSummary: "smoke",
    scoredAt: nowIso()
  });

  assert.ok(scoredId);

  const decisionId = await insertDecision({
    symbol: "AAPL",
    verdict: "WATCH",
    confidence: 0.5,
    timeHorizon: "swing",
    thesisSummary: "smoke",
    entryTrigger: "breakout",
    invalidation: "breakdown",
    riskNotes: ["risk"],
    bullCase: ["bull"],
    bearCase: ["bear"],
    redFlags: ["flag"],
    catalysts: ["cat"],
    sourcesUsed: [scoredId],
    llmModel: "gpt-4o-mini",
    promptVersion: "v1",
    schemaVersion: "v1",
    createdAt: nowIso()
  });

  assert.ok(decisionId);

  const reportId = await upsertDailyReport({
    reportDate: nowIso().slice(0, 10),
    summaryMarkdown: "smoke report",
    topBuyNow: [],
    topWatch: [decisionId],
    themes: ["theme"],
    risks: ["risk"],
    createdAt: nowIso()
  });

  assert.ok(reportId);

  const runId = await insertAgentRun({
    triggerType: "manual",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    status: "success",
    gatheredCounts: { news: 1 },
    scoredCount: 1,
    decidedCount: 1,
    llmCalls: 1,
    llmTokensEstimated: 100,
    stageTimingsMs: { gather_ms: 10 },
    createdAt: nowIso()
  });

  assert.ok(runId);

  const raws = await listRecentRawSignals(5);
  const decisions = await listDecisions(5);
  const reports = await listReports(5);
  const runs = await listAgentRuns(5);

  assert.ok(raws.length > 0);
  assert.ok(decisions.length > 0);
  assert.ok(reports.length > 0);
  assert.ok(runs.length > 0);

  console.log("DB smoke test passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
