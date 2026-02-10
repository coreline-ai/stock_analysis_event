import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/security/cron_auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertCronAuth(req);
    const result = await runPipeline({ triggerType: "cron" });
    return jsonOk(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 500;
    if (status === 401) logAuthFailure("/api/cron/run", message);
    return jsonError(message, status);
  }
}
