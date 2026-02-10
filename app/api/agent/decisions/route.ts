import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { listDecisions } from "@/adapters/db/repositories/decisions_repo";
import { jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";

export async function GET(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    const limitParam = req.nextUrl.searchParams.get("limit");
    const offsetParam = req.nextUrl.searchParams.get("offset");
    const limit = limitParam ? Math.min(Number(limitParam), 200) : 50;
    const offset = offsetParam ? Math.max(Number(offsetParam), 0) : 0;
    const decisions = await listDecisions(Number.isFinite(limit) ? limit : 50, Number.isFinite(offset) ? offset : 0);
    return jsonOk(decisions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 500;
    if (status === 401) logAuthFailure("/api/agent/decisions", message);
    return jsonError(message, status);
  }
}
