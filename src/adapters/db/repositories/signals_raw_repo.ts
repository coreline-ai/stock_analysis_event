import { query } from "@/adapters/db/client";
import type { MarketScope, SignalRaw } from "@/core/domain/types";

const KR_SOURCES = ["naver", "dart", "kr_community", "kr_news", "kr_research", "kr_global_context"] as const;

export async function insertSignalRaw(signal: SignalRaw): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO signals_raw
      (source, external_id, symbol_candidates, title, body, url, author, published_at, collected_at, engagement, raw_payload)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (source, external_id)
    DO UPDATE SET
      symbol_candidates = EXCLUDED.symbol_candidates,
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      url = EXCLUDED.url,
      author = EXCLUDED.author,
      published_at = EXCLUDED.published_at,
      collected_at = EXCLUDED.collected_at,
      engagement = EXCLUDED.engagement,
      raw_payload = EXCLUDED.raw_payload
    RETURNING id
    `,
    [
      signal.source,
      signal.externalId,
      signal.symbolCandidates,
      signal.title ?? null,
      signal.body ?? null,
      signal.url ?? null,
      signal.author ?? null,
      signal.publishedAt ?? null,
      signal.collectedAt,
      signal.engagement ?? null,
      signal.rawPayload ?? null
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listRecentRawSignals(limit = 50, offset = 0, scope?: MarketScope): Promise<SignalRaw[]> {
  const whereClause =
    scope === "KR"
      ? `WHERE source = ANY($3::text[])`
      : scope === "US"
        ? `WHERE NOT (source = ANY($3::text[]))`
        : "";
  const params = scope ? [limit, offset, KR_SOURCES] : [limit, offset];

  return query<SignalRaw>(
    `SELECT
      id,
      source,
      external_id as "externalId",
      symbol_candidates as "symbolCandidates",
      title,
      body,
      url,
      author,
      published_at as "publishedAt",
     collected_at as "collectedAt",
     engagement,
     raw_payload as "rawPayload"
     FROM signals_raw
     ${whereClause}
     ORDER BY collected_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
}

export async function listRawSignalsBySymbol(symbol: string, limit = 50, scope?: MarketScope): Promise<SignalRaw[]> {
  const whereScope =
    scope === "KR"
      ? "AND source = ANY($3::text[])"
      : scope === "US"
        ? "AND NOT (source = ANY($3::text[]))"
        : "";
  const params = scope ? [symbol, limit, KR_SOURCES] : [symbol, limit];

  return query<SignalRaw>(
    `SELECT
      id,
      source,
      external_id as "externalId",
      symbol_candidates as "symbolCandidates",
      title,
      body,
      url,
      author,
      published_at as "publishedAt",
      collected_at as "collectedAt",
      engagement,
      raw_payload as "rawPayload"
     FROM signals_raw
     WHERE $1 = ANY(symbol_candidates)
     ${whereScope}
     ORDER BY collected_at DESC
     LIMIT $2`,
    params
  );
}

export async function countRawSignals(scope?: MarketScope): Promise<number> {
  const whereClause =
    scope === "KR"
      ? `WHERE source = ANY($1::text[])`
      : scope === "US"
        ? `WHERE NOT (source = ANY($1::text[]))`
        : "";
  const params = scope ? [KR_SOURCES] : [];
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM signals_raw ${whereClause}`, params);
  return Number(rows[0]?.count ?? "0");
}

export async function mergeRawPayloadById(id: string, payload: Record<string, unknown>): Promise<void> {
  await query(
    `
    UPDATE signals_raw
    SET raw_payload = COALESCE(raw_payload, '{}'::jsonb) || $2::jsonb
    WHERE id = $1
    `,
    [id, JSON.stringify(payload)]
  );
}
