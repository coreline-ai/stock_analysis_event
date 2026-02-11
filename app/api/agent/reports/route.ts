import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { countReports, listReports } from "@/adapters/db/repositories/daily_reports_repo";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";
import type { MarketScope } from "@/core/domain/types";

function parseScope(value: string | null): MarketScope | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (normalized === "US" || normalized === "KR") return normalized;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    const limitParam = req.nextUrl.searchParams.get("limit");
    const offsetParam = req.nextUrl.searchParams.get("offset");
    const scope = parseScope(req.nextUrl.searchParams.get("scope"));
    const limit = limitParam ? Math.min(Number(limitParam), 100) : 30;
    const offset = offsetParam ? Math.max(Number(offsetParam), 0) : 0;
    const [reports, total] = await Promise.all([
      listReports(Number.isFinite(limit) ? limit : 30, Number.isFinite(offset) ? offset : 0, scope),
      countReports(scope)
    ]);
    return jsonOk({
      items: reports,
      meta: {
        total,
        limit,
        offset,
        count: reports.length
      }
    });
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/reports", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
