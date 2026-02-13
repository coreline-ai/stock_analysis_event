import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/security/cron_auth";
import { assertNoForbiddenEnv } from "@/config/runtime";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";
import { defaultStrategyForScope, parseMarketScope } from "@/core/pipeline/strategy_keys";
import type { MarketScope } from "@/core/domain/types";

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertCronAuth(req);
    const configuredScope = parseMarketScope(process.env.CRON_MARKET_SCOPE ?? process.env.DEFAULT_MARKET_SCOPE, "KR");
    if (!configuredScope) return jsonError("invalid_request", 400, "invalid_request");
    const marketScope: MarketScope = configuredScope === "ALL" ? "KR" : configuredScope;
    const result = await runPipeline({
      triggerType: "cron",
      marketScope,
      strategyKey: defaultStrategyForScope(marketScope)
    });
    return jsonOk(result);
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/cron/run", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
