import { getNumberEnv } from "./runtime";

export const LIMITS = {
  gatherMaxItemsPerSource: getNumberEnv("GATHER_MAX_ITEMS_PER_SOURCE", 200),
  scoreTopN: getNumberEnv("SCORE_TOP_N", 50),
  decideTopN: getNumberEnv("DECIDE_TOP_N", 10),
  llmMaxSignalsPerRun: getNumberEnv("LLM_MAX_SIGNALS_PER_RUN", 10),
  llmMaxCallsPerRun: getNumberEnv("LLM_MAX_CALLS_PER_RUN", 10),
  llmMaxTokensPerCall: getNumberEnv("LLM_MAX_TOKENS_PER_CALL", 1500),
  minSecondsBetweenRuns: getNumberEnv("MIN_SECONDS_BETWEEN_RUNS", 120),
  runMaxSeconds: getNumberEnv("RUN_MAX_SECONDS", 25)
};
