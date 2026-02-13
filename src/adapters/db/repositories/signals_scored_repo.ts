import { query } from "@/adapters/db/client";
import type { MarketScope, SignalScored } from "@/core/domain/types";

const KR_SOURCES = ["naver", "dart", "kr_community", "kr_news", "kr_research", "kr_global_context"] as const;

export async function insertSignalScored(signal: SignalScored): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO signals_scored
      (
        run_ref,
        raw_id, symbol, sentiment_score, freshness_score, source_weight, final_score,
        social_score, event_score, volume_score, flow_score, technical_score, quant_score, context_risk_score, quant_multiplier,
        social_layer_passed, event_layer_passed, volume_guard_passed, flow_guard_passed, technical_guard_passed, triple_crown_passed, hard_filter_passed,
        reason_summary, scored_at
      )
    VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,
        $23,$24
      )
    RETURNING id
    `,
    [
      signal.runRef ?? null,
      signal.rawId,
      signal.symbol,
      signal.sentimentScore,
      signal.freshnessScore,
      signal.sourceWeight,
      signal.finalScore,
      signal.socialScore ?? null,
      signal.eventScore ?? null,
      signal.volumeScore ?? null,
      signal.flowScore ?? null,
      signal.technicalScore ?? null,
      signal.quantScore ?? null,
      signal.contextRiskScore ?? null,
      signal.quantMultiplier ?? null,
      signal.socialLayerPassed ?? null,
      signal.eventLayerPassed ?? null,
      signal.volumeGuardPassed ?? null,
      signal.flowGuardPassed ?? null,
      signal.technicalGuardPassed ?? null,
      signal.tripleCrownPassed ?? null,
      signal.hardFilterPassed ?? null,
      signal.reasonSummary ?? null,
      signal.scoredAt
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listTopScored(limit = 50, offset = 0, scope?: MarketScope): Promise<SignalScored[]> {
  const whereClause =
    scope === "KR"
      ? `WHERE r.source = ANY($3::text[])`
      : scope === "US"
        ? `WHERE NOT (r.source = ANY($3::text[]))`
        : "";
  const params = scope ? [limit, offset, KR_SOURCES] : [limit, offset];

  return query<SignalScored>(
    `SELECT
      s.id,
      s.run_ref as "runRef",
      s.raw_id as "rawId",
      s.symbol,
      s.sentiment_score as "sentimentScore",
      s.freshness_score as "freshnessScore",
      s.source_weight as "sourceWeight",
      s.final_score as "finalScore",
      s.social_score as "socialScore",
      s.event_score as "eventScore",
      s.volume_score as "volumeScore",
      s.flow_score as "flowScore",
      s.technical_score as "technicalScore",
      s.quant_score as "quantScore",
      s.context_risk_score as "contextRiskScore",
      s.quant_multiplier as "quantMultiplier",
      s.social_layer_passed as "socialLayerPassed",
      s.event_layer_passed as "eventLayerPassed",
      s.volume_guard_passed as "volumeGuardPassed",
      s.flow_guard_passed as "flowGuardPassed",
      s.technical_guard_passed as "technicalGuardPassed",
      s.triple_crown_passed as "tripleCrownPassed",
      s.hard_filter_passed as "hardFilterPassed",
      s.reason_summary as "reasonSummary",
      s.scored_at as "scoredAt"
     FROM signals_scored s
     JOIN signals_raw r ON r.id = s.raw_id
     ${whereClause}
     ORDER BY (s.quant_score IS NULL) ASC, s.final_score DESC, s.scored_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
}

export async function countScoredSignals(scope?: MarketScope): Promise<number> {
  const whereClause =
    scope === "KR"
      ? `WHERE r.source = ANY($1::text[])`
      : scope === "US"
        ? `WHERE NOT (r.source = ANY($1::text[]))`
        : "";
  const params = scope ? [KR_SOURCES] : [];
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM signals_scored s JOIN signals_raw r ON r.id = s.raw_id ${whereClause}`,
    params
  );
  return Number(rows[0]?.count ?? "0");
}

export async function searchScoredSymbols(queryText: string, limit = 10, scope?: MarketScope): Promise<string[]> {
  const normalized = queryText.trim().toUpperCase();
  if (!normalized) return [];
  const boundedLimit = Math.max(1, Math.min(limit, 50));

  const whereScope =
    scope === "KR"
      ? "AND r.source = ANY($3::text[])"
      : scope === "US"
        ? "AND NOT (r.source = ANY($3::text[]))"
        : "";
  const params = scope
    ? [normalized, boundedLimit, KR_SOURCES]
    : [normalized, boundedLimit];

  const rows = await query<{ symbol: string }>(
    `
    SELECT DISTINCT s.symbol as symbol
    FROM signals_scored s
    JOIN signals_raw r ON r.id = s.raw_id
    WHERE UPPER(s.symbol) LIKE ($1 || '%')
    ${whereScope}
    ORDER BY s.symbol ASC
    LIMIT $2
    `,
    params
  );
  return rows.map((row) => row.symbol);
}

export async function listScoredSignalsBySymbol(
  symbol: string,
  limit = 50,
  scope?: MarketScope
): Promise<SignalScored[]> {
  const whereScope =
    scope === "KR"
      ? "AND r.source = ANY($3::text[])"
      : scope === "US"
        ? "AND NOT (r.source = ANY($3::text[]))"
        : "";
  const params = scope ? [symbol, limit, KR_SOURCES] : [symbol, limit];

  return query<SignalScored>(
    `SELECT
      s.id,
      s.run_ref as "runRef",
      s.raw_id as "rawId",
      s.symbol,
      s.sentiment_score as "sentimentScore",
      s.freshness_score as "freshnessScore",
      s.source_weight as "sourceWeight",
      s.final_score as "finalScore",
      s.social_score as "socialScore",
      s.event_score as "eventScore",
      s.volume_score as "volumeScore",
      s.flow_score as "flowScore",
      s.technical_score as "technicalScore",
      s.quant_score as "quantScore",
      s.context_risk_score as "contextRiskScore",
      s.quant_multiplier as "quantMultiplier",
      s.social_layer_passed as "socialLayerPassed",
      s.event_layer_passed as "eventLayerPassed",
      s.volume_guard_passed as "volumeGuardPassed",
      s.flow_guard_passed as "flowGuardPassed",
      s.technical_guard_passed as "technicalGuardPassed",
      s.triple_crown_passed as "tripleCrownPassed",
      s.hard_filter_passed as "hardFilterPassed",
      s.reason_summary as "reasonSummary",
      s.scored_at as "scoredAt"
     FROM signals_scored s
     JOIN signals_raw r ON r.id = s.raw_id
     WHERE s.symbol = $1
     ${whereScope}
     ORDER BY s.scored_at DESC, s.final_score DESC
     LIMIT $2`,
    params
  );
}
