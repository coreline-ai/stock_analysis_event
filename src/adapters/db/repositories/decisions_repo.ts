import { query } from "@/adapters/db/client";
import type { Decision, MarketScope } from "@/core/domain/types";

export async function insertDecision(decision: Decision): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO decisions
      (symbol, verdict, confidence, time_horizon, thesis_summary, entry_trigger, invalidation,
       risk_notes, bull_case, bear_case, red_flags, catalysts, sources_used,
       llm_model, prompt_version, schema_version, market_scope, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
      decision.marketScope ?? "US",
      decision.createdAt
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listDecisions(limit = 50, offset = 0, scope?: MarketScope): Promise<Decision[]> {
  const whereClause = scope ? `WHERE market_scope = $3` : "";
  const params = scope ? [limit, offset, scope] : [limit, offset];
  return query<Decision>(
    `SELECT
      id,
      symbol,
      market_scope as "marketScope",
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
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
}

export async function countDecisions(scope?: MarketScope): Promise<number> {
  const whereClause = scope ? `WHERE market_scope = $1` : "";
  const params = scope ? [scope] : [];
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM decisions ${whereClause}`, params);
  return Number(rows[0]?.count ?? "0");
}

export async function listDecisionsBySymbol(symbol: string, limit = 10, scope?: MarketScope): Promise<Decision[]> {
  const whereScope = scope ? "AND market_scope = $3" : "";
  const params = scope ? [symbol, limit, scope] : [symbol, limit];
  return query<Decision>(
    `SELECT
      id,
      symbol,
      market_scope as "marketScope",
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
     WHERE symbol = $1
     ${whereScope}
     ORDER BY created_at DESC
     LIMIT $2`,
    params
  );
}
