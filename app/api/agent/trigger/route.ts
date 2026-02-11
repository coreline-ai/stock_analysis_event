import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";
import { parseMarketScope, parseStrategyKey } from "@/core/pipeline/strategy_keys";

interface TriggerBody {
  marketScope?: string;
  strategyKey?: string;
}

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    const parsed = (await req.json().catch(() => ({}))) as TriggerBody;
    const marketScope = parseMarketScope(parsed.marketScope);
    if (!marketScope) return jsonError("invalid_request", 400, "invalid_request");

    const strategyKey = parseStrategyKey(parsed.strategyKey, marketScope);
    if (!strategyKey) return jsonError("invalid_request", 400, "invalid_request");

    const result = await runPipeline({ triggerType: "manual", marketScope, strategyKey });
    return jsonOk(result);
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/trigger", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
