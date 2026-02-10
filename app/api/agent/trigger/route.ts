import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    const result = await runPipeline({ triggerType: "manual" });
    return jsonOk(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 500;
    if (status === 401) logAuthFailure("/api/agent/trigger", message);
    return jsonError(message, status);
  }
}
