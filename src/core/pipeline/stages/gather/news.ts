import type { SignalRaw } from "@/core/domain/types";
import { extractKrTickerCandidates, extractTickerCandidates } from "../normalize/symbol_map";
import { extractKrTickerCandidatesByName } from "../normalize/kr_ticker_cache";
import { nowIso } from "@/core/utils/time";
import { getEnv } from "@/config/runtime";
import { fetchJson, fetchText } from "./http";
import { buildKrMarketMetadata } from "./kr_market_meta";

export function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1] ?? "";
    const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
      itemXml.match(/<title>(.*?)<\/title>/)?.[1] ||
      "")
      .trim();
    const link = (itemXml.match(/<link>(.*?)<\/link>/)?.[1] || "").trim();
    const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "").trim();
    if (title) items.push({ title, link, pubDate });
  }
  return items;
}

export async function gatherNews(limit = 20): Promise<SignalRaw[]> {
  const apiKey = getEnv("NEWS_API_KEY");
  if (apiKey) {
    const data = await fetchJson<{ articles?: Array<any> }>(
      `https://newsapi.org/v2/everything?q=stock%20market&language=en&pageSize=${limit}&apiKey=${apiKey}`
    );
    if (!data) return [];
    const articles = data.articles ?? [];
    return articles.map((a) => {
      const title = a.title ?? "";
      const symbols = extractTickerCandidates(title);
      return {
        source: "news",
        externalId: a.url ?? `news_${Date.now()}`,
        symbolCandidates: symbols,
        title,
        body: a.description ?? null,
        url: a.url ?? null,
        author: a.author ?? null,
        publishedAt: a.publishedAt ?? null,
        collectedAt: nowIso(),
        engagement: null,
        rawPayload: { source_detail: "newsapi" }
      } satisfies SignalRaw;
    });
  }

  const xml = await fetchText(
    "https://news.google.com/rss/search?q=(stock%20market%20OR%20earnings%20OR%20ipo)%20when:1d&hl=en-US&gl=US&ceid=US:en"
  );
  if (!xml) return [];
  const items = parseRssItems(xml);

  return items.slice(0, limit).map((item) => {
    const symbols = extractTickerCandidates(item.title);
    return {
      source: "news",
      externalId: item.link || `news_${Date.now()}`,
      symbolCandidates: symbols,
      title: item.title,
      body: null,
      url: item.link || null,
      author: null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: { source_detail: "google_news_rss" }
    } satisfies SignalRaw;
  });
}

export async function gatherKrNews(limit = 20): Promise<SignalRaw[]> {
  const apiKey = getEnv("NEWS_API_KEY");
  if (apiKey) {
    const data = await fetchJson<{ articles?: Array<any> }>(
      `https://newsapi.org/v2/everything?q=한국%20주식%20OR%20코스피%20OR%20코스닥&language=ko&pageSize=${limit}&apiKey=${apiKey}`
    );
    if (!data) return [];
    const articles = data.articles ?? [];
    return articles.map((a) => {
      const title = a.title ?? "";
      const body = a.description ?? "";
      const text = `${title} ${body}`.trim();
      const symbols = [
        ...extractKrTickerCandidates(text),
        ...extractTickerCandidates(text),
        ...extractKrTickerCandidatesByName(text)
      ];
      return {
        source: "kr_news",
        externalId: a.url ?? `kr_news_${Date.now()}`,
        symbolCandidates: symbols,
        title,
        body: body || null,
        url: a.url ?? null,
        author: a.author ?? null,
        publishedAt: a.publishedAt ?? null,
        collectedAt: nowIso(),
        engagement: null,
        rawPayload: buildKrMarketMetadata({
          title,
          body,
          base: { source_detail: "newsapi_kr", market_scope: "KR" }
        })
      } satisfies SignalRaw;
    });
  }

  const xml = await fetchText(
    "https://news.google.com/rss/search?q=(한국%20주식%20OR%20코스피%20OR%20코스닥%20OR%20개별종목%20OR%20증권사%20리포트)%20when:1d&hl=ko&gl=KR&ceid=KR:ko"
  );
  if (!xml) return [];
  const items = parseRssItems(xml);

  return items.slice(0, limit).map((item) => {
    const text = `${item.title}`.trim();
    const symbols = [
      ...extractKrTickerCandidates(text),
      ...extractTickerCandidates(text),
      ...extractKrTickerCandidatesByName(text)
    ];
    return {
      source: "kr_news",
      externalId: item.link || `kr_news_${Date.now()}`,
      symbolCandidates: symbols,
      title: item.title,
      body: null,
      url: item.link || null,
      author: null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: buildKrMarketMetadata({
        title: item.title,
        body: null,
        base: { source_detail: "google_news_rss_kr", market_scope: "KR" }
      })
    } satisfies SignalRaw;
  });
}
