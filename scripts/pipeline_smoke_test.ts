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
  const result = await runPipeline({ triggerType: "manual", adapters: { llmProvider: stubProvider } });
  console.log("Pipeline smoke test result:", result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
