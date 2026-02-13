import { cleanupPlaceholderData } from "@/adapters/db/repositories/maintenance_repo";
import type { MarketScope } from "@/core/domain/types";
import type { LLMProviderName } from "@/adapters/llm/provider";
import { defaultStrategyForScope, parseMarketScope } from "@/core/pipeline/strategy_keys";
import { runPipeline } from "@/core/pipeline/run_pipeline";

function parseScopes(): MarketScope[] {
  const defaultScope = parseMarketScope(process.env.DEFAULT_MARKET_SCOPE, "KR");
  const fallbackScope = defaultScope === "US" || defaultScope === "KR" ? defaultScope : "KR";
  const raw = process.env.REBUILD_SCOPES ?? fallbackScope;
  const deduped = new Set<MarketScope>();
  for (const token of raw.split(",")) {
    const normalized = token.trim().toUpperCase();
    if (normalized !== "US" && normalized !== "KR") continue;
    deduped.add(normalized);
  }
  return deduped.size > 0 ? Array.from(deduped) : [fallbackScope];
}

function parseProvider(): LLMProviderName | null {
  const value = (process.env.REBUILD_LLM_PROVIDER ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "glm" || value === "openai" || value === "gemini") return value;
  throw new Error("invalid REBUILD_LLM_PROVIDER (allowed: glm|openai|gemini)");
}

async function main() {
  const scopes = parseScopes();
  const llmProvider = parseProvider();
  const cleanupOnly = process.env.CLEANUP_ONLY === "1" || process.env.CLEANUP_ONLY?.toLowerCase() === "true";

  console.log(`[rebuild] scopes=${scopes.join(",")} cleanupOnly=${cleanupOnly} llmProvider=${llmProvider ?? "env_default"}`);
  for (const scope of scopes) {
    const cleanup = await cleanupPlaceholderData(scope);
    console.log(`[rebuild] cleanup ${scope}: decisions=${cleanup.deletedDecisions} reports=${cleanup.deletedReports}`);
  }

  if (cleanupOnly) return;

  for (const scope of scopes) {
    const result = await runPipeline({
      triggerType: "manual",
      marketScope: scope,
      strategyKey: defaultStrategyForScope(scope),
      llmProviderName: llmProvider,
      ignoreMinInterval: true
    });
    console.log(
      `[rebuild] run ${scope}: status=${result.status} raw=${result.rawCount} scored=${result.scoredCount} decided=${result.decidedCount} error=${result.errorSummary ?? "-"}`
    );
  }
}

main().catch((err) => {
  console.error("[rebuild] failed", err);
  process.exit(1);
});
