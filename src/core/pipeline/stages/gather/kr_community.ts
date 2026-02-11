import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { fetchText } from "./http";
import { parseRssItems } from "./news";

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

const COMMUNITY_QUERIES = [
  { query: "증권플러스 종목 토론", sourceDetail: "stockplus_community" },
  { query: "팍스넷 종목 토론", sourceDetail: "paxnet_community" },
  { query: "씽크풀 종목 토론", sourceDetail: "thinkpool_community" },
  { query: "네이버 종토방 인기", sourceDetail: "naver_jongtobang" }
];

export async function gatherKrCommunity(limit = 20): Promise<SignalRaw[]> {
  const perQuery = Math.max(4, Math.ceil(limit / COMMUNITY_QUERIES.length));
  const dedup = new Map<string, SignalRaw>();

  for (const item of COMMUNITY_QUERIES) {
    const xml = await fetchText(googleNewsRssUrl(item.query));
    if (!xml) continue;
    const rssItems = parseRssItems(xml).slice(0, perQuery);

    for (const rss of rssItems) {
      const text = rss.title.trim();
      const symbols = [...extractKrTickerCandidates(text), ...extractTickerCandidates(text)];
      const fallback = `${item.sourceDetail}:${rss.title}:${rss.pubDate || ""}`;
      const externalId = rss.link || `kr_community_${encodeURIComponent(fallback).slice(0, 180)}`;
      if (dedup.has(externalId)) continue;
      dedup.set(
        externalId,
        {
          source: "kr_community",
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
