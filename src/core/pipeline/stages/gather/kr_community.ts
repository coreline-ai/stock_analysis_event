import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { extractKrTickerCandidatesByName } from "../normalize/kr_ticker_cache";
import { fetchText } from "./http";
import { parseRssItems } from "./news";
import { buildKrMarketMetadata } from "./kr_market_meta";

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:1d")}&hl=ko&gl=KR&ceid=KR:ko`;
}

const COMMUNITY_QUERIES = [
  { query: "site:paxnet.co.kr", sourceDetail: "paxnet_community" }, // 팍스넷
  { query: "site:thinkpool.com", sourceDetail: "thinkpool_community" }, // 씽크풀
  { query: "증권플러스 종목 토론", sourceDetail: "stockplus_community" },
  { query: "종목 토론방 반응", sourceDetail: "general_community" },
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
      const symbols = [
        ...extractKrTickerCandidates(text),
        ...extractTickerCandidates(text),
        ...extractKrTickerCandidatesByName(text)
      ];
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
          rawPayload: buildKrMarketMetadata({
            title: rss.title,
            body: null,
            base: {
              source_detail: item.sourceDetail,
              market_scope: "KR",
              query: item.query
            }
          })
        } satisfies SignalRaw
      );
    }
  }

  return Array.from(dedup.values()).slice(0, limit);
}
