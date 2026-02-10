export function buildDecisionPrompt(input: {
  symbol: string;
  signalSummary: string;
}): { system: string; user: string } {
  const system =
    "You are a research analyst. Provide a conservative, evidence-based decision. Output valid JSON only.";

  const user = `Analyze the following signals and produce a Research-Only decision.

SYMBOL: ${input.symbol}

SIGNALS:
${input.signalSummary}

Return JSON with fields:
{
  "verdict": "BUY_NOW|WATCH|AVOID",
  "confidence": 0.0-1.0,
  "time_horizon": "intraday|swing|long_term",
  "thesis_summary": "short summary",
  "entry_trigger": "clear condition",
  "invalidation": "when thesis fails",
  "risk_notes": ["risk1", "risk2"],
  "bull_case": ["point1"],
  "bear_case": ["point1"],
  "red_flags": ["flag1"],
  "catalysts": ["catalyst1"]
}`;

  return { system, user };
}
