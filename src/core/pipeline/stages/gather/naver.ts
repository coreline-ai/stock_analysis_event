import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { fetchText } from "./http";
import { parseRssItems } from "./news";

export async function gatherNaver(limit = 20): Promise<SignalRaw[]> {
  const xml = await fetchText("https://finance.naver.com/news/news_list.naver?mode=RSS2");
  if (!xml) return [];
  const items = parseRssItems(xml);

  return items.slice(0, limit).map((item) => {
    const text = `${item.title}`.trim();
    const symbols = [...extractKrTickerCandidates(text), ...extractTickerCandidates(text)];
    return {
      source: "naver",
      externalId: item.link || `naver_${Date.now()}`,
      symbolCandidates: symbols,
      title: item.title,
      body: null,
      url: item.link || null,
      author: null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: { source_detail: "naver_finance_rss", market_scope: "KR" }
    } satisfies SignalRaw;
  });
}
