import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { fetchText } from "./http";
import { parseRssItems } from "./news";

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

const GLOBAL_CONTEXT_QUERIES = [
  { query: "인베스팅닷컴 코리아 환율", sourceDetail: "investing_kr_fx" },
  { query: "인베스팅닷컴 코리아 야간선물", sourceDetail: "investing_kr_futures" },
  { query: "원달러 환율 코스피 외국인", sourceDetail: "kr_macro_fx_flow" }
];

export async function gatherKrGlobalContext(limit = 20): Promise<SignalRaw[]> {
  const perQuery = Math.max(5, Math.ceil(limit / GLOBAL_CONTEXT_QUERIES.length));
  const dedup = new Map<string, SignalRaw>();

  for (const item of GLOBAL_CONTEXT_QUERIES) {
    const xml = await fetchText(googleNewsRssUrl(item.query));
    if (!xml) continue;
    const rssItems = parseRssItems(xml).slice(0, perQuery);

    for (const rss of rssItems) {
      const text = rss.title.trim();
      const symbols = [...extractKrTickerCandidates(text), ...extractTickerCandidates(text)];
      const fallback = `${item.sourceDetail}:${rss.title}:${rss.pubDate || ""}`;
      const externalId = rss.link || `kr_global_context_${encodeURIComponent(fallback).slice(0, 180)}`;
      if (dedup.has(externalId)) continue;
      dedup.set(
        externalId,
        {
          source: "kr_global_context",
          externalId,
          symbolCandidates: symbols,
          title: rss.title,
          body: null,
          url: rss.link || null,
          author: null,
          publishedAt: rss.pubDate ? new Date(rss.pubDate).toISOString() : null,
          collectedAt: nowIso(),
          engagement: null,
          rawPayload: {
            source_detail: item.sourceDetail,
            market_scope: "KR",
            query: item.query
          }
        } satisfies SignalRaw
      );
    }
  }

  return Array.from(dedup.values()).slice(0, limit);
}
