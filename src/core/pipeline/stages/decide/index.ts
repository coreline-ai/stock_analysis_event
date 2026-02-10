import type { SignalScored, Decision } from "@/core/domain/types";
import { LIMITS } from "@/config/limits";
import { buildDecisionPrompt } from "./prompts";
import { DecisionOutputSchema } from "./schema";
import { createOpenAIProvider } from "@/adapters/llm/openai";
import type { LLMProvider } from "@/adapters/llm/provider";
import { nowIso } from "@/core/utils/time";

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("invalid_json_response");
  }
  return text.slice(start, end + 1);
}

export async function decideSignals(
  scoredSignals: SignalScored[],
  provider?: LLMProvider,
  deadlineMs?: number
): Promise<Decision[]> {
  const llm = provider ?? createOpenAIProvider();

  const sorted = scoredSignals
    .slice()
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, Math.min(LIMITS.decideTopN, LIMITS.llmMaxSignalsPerRun));

  const grouped = new Map<string, SignalScored[]>();
  for (const sig of sorted) {
    if (!grouped.has(sig.symbol)) grouped.set(sig.symbol, []);
    grouped.get(sig.symbol)!.push(sig);
  }

  const decisions: Decision[] = [];
  let calls = 0;

  for (const [symbol, group] of grouped) {
    if (calls >= LIMITS.llmMaxCallsPerRun) break;
    if (deadlineMs && Date.now() > deadlineMs) break;

    const summary = group
      .slice(0, 5)
      .map((g) => `score=${g.finalScore.toFixed(3)} ${g.reasonSummary ?? ""}`)
      .join("\n");

    const prompt = buildDecisionPrompt({ symbol, signalSummary: summary });
    let parsed: ReturnType<typeof DecisionOutputSchema.parse> | null = null;
    let attempts = 0;

    while (attempts < 2 && !parsed) {
      if (deadlineMs && Date.now() > deadlineMs) break;
      const raw = await llm.complete({
        system: prompt.system,
        user: prompt.user,
        maxTokens: LIMITS.llmMaxTokensPerCall,
        model: process.env.LLM_MODEL || "gpt-4o-mini"
      });
      attempts += 1;
      calls += 1;

      try {
        parsed = DecisionOutputSchema.parse(JSON.parse(extractJson(raw)));
      } catch {
        parsed = null;
      }
    }

    if (!parsed) continue;

    const createdAt = nowIso();

    decisions.push({
      symbol,
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      timeHorizon: parsed.time_horizon,
      thesisSummary: parsed.thesis_summary,
      entryTrigger: parsed.entry_trigger,
      invalidation: parsed.invalidation,
      riskNotes: parsed.risk_notes,
      bullCase: parsed.bull_case,
      bearCase: parsed.bear_case,
      redFlags: parsed.red_flags,
      catalysts: parsed.catalysts,
      sourcesUsed: group.map((g) => g.id || "").filter(Boolean),
      llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
      promptVersion: "v1",
      schemaVersion: "v1",
      createdAt
    });
  }

  return decisions;
}
