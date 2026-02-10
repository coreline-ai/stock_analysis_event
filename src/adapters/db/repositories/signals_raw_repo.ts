import { query } from "@/adapters/db/client";
import type { SignalRaw } from "@/core/domain/types";

export async function insertSignalRaw(signal: SignalRaw): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO signals_raw
      (source, external_id, symbol_candidates, title, body, url, author, published_at, collected_at, engagement, raw_payload)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (source, external_id)
    DO UPDATE SET collected_at = EXCLUDED.collected_at
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

export async function listRecentRawSignals(limit = 50): Promise<SignalRaw[]> {
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
     ORDER BY collected_at DESC
     LIMIT $1`,
    [limit]
  );
}
