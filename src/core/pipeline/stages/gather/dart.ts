import type { SignalRaw } from "@/core/domain/types";
import { getBooleanEnv, getEnv } from "@/config/runtime";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates } from "../normalize/symbol_map";
import { extractKrTickerCandidatesByName } from "../normalize/kr_ticker_cache";
import { fetchJson, fetchText } from "./http";
import { parseRssItems } from "./news";
import { buildKrMarketMetadata } from "./kr_market_meta";

interface DartDisclosure {
  rcept_no?: string;
  corp_name?: string;
  stock_code?: string;
  report_nm?: string;
  rcept_dt?: string;
}

interface DartListResponse {
  status?: string;
  message?: string;
  list?: DartDisclosure[];
}

function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function isoFromYyyymmdd(input?: string): string | null {
  if (!input || !/^\d{8}$/.test(input)) return null;
  const y = Number(input.slice(0, 4));
  const m = Number(input.slice(4, 6));
  const d = Number(input.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:2d")}&hl=ko&gl=KR&ceid=KR:ko`;
}

function mapDisclosuresToSignals(items: DartDisclosure[], limit: number): SignalRaw[] {
  return items.slice(0, limit).map((item) => {
    const corpName = item.corp_name?.trim() || "";
    const reportName = item.report_nm?.trim() || "";
    const text = `${corpName} ${reportName}`.trim();
    const candidates = new Set<string>([
      ...extractKrTickerCandidates(text),
      ...extractKrTickerCandidatesByName(text)
    ]);
    if (item.stock_code && /^\d{6}$/.test(item.stock_code)) candidates.add(item.stock_code);
    const receiptNo = item.rcept_no?.trim() || `${Date.now()}`;
    return {
      source: "dart",
      externalId: `dart_${receiptNo}`,
      symbolCandidates: Array.from(candidates),
      title: `${corpName}${corpName && reportName ? " - " : ""}${reportName}`.trim() || "DART 공시",
      body: null,
      url: item.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}` : null,
      author: "DART",
      publishedAt: isoFromYyyymmdd(item.rcept_dt),
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: buildKrMarketMetadata({
        title: `${corpName} ${reportName}`.trim(),
        body: null,
        base: {
          source_detail: "dart_openapi",
          market_scope: "KR",
          corp_name: corpName || null,
          report_name: reportName || null
        }
      })
    } satisfies SignalRaw;
  });
}

async function gatherDartNewsFallback(limit: number): Promise<SignalRaw[]> {
  const xml = await fetchText(googleNewsRssUrl("site:dart.fss.or.kr 공시 OR 전자공시 OR 정정공시"));
  if (!xml) return [];
  const rssItems = parseRssItems(xml).slice(0, limit);
  return rssItems.map((item) => {
    const text = item.title.trim();
    const candidates = new Set<string>([
      ...extractKrTickerCandidates(text),
      ...extractKrTickerCandidatesByName(text)
    ]);
    return {
      source: "dart",
      externalId: item.link || `dart_fallback_${encodeURIComponent(item.title).slice(0, 180)}`,
      symbolCandidates: Array.from(candidates),
      title: item.title,
      body: null,
      url: item.link || null,
      author: "DART",
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: buildKrMarketMetadata({
        title: item.title,
        body: null,
        base: {
          source_detail: "dart_google_news_fallback",
          market_scope: "KR"
        }
      })
    } satisfies SignalRaw;
  });
}

export async function gatherDart(limit = 20): Promise<SignalRaw[]> {
  const key = getEnv("DART_API_KEY");
  const fallbackEnabled = getBooleanEnv("DART_NEWS_FALLBACK_ENABLED", true);
  if (!key) {
    return fallbackEnabled ? gatherDartNewsFallback(limit) : [];
  }

  const dateWindows = [7, 30];
  for (const dayWindow of dateWindows) {
    const end = new Date();
    const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * dayWindow);
    const url =
      `https://opendart.fss.or.kr/api/list.json?crtfc_key=${encodeURIComponent(key)}` +
      `&bgn_de=${yyyymmdd(start)}&end_de=${yyyymmdd(end)}&corp_cls=Y&page_no=1&page_count=${Math.max(1, Math.min(limit * 2, 100))}`;
    const response = await fetchJson<DartListResponse>(url);
    if (!response) continue;
    if (response.status && response.status !== "000") continue;
    if ((response.list ?? []).length === 0) continue;
    return mapDisclosuresToSignals(response.list ?? [], limit);
  }

  return fallbackEnabled ? gatherDartNewsFallback(limit) : [];
}
