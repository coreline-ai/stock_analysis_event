import type { NextRequest } from "next/server";
import { assertApiAuth } from "@/security/auth";
import { assertNoForbiddenEnv, getNumberEnv } from "@/config/runtime";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import type { LLMProviderName } from "@/adapters/llm/provider";
import type { MarketScope } from "@/core/domain/types";
import { cleanupPlaceholderData } from "@/adapters/db/repositories/maintenance_repo";
import { defaultStrategyForScope, parseMarketScope } from "@/core/pipeline/strategy_keys";
import { runPipeline } from "@/core/pipeline/run_pipeline";
import { logAuthFailure } from "@/security/log";
import { assertRateLimit } from "@/security/rate_limit";

interface RebuildBody {
  scopes?: string[];
  llmProvider?: string;
  cleanupOnly?: boolean;
}

function parseScope(input: unknown): MarketScope | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  if (normalized === "US" || normalized === "KR") return normalized as MarketScope;
  return null;
}

function defaultScopes(): MarketScope[] {
  const configured = parseMarketScope(process.env.DEFAULT_MARKET_SCOPE, "KR");
  if (configured === "US" || configured === "KR") return [configured];
  return ["KR"];
}

function parseScopes(input: unknown): MarketScope[] | null {
  if (!Array.isArray(input) || input.length === 0) return defaultScopes();
  const deduped = new Set<MarketScope>();
  for (const item of input) {
    const parsed = parseScope(item);
    if (!parsed) continue;
    deduped.add(parsed);
  }
  if (deduped.size === 0) return null;
  return Array.from(deduped);
}

function isValidScopeRecordKey(scope: string): scope is MarketScope {
  return scope === "US" || scope === "KR" || scope === "ALL";
}

function toCleanupSummary(
  scopes: MarketScope[],
  data: Record<string, { deletedDecisions: number; deletedReports: number }>
): Record<MarketScope, { deletedDecisions: number; deletedReports: number }> {
  const summary: Record<MarketScope, { deletedDecisions: number; deletedReports: number }> = {
    US: { deletedDecisions: 0, deletedReports: 0 },
    KR: { deletedDecisions: 0, deletedReports: 0 },
    ALL: { deletedDecisions: 0, deletedReports: 0 }
  };
  for (const scope of scopes) {
    const item = data[scope];
    if (!item) continue;
    if (!isValidScopeRecordKey(scope)) continue;
    summary[scope] = item;
  }
  return summary;
}

function parseProvider(input: unknown): LLMProviderName | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === "glm" || normalized === "openai" || normalized === "gemini") return normalized as LLMProviderName;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    assertNoForbiddenEnv();
    assertApiAuth(req);
    assertRateLimit(req, {
      namespace: "agent_maintenance_rebuild_placeholders",
      limit: getNumberEnv("MAINTENANCE_REBUILD_RATE_LIMIT", 2),
      windowMs: getNumberEnv("MAINTENANCE_REBUILD_RATE_WINDOW_MS", 300_000)
    });
    const body = (await req.json().catch(() => ({}))) as RebuildBody;
    const scopes = parseScopes(body.scopes);
    if (!scopes) return jsonError("invalid_request", 400, "invalid_request");
    const llmProvider = parseProvider(body.llmProvider);
    if (body.llmProvider && !llmProvider) return jsonError("invalid_request", 400, "invalid_request");

    const cleanupSummaryRaw: Record<string, { deletedDecisions: number; deletedReports: number }> = {};
    const runResults: Array<{ marketScope: MarketScope; status: string; errorSummary?: string | null }> = [];

    for (const scope of scopes) {
      const cleanup = await cleanupPlaceholderData(scope);
      cleanupSummaryRaw[scope] = cleanup;
    }

    if (!body.cleanupOnly) {
      for (const scope of scopes) {
        const run = await runPipeline({
          triggerType: "manual",
          marketScope: scope,
          strategyKey: defaultStrategyForScope(scope),
          llmProviderName: llmProvider,
          ignoreMinInterval: true
        });
        runResults.push({ marketScope: scope, status: run.status, errorSummary: run.errorSummary });
      }
    }

    return jsonOk({
      scopes,
      cleanupOnly: Boolean(body.cleanupOnly),
      llmProvider: llmProvider ?? null,
      cleanup: toCleanupSummary(scopes, cleanupSummaryRaw),
      runs: runResults
    });
  } catch (err) {
    const mapped = classifyApiError(err);
    if (mapped.code === "unauthorized") logAuthFailure("/api/agent/maintenance/rebuild-placeholders", mapped.message);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
