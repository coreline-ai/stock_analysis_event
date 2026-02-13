import { query } from "@/adapters/db/client";
import type { MarketScope } from "@/core/domain/types";

const PLACEHOLDER_VALUES = ["stub", "tbd", "none", "없음"] as const;

export interface PlaceholderCleanupResult {
  deletedDecisions: number;
  deletedReports: number;
}

export async function cleanupPlaceholderData(scope?: MarketScope): Promise<PlaceholderCleanupResult> {
  const normalizedScope = scope === "US" || scope === "KR" ? scope : null;

  const deletedDecisionsRows = await query<{ id: string }>(
    `
    DELETE FROM decisions
    WHERE ($1::text IS NULL OR market_scope = $1)
      AND (
        LOWER(TRIM(thesis_summary)) = ANY($2::text[])
        OR LOWER(TRIM(entry_trigger)) = ANY($2::text[])
        OR LOWER(TRIM(invalidation)) = ANY($2::text[])
      )
    RETURNING id
    `,
    [normalizedScope, PLACEHOLDER_VALUES]
  );

  const deletedReportsRows = await query<{ id: string }>(
    `
    DELETE FROM daily_reports
    WHERE ($1::text IS NULL OR market_scope = $1)
      AND summary_markdown ~ 'placeholder 응답 수\\(stub/tbd\\): [1-9][0-9]*'
    RETURNING id
    `,
    [normalizedScope]
  );

  return {
    deletedDecisions: deletedDecisionsRows.length,
    deletedReports: deletedReportsRows.length
  };
}
