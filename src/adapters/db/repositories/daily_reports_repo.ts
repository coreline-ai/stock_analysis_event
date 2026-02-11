import { query } from "@/adapters/db/client";
import type { DailyReport, MarketScope } from "@/core/domain/types";

export async function upsertDailyReport(report: DailyReport): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO daily_reports
      (report_date, market_scope, summary_markdown, top_buy_now, top_watch, themes, risks, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (report_date, market_scope)
    DO UPDATE SET
      summary_markdown = EXCLUDED.summary_markdown,
      top_buy_now = EXCLUDED.top_buy_now,
      top_watch = EXCLUDED.top_watch,
      themes = EXCLUDED.themes,
      risks = EXCLUDED.risks,
      created_at = EXCLUDED.created_at
    RETURNING id
    `,
    [
      report.reportDate,
      report.marketScope ?? "US",
      report.summaryMarkdown,
      report.topBuyNow,
      report.topWatch,
      report.themes,
      report.risks,
      report.createdAt
    ]
  );
  return rows[0]?.id ?? "";
}

export async function listReports(limit = 30, offset = 0, scope?: MarketScope): Promise<DailyReport[]> {
  const whereClause = scope ? `WHERE market_scope = $3` : "";
  const params = scope ? [limit, offset, scope] : [limit, offset];
  return query<DailyReport>(
    `SELECT
      id,
      report_date as "reportDate",
      market_scope as "marketScope",
      summary_markdown as "summaryMarkdown",
      top_buy_now as "topBuyNow",
      top_watch as "topWatch",
      themes,
      risks,
      created_at as "createdAt"
     FROM daily_reports
     ${whereClause}
     ORDER BY report_date DESC, created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );
}

export async function countReports(scope?: MarketScope): Promise<number> {
  const whereClause = scope ? `WHERE market_scope = $1` : "";
  const params = scope ? [scope] : [];
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM daily_reports ${whereClause}`, params);
  return Number(rows[0]?.count ?? "0");
}
