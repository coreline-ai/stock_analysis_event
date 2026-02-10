import type { SignalRaw } from "@/core/domain/types";
import { gatherReddit } from "./reddit";
import { gatherStockTwits } from "./stocktwits";
import { gatherSecEdgar } from "./sec";
import { gatherNews } from "./news";
import { gatherCrypto } from "./crypto";
import { LIMITS } from "@/config/limits";

export interface GatherResult {
  signals: SignalRaw[];
  counts: Record<string, number>;
}

// External ID policy:
// - externalId must be stable for the same source event (source + externalId unique)
// - prefer upstream IDs or URLs; avoid Date.now() unless no stable key exists
export async function runGather(): Promise<GatherResult> {
  const tasks = [
    { name: "reddit", fn: () => gatherReddit(25) },
    { name: "stocktwits", fn: () => gatherStockTwits(15) },
    { name: "sec", fn: () => gatherSecEdgar(20) },
    { name: "news", fn: () => gatherNews(20) },
    { name: "crypto", fn: () => gatherCrypto() }
  ];

  const results = await Promise.allSettled(tasks.map((t) => t.fn()));
  const signals: SignalRaw[] = [];
  const counts: Record<string, number> = {};

  results.forEach((result, idx) => {
    const name = tasks[idx]?.name ?? `source_${idx}`;
    if (result.status === "fulfilled") {
      const limited = result.value.slice(0, LIMITS.gatherMaxItemsPerSource);
      counts[name] = limited.length;
      signals.push(...limited);
    } else {
      counts[name] = 0;
    }
  });

  return { signals, counts };
}
