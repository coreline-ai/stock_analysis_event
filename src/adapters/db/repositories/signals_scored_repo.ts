import { query } from "@/adapters/db/client";
import type { SignalScored } from "@/core/domain/types";

export async function insertSignalScored(signal: SignalScored): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO signals_scored
      (raw_id, symbol, sentiment_score, freshness_score, source_weight, final_score, reason_summary, scored_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
    `,
    [
      signal.rawId,
      signal.symbol,
      signal.sentimentScore,
      signal.freshnessScore,
      signal.sourceWeight,
      signal.finalScore,
      signal.reasonSummary ?? null,
      signal.scoredAt
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listTopScored(limit = 50): Promise<SignalScored[]> {
  return query<SignalScored>(
    `SELECT
      id,
      raw_id as "rawId",
      symbol,
      sentiment_score as "sentimentScore",
      freshness_score as "freshnessScore",
      source_weight as "sourceWeight",
      final_score as "finalScore",
      reason_summary as "reasonSummary",
      scored_at as "scoredAt"
     FROM signals_scored
     ORDER BY final_score DESC, scored_at DESC
     LIMIT $1`,
    [limit]
  );
}
