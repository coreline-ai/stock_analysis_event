import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { listAgentRuns } from "@/adapters/db/repositories/agent_runs_repo";
import { countDecisions, listDecisions } from "@/adapters/db/repositories/decisions_repo";
import { listReports } from "@/adapters/db/repositories/daily_reports_repo";
import type { AgentRun, MarketScope } from "@/core/domain/types";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";

function computeAvgDurationMs(runs: AgentRun[]): number {
  const durations = runs
    .map((r) => {
      if (!r.startedAt || !r.finishedAt) return null;
      const start = new Date(r.startedAt).getTime();
      const end = new Date(r.finishedAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
      return end - start;
    })
    .filter((v): v is number => typeof v === "number");

  if (durations.length === 0) return 0;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

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
    const scope = parseScope(req.nextUrl.searchParams.get("scope"));

    const [runs, decisions, reports, usDecisions, krDecisions] = await Promise.all([
      listAgentRuns(50, 0, scope),
      listDecisions(200, 0, scope),
      listReports(30, 0, scope),
      countDecisions("US"),
      countDecisions("KR")
    ]);

    const latestRun = runs[0] ?? null;
    const buyNow = decisions.filter((d) => d.verdict === "BUY_NOW").length;
    const watch = decisions.filter((d) => d.verdict === "WATCH").length;
    const avoid = decisions.filter((d) => d.verdict === "AVOID").length;

    const success = runs.filter((r) => r.status === "success").length;
    const partial = runs.filter((r) => r.status === "partial").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const successRate = runs.length > 0 ? success / runs.length : 0;

    return jsonOk({
      kpi: {
        buyNow,
        watch,
        avoid,
        decisions: decisions.length,
        reports: reports.length,
        runs: runs.length,
        usDecisions,
        krDecisions
      },
      runHealth: {
        success,
        partial,
        failed,
        successRate,
        avgDurationMs: computeAvgDurationMs(runs),
        latestRun
      },
      latest: {
        decisions: decisions.slice(0, 10),
        reports: reports.slice(0, 5)
      }
    });
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/summary", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
