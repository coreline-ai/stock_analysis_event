import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { extractKrTickerCandidatesByName } from "../normalize/kr_ticker_cache";
import { fetchText } from "./http";
import { parseRssItems } from "./news";

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:1d")}&hl=ko&gl=KR&ceid=KR:ko`;
}

const RESEARCH_QUERIES = [
  { query: "site:hkconsensus.hankyung.com", sourceDetail: "hankyung_consensus_free" }, // 한경 컨센서스 직접 타겟팅
  { query: "한경 컨센서스 리포트", sourceDetail: "hankyung_consensus_free" },
  { query: "목표주가 상향", sourceDetail: "broker_report_free" },
  { query: "투자의견 매수", sourceDetail: "broker_report_free" },
  { query: "기업분석 리포트", sourceDetail: "company_analysis_report" }
];

export async function gatherKrResearch(limit = 20): Promise<SignalRaw[]> {
  const perQuery = Math.max(4, Math.ceil(limit / RESEARCH_QUERIES.length));
  const dedup = new Map<string, SignalRaw>();

  for (const item of RESEARCH_QUERIES) {
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
      const externalId = rss.link || `kr_research_${encodeURIComponent(fallback).slice(0, 180)}`;
      if (dedup.has(externalId)) continue;
      dedup.set(
        externalId,
        {
          source: "kr_research",
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
