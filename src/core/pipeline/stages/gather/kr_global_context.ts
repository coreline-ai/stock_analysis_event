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

const GLOBAL_CONTEXT_QUERIES = [
  { query: "site:kr.investing.com 야간선물", sourceDetail: "investing_kr_futures" },
  { query: "site:kr.investing.com 환율", sourceDetail: "investing_kr_fx" },
  { query: "site:kr.investing.com 원자재", sourceDetail: "investing_kr_commodities" },
  { query: "달러 원 환율 전망", sourceDetail: "kr_macro_fx_flow" },
  { query: "코스피 야간선물 전망", sourceDetail: "kr_macro_futures" },
  { query: "미국 증시 영향", sourceDetail: "us_market_impact" }
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
      const symbols = [
        ...extractKrTickerCandidates(text),
        ...extractTickerCandidates(text),
        ...extractKrTickerCandidatesByName(text)
      ];
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
