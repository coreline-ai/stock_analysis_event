import type { MarketScope, SignalRaw } from "@/core/domain/types";
import { gatherReddit } from "./reddit";
import { gatherStockTwits } from "./stocktwits";
import { gatherSecEdgar } from "./sec";
import { gatherKrNews, gatherNews } from "./news";
import { gatherCrypto } from "./crypto";
import { LIMITS, type PipelineLimits } from "@/config/limits";
import { getBooleanEnv } from "@/config/runtime";
import { gatherNaver } from "./naver";
import { gatherDart } from "./dart";
import { gatherKrCommunity } from "./kr_community";
import { gatherKrResearch } from "./kr_research";
import { gatherKrGlobalContext } from "./kr_global_context";

export interface GatherResult {
  signals: SignalRaw[];
  counts: Record<string, number>;
}

type GatherTask = { name: string; fn: () => Promise<SignalRaw[]>; required?: boolean };

export function buildGatherTasks(scope: MarketScope): GatherTask[] {
  const usTasks: GatherTask[] = [
    { name: "reddit", fn: () => gatherReddit(25) },
    { name: "stocktwits", fn: () => gatherStockTwits(15) },
    { name: "sec", fn: () => gatherSecEdgar(20) },
    { name: "news", fn: () => gatherNews(20) },
    { name: "crypto", fn: () => gatherCrypto() }
  ];
  const krEnabled = getBooleanEnv("KR_MARKET_ENABLED", true);
  const krTasks: GatherTask[] = [];
  if (krEnabled) {
    if (getBooleanEnv("NAVER_ENABLED", true)) {
      krTasks.push({ name: "naver", fn: () => gatherNaver(25) });
    }
    if (getBooleanEnv("DART_ENABLED", true)) {
      krTasks.push({ name: "dart", fn: () => gatherDart(30) });
    }
    if (getBooleanEnv("KR_COMMUNITY_ENABLED", true)) {
      krTasks.push({ name: "kr_community", fn: () => gatherKrCommunity(30) });
    }
    if (getBooleanEnv("KR_NEWS_ENABLED", true)) {
      krTasks.push({ name: "kr_news", fn: () => gatherKrNews(40) });
    }
    if (getBooleanEnv("KR_RESEARCH_ENABLED", true)) {
      krTasks.push({ name: "kr_research", fn: () => gatherKrResearch(30) });
    }
    if (getBooleanEnv("KR_GLOBAL_CONTEXT_ENABLED", true)) {
      krTasks.push({ name: "kr_global_context", fn: () => gatherKrGlobalContext(25) });
    }
  }

  if (scope === "US") return usTasks;
  if (scope === "KR") return krTasks;
  return [...usTasks, ...krTasks];
}

// External ID policy:
// - externalId must be stable for the same source event (source + externalId unique)
// - prefer upstream IDs or URLs; avoid Date.now() unless no stable key exists
export async function runGather(scope: MarketScope = "US", limits: PipelineLimits = LIMITS): Promise<GatherResult> {
  const tasks = buildGatherTasks(scope);

  const results = await Promise.allSettled(tasks.map((t) => t.fn()));
  const signals: SignalRaw[] = [];
  const counts: Record<string, number> = {};
  const requiredErrors: Error[] = [];

  results.forEach((result, idx) => {
    const task = tasks[idx];
    const name = task?.name ?? `source_${idx}`;
    if (result.status === "fulfilled") {
      const limited = result.value.slice(0, limits.gatherMaxItemsPerSource);
      counts[name] = limited.length;
      signals.push(...limited);
    } else {
      counts[name] = 0;
      if (task?.required) {
        const reason = result.reason instanceof Error ? result.reason : new Error(String(result.reason ?? "unknown_error"));
        requiredErrors.push(reason);
      }
    }
  });

  if (requiredErrors.length > 0) throw requiredErrors[0];

  return { signals, counts };
}
