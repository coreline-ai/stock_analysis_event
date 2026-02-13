import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidatesByName } from "../normalize/kr_ticker_cache";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { fetchText } from "./http";
import { parseRssItems } from "./news";
import { buildKrMarketMetadata } from "./kr_market_meta";

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:1d")}&hl=ko&gl=KR&ceid=KR:ko`;
}

function sanitizeNaverTitle(title: string): string {
  return title
    .replace(/\s*-\s*Naver Finance\s*-\s*네이버 증권\s*$/iu, "")
    .replace(/\s*-\s*네이버 금융\s*-\s*NAVER\s*-\s*네이버 증권\s*$/iu, "")
    .replace(/\s*-\s*NAVER\s*-\s*네이버 증권\s*$/iu, "")
    .replace(/\s*-\s*네이버 증권\s*$/iu, "")
    .replace(/Naver\s*Finance/giu, " ")
    .replace(/NAVER/gu, " ")
    .replace(/네이버\s*금융/gu, " ")
    .replace(/네이버\s*증권/gu, " ")
    .replace(/\s*-\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildSignalsFromItems(sourceDetail: string, items: Array<{ title: string; link: string; pubDate: string }>, limit: number): SignalRaw[] {
  return items.slice(0, limit).map((item) => {
    const sanitizedTitle = sanitizeNaverTitle(item.title);
    const text = sanitizedTitle.trim();
    const symbols = Array.from(
      new Set([
      ...extractKrTickerCandidates(text),
      ...extractTickerCandidates(text),
      ...extractKrTickerCandidatesByName(text)
      ])
    );
    return {
      source: "naver",
      externalId: item.link || `naver_${Date.now()}`,
      symbolCandidates: symbols,
      title: sanitizedTitle || item.title,
      body: null,
      url: item.link || null,
      author: null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: buildKrMarketMetadata({
        title: sanitizedTitle || item.title,
        body: null,
        base: { source_detail: sourceDetail, market_scope: "KR" }
      })
    } satisfies SignalRaw;
  });
}

export async function gatherNaver(limit = 20): Promise<SignalRaw[]> {
  const xml = await fetchText("https://finance.naver.com/news/news_list.naver?mode=RSS2");
  if (xml && !xml.includes("잘못된 접근입니다")) {
    const items = parseRssItems(xml);
    if (items.length > 0) {
      return buildSignalsFromItems("naver_finance_rss", items, limit);
    }
  }

  // Fallback: 네이버 RSS 접근 차단 시 Google News에서 네이버 증권/종목 문서를 수집
  const fallbackXml = await fetchText(
    googleNewsRssUrl("site:finance.naver.com/item/main.naver OR site:finance.naver.com/news")
  );
  if (!fallbackXml) return [];
  const fallbackItems = parseRssItems(fallbackXml);
  return buildSignalsFromItems("naver_fallback_google_news", fallbackItems, limit);
}
