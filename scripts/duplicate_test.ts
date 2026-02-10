import assert from "node:assert";
import { insertSignalRaw, listRecentRawSignals } from "@/adapters/db/repositories/signals_raw_repo";
import { nowIso } from "@/core/utils/time";

async function run() {
  const externalId = "dup_test_1";
  const id1 = await insertSignalRaw({
    source: "news",
    externalId,
    symbolCandidates: ["AAPL"],
    title: "dup",
    body: "dup",
    url: "http://example.com",
    author: "test",
    publishedAt: nowIso(),
    collectedAt: nowIso(),
    engagement: null,
    rawPayload: null
  });

  const id2 = await insertSignalRaw({
    source: "news",
    externalId,
    symbolCandidates: ["AAPL"],
    title: "dup",
    body: "dup",
    url: "http://example.com",
    author: "test",
    publishedAt: nowIso(),
    collectedAt: nowIso(),
    engagement: null,
    rawPayload: null
  });

  assert.ok(id1);
  assert.ok(id2);
  assert.equal(id1, id2);

  const rows = await listRecentRawSignals(50);
  const matching = rows.filter((r) => r.externalId === externalId && r.source === "news");
  assert.equal(matching.length, 1);

  console.log("Duplicate prevention check passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
