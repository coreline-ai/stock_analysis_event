import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/security/cron_auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertCronAuth(req);
    const result = await runPipeline({ triggerType: "cron" });
    return jsonOk(result);
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/cron/run", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
