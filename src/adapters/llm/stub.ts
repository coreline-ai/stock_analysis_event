import type { LLMProvider, LLMRequest } from "./provider";

export function createStubProvider(): LLMProvider {
  return {
    name: "stub",
    async complete(_req: LLMRequest): Promise<string> {
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
}
