import type { LLMProvider } from "@/adapters/llm/provider";
import type { LogEntry } from "@/core/utils/logger";
import type { PipelineLimits } from "@/config/limits";
import type { MarketScope } from "@/core/domain/types";

export type PipelineStage<I, O> = (input: I, ctx: PipelineContext) => Promise<O> | O;

export interface PipelineContext {
  runId: string;
  startedAt: string;
  marketScope: MarketScope;
  strategyKey: string;
  limits: PipelineLimits;
  logger: {
    info: (message: string, data?: Record<string, unknown>) => LogEntry;
    warn: (message: string, data?: Record<string, unknown>) => LogEntry;
    error: (message: string, data?: Record<string, unknown>) => LogEntry;
  };
}

export interface PipelineAdapters {
  llmProvider?: LLMProvider;
  lock?: {
    acquire: (key: string, ttlMs: number) => Promise<{ key: string; token: string } | null>;
    release: (handle: { key: string; token: string }) => Promise<void>;
  };
}
