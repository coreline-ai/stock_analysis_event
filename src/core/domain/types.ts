export type SignalSource = "reddit" | "stocktwits" | "sec" | "news" | "crypto";

export interface SignalRaw {
  id?: string;
  source: SignalSource;
  externalId: string;
  symbolCandidates: string[];
  title?: string | null;
  body?: string | null;
  url?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  collectedAt: string;
  engagement?: Record<string, number> | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface SignalScored {
  id?: string;
  rawId: string;
  symbol: string;
  sentimentScore: number;
  freshnessScore: number;
  sourceWeight: number;
  finalScore: number;
  reasonSummary?: string | null;
  scoredAt: string;
}

export type DecisionVerdict = "BUY_NOW" | "WATCH" | "AVOID";

export interface Decision {
  id?: string;
  symbol: string;
  verdict: DecisionVerdict;
  confidence: number;
  timeHorizon: "intraday" | "swing" | "long_term";
  thesisSummary: string;
  entryTrigger: string;
  invalidation: string;
  riskNotes: string[];
  bullCase: string[];
  bearCase: string[];
  redFlags: string[];
  catalysts: string[];
  sourcesUsed: string[];
  llmModel: string;
  promptVersion: string;
  schemaVersion: string;
  createdAt: string;
}

export interface DailyReport {
  id?: string;
  reportDate: string;
  summaryMarkdown: string;
  topBuyNow: string[];
  topWatch: string[];
  themes: string[];
  risks: string[];
  createdAt: string;
}

export type AgentRunStatus = "success" | "partial" | "failed";

export interface AgentRun {
  id?: string;
  triggerType: "cron" | "manual";
  startedAt: string;
  finishedAt?: string | null;
  status: AgentRunStatus;
  gatheredCounts?: Record<string, number> | null;
  scoredCount?: number | null;
  decidedCount?: number | null;
  llmCalls?: number | null;
  llmTokensEstimated?: number | null;
  errorSummary?: string | null;
  stageTimingsMs?: Record<string, number> | null;
  createdAt: string;
}
