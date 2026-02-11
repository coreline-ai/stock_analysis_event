import { query } from "@/adapters/db/client";
import type { AgentRun, MarketScope } from "@/core/domain/types";

export async function insertAgentRun(run: AgentRun): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO agent_runs
      (trigger_type, market_scope, strategy_key, started_at, finished_at, status, gathered_counts, scored_count, decided_count,
       llm_calls, llm_tokens_estimated, stage_timings, error_summary, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING id
    `,
    [
      run.triggerType,
      run.marketScope ?? "US",
      run.strategyKey ?? "us_default",
      run.startedAt,
      run.finishedAt ?? null,
      run.status,
      run.gatheredCounts ?? null,
      run.scoredCount ?? null,
      run.decidedCount ?? null,
      run.llmCalls ?? null,
      run.llmTokensEstimated ?? null,
      run.stageTimingsMs ?? null,
      run.errorSummary ?? null,
      run.createdAt
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listAgentRuns(limit = 50, offset = 0, scope?: MarketScope): Promise<AgentRun[]> {
  const whereClause = scope ? `WHERE market_scope = $3` : "";
  const params = scope ? [limit, offset, scope] : [limit, offset];
  return query<AgentRun>(
    `SELECT
      id,
      trigger_type as "triggerType",
      market_scope as "marketScope",
      strategy_key as "strategyKey",
      started_at as "startedAt",
      finished_at as "finishedAt",
      status,
      gathered_counts as "gatheredCounts",
      scored_count as "scoredCount",
      decided_count as "decidedCount",
      llm_calls as "llmCalls",
      llm_tokens_estimated as "llmTokensEstimated",
      stage_timings as "stageTimingsMs",
      error_summary as "errorSummary",
      created_at as "createdAt"
     FROM agent_runs
     ${whereClause}
     ORDER BY started_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
}

export async function getLatestAgentRun(scope?: MarketScope): Promise<AgentRun | null> {
  const whereClause = scope ? `WHERE market_scope = $1` : "";
  const params = scope ? [scope] : [];
  const rows = await query<AgentRun>(
    `SELECT
      id,
      trigger_type as "triggerType",
      market_scope as "marketScope",
      strategy_key as "strategyKey",
      started_at as "startedAt",
      finished_at as "finishedAt",
      status,
      gathered_counts as "gatheredCounts",
      scored_count as "scoredCount",
      decided_count as "decidedCount",
      llm_calls as "llmCalls",
      llm_tokens_estimated as "llmTokensEstimated",
      stage_timings as "stageTimingsMs",
      error_summary as "errorSummary",
      created_at as "createdAt"
     FROM agent_runs
     ${whereClause}
     ORDER BY started_at DESC
     LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

export async function countAgentRuns(scope?: MarketScope): Promise<number> {
  const whereClause = scope ? `WHERE market_scope = $1` : "";
  const params = scope ? [scope] : [];
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM agent_runs ${whereClause}`, params);
  return Number(rows[0]?.count ?? "0");
}
