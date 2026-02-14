import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv, getNumberEnv } from "@/config/runtime";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { logAuthFailure } from "@/security/log";
import { parseMarketScope, parseStrategyKey } from "@/core/pipeline/strategy_keys";
import type { LLMProviderName } from "@/adapters/llm/provider";
import { assertRateLimit } from "@/security/rate_limit";

interface TriggerBody {
  marketScope?: string;
  strategyKey?: string;
  llmProvider?: string;
}

function parseLLMProvider(input: unknown): LLMProviderName | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === "glm" || normalized === "openai" || normalized === "gemini") {
    return normalized as LLMProviderName;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    assertRateLimit(req, {
      namespace: "agent_trigger",
      limit: getNumberEnv("TRIGGER_RATE_LIMIT", 6),
      windowMs: getNumberEnv("TRIGGER_RATE_WINDOW_MS", 60_000)
    });
    const queryScope = req.nextUrl.searchParams.get("scope") ?? req.nextUrl.searchParams.get("marketScope");
    const parsed = (await req.json().catch(() => ({}))) as TriggerBody;
    const marketScopeFromBody =
      typeof parsed.marketScope === "string" && parsed.marketScope.trim().length > 0
        ? parseMarketScope(parsed.marketScope)
        : null;
    const marketScopeFromQuery =
      typeof queryScope === "string" && queryScope.trim().length > 0 ? parseMarketScope(queryScope) : null;
    const marketScope = marketScopeFromBody ?? marketScopeFromQuery;
    if (!marketScope) return jsonError("invalid_request", 400, "invalid_request");

    const strategyKey = parseStrategyKey(parsed.strategyKey, marketScope);
    if (!strategyKey) return jsonError("invalid_request", 400, "invalid_request");

    const llmProvider = parseLLMProvider(parsed.llmProvider);
    if (parsed.llmProvider && !llmProvider) return jsonError("invalid_request", 400, "invalid_request");

    const result = await runPipeline({
      triggerType: "manual",
      marketScope,
      strategyKey,
      llmProviderName: llmProvider,
      ignoreMinInterval: true
    });
    return jsonOk(result);
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/trigger", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
