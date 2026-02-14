import { query } from "@/adapters/db/client";

export interface KrTickerMapRow {
  code: string;
  name: string;
}

export async function listKrTickerMap(): Promise<KrTickerMapRow[]> {
  return query<KrTickerMapRow>(
    `
    SELECT code, name
    FROM kr_ticker_map
    ORDER BY code ASC
    `
  );
}

export async function upsertKrTickerMap(rows: KrTickerMapRow[]): Promise<void> {
  if (rows.length === 0) return;
  const payload = JSON.stringify(rows);
  await query(
    `
    INSERT INTO kr_ticker_map (code, name, market, updated_at)
    SELECT item.code, item.name, 'KRX', NOW()
    FROM jsonb_to_recordset($1::jsonb) AS item(code text, name text)
    WHERE item.code ~ '^\\d{6}$' AND LENGTH(TRIM(item.name)) > 0
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name,
      market = EXCLUDED.market,
      updated_at = NOW()
    `,
    [payload]
  );
}
