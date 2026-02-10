import { query } from "@/adapters/db/client";
import type { Decision } from "@/core/domain/types";

export async function insertDecision(decision: Decision): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO decisions
      (symbol, verdict, confidence, time_horizon, thesis_summary, entry_trigger, invalidation,
       risk_notes, bull_case, bear_case, red_flags, catalysts, sources_used,
       llm_model, prompt_version, schema_version, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING id
    `,
    [
      decision.symbol,
      decision.verdict,
      decision.confidence,
      decision.timeHorizon,
      decision.thesisSummary,
      decision.entryTrigger,
      decision.invalidation,
      decision.riskNotes,
      decision.bullCase,
      decision.bearCase,
      decision.redFlags,
      decision.catalysts,
      decision.sourcesUsed,
      decision.llmModel,
      decision.promptVersion,
      decision.schemaVersion,
      decision.createdAt
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listDecisions(limit = 50, offset = 0): Promise<Decision[]> {
  return query<Decision>(
    `SELECT
      id,
      symbol,
      verdict,
      confidence,
      time_horizon as "timeHorizon",
      thesis_summary as "thesisSummary",
      entry_trigger as "entryTrigger",
      invalidation,
      risk_notes as "riskNotes",
      bull_case as "bullCase",
      bear_case as "bearCase",
      red_flags as "redFlags",
      catalysts,
      sources_used as "sourcesUsed",
      llm_model as "llmModel",
      prompt_version as "promptVersion",
      schema_version as "schemaVersion",
      created_at as "createdAt"
     FROM decisions
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}
