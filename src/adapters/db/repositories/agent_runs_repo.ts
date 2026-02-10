import { query } from "@/adapters/db/client";
import type { AgentRun } from "@/core/domain/types";

export async function insertAgentRun(run: AgentRun): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO agent_runs
      (trigger_type, started_at, finished_at, status, gathered_counts, scored_count, decided_count,
       llm_calls, llm_tokens_estimated, stage_timings, error_summary, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id
    `,
    [
      run.triggerType,
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

export async function listAgentRuns(limit = 50, offset = 0): Promise<AgentRun[]> {
  return query<AgentRun>(
    `SELECT
      id,
      trigger_type as "triggerType",
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
     ORDER BY started_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

export async function getLatestAgentRun(): Promise<AgentRun | null> {
  const rows = await query<AgentRun>(
    `SELECT
      id,
      trigger_type as "triggerType",
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
     ORDER BY started_at DESC
     LIMIT 1`
  );
  return rows[0] ?? null;
}
