import assert from "node:assert";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import type { LLMProvider } from "@/adapters/llm/provider";

const stubProvider: LLMProvider = {
  name: "stub",
  async complete() {
    return JSON.stringify({
      verdict: "WATCH",
      confidence: 0.5,
      time_horizon: "intraday",
      thesis_summary: "stub",
      entry_trigger: "stub",
      invalidation: "stub",
      risk_notes: ["risk"],
      bull_case: ["bull"],
      bear_case: ["bear"],
      red_flags: ["flag"],
      catalysts: ["cat"]
    });
  }
};

async function run() {
  const first = await runPipeline({ triggerType: "manual", adapters: { llmProvider: stubProvider } });
  assert.ok(first.rawCount >= 0);

  const second = await runPipeline({ triggerType: "manual", adapters: { llmProvider: stubProvider } });
  assert.equal(second.rawCount, 0);
  assert.equal(second.scoredCount, 0);
  assert.equal(second.decidedCount, 0);

  console.log("Partial failure check passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
