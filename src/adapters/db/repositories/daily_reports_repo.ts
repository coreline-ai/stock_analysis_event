import { query } from "@/adapters/db/client";
import type { DailyReport } from "@/core/domain/types";

export async function upsertDailyReport(report: DailyReport): Promise<string> {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO daily_reports
      (report_date, summary_markdown, top_buy_now, top_watch, themes, risks, created_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (report_date)
    DO UPDATE SET summary_markdown = EXCLUDED.summary_markdown, created_at = EXCLUDED.created_at
    RETURNING id
    `,
    [
      report.reportDate,
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

export async function listReports(limit = 30, offset = 0): Promise<DailyReport[]> {
  return query<DailyReport>(
    `SELECT
      id,
      report_date as "reportDate",
      summary_markdown as "summaryMarkdown",
      top_buy_now as "topBuyNow",
      top_watch as "topWatch",
      themes,
      risks,
      created_at as "createdAt"
     FROM daily_reports
     ORDER BY report_date DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}
