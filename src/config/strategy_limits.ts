import { LIMITS, type PipelineLimits } from "@/config/limits";
import { getNumberEnv } from "@/config/runtime";
import type { StrategyKey } from "@/core/pipeline/strategy_keys";

function withBase(base: PipelineLimits, override: Partial<PipelineLimits>): PipelineLimits {
  return {
    gatherMaxItemsPerSource: override.gatherMaxItemsPerSource ?? base.gatherMaxItemsPerSource,
    scoreTopN: override.scoreTopN ?? base.scoreTopN,
    decideTopN: override.decideTopN ?? base.decideTopN,
    llmMaxSignalsPerRun: override.llmMaxSignalsPerRun ?? base.llmMaxSignalsPerRun,
    llmMaxCallsPerRun: override.llmMaxCallsPerRun ?? base.llmMaxCallsPerRun,
    llmMaxTokensPerCall: override.llmMaxTokensPerCall ?? base.llmMaxTokensPerCall,
    minSecondsBetweenRuns: override.minSecondsBetweenRuns ?? base.minSecondsBetweenRuns,
    runMaxSeconds: override.runMaxSeconds ?? base.runMaxSeconds
  };
}

function envOverride(prefix: string, fallback: PipelineLimits): Partial<PipelineLimits> {
  return {
    gatherMaxItemsPerSource: getNumberEnv(`${prefix}_GATHER_MAX_ITEMS_PER_SOURCE`, fallback.gatherMaxItemsPerSource),
    decideTopN: getNumberEnv(`${prefix}_DECIDE_TOP_N`, fallback.decideTopN),
    llmMaxSignalsPerRun: getNumberEnv(`${prefix}_LLM_MAX_SIGNALS_PER_RUN`, fallback.llmMaxSignalsPerRun),
    llmMaxCallsPerRun: getNumberEnv(`${prefix}_LLM_MAX_CALLS_PER_RUN`, fallback.llmMaxCallsPerRun),
    llmMaxTokensPerCall: getNumberEnv(`${prefix}_LLM_MAX_TOKENS_PER_CALL`, fallback.llmMaxTokensPerCall)
  };
}

export function resolveStrategyLimits(strategyKey: StrategyKey, base: PipelineLimits = LIMITS): PipelineLimits {
  if (strategyKey === "kr_default") {
    const fallback = withBase(base, {
      gatherMaxItemsPerSource: Math.min(base.gatherMaxItemsPerSource, 120),
      decideTopN: Math.min(base.decideTopN, 8),
      llmMaxSignalsPerRun: Math.min(base.llmMaxSignalsPerRun, 8),
      llmMaxCallsPerRun: Math.min(base.llmMaxCallsPerRun, 8)
    });
    return withBase(fallback, envOverride("KR", fallback));
  }

  if (strategyKey === "all_default") {
    const fallback = withBase(base, {
      gatherMaxItemsPerSource: Math.max(base.gatherMaxItemsPerSource, 220),
      decideTopN: Math.max(base.decideTopN, 12),
      llmMaxSignalsPerRun: Math.max(base.llmMaxSignalsPerRun, 12),
      llmMaxCallsPerRun: Math.max(base.llmMaxCallsPerRun, 12)
    });
    return withBase(fallback, envOverride("ALL", fallback));
  }

  const fallback = withBase(base, {});
  return withBase(fallback, envOverride("US", fallback));
}
