import { unzipSync } from "node:zlib";
import { getEnv } from "@/config/runtime";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NAVER_LISTING_MAX_PAGES = 20;

const DEFAULT_KR_TICKERS: Array<[string, string]> = [
  ["005930", "삼성전자"],
  ["000660", "SK하이닉스"],
  ["035420", "네이버"],
  ["005380", "현대차"],
  ["035720", "카카오"],
  ["051910", "LG화학"],
  ["068270", "셀트리온"],
  ["207940", "삼성바이오로직스"],
  ["105560", "KB금융"],
  ["096770", "SK이노베이션"]
];

const codeToName = new Map<string, string>(DEFAULT_KR_TICKERS);
const nameToCode = new Map<string, string>(
  DEFAULT_KR_TICKERS.map(([code, name]) => [normalizeKrName(name), code] as const)
);
let nameToCodeEntries = Array.from(nameToCode.entries()).sort((a, b) => b[0].length - a[0].length);

let lastFetchedAt = 0;
let hasFullUniverse = false;

function normalizeKrName(name: string): string {
  return name.replace(/\s+/g, "").toUpperCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFlexibleNameRegex(normalizedName: string): RegExp {
  const chars = normalizedName.split("").map(escapeRegExp).join("\\s*");
  return new RegExp(`(^|[^0-9A-Z가-힣])${chars}(?=($|[^0-9A-Z가-힣]|[은는이가의를을와과도만에로]))`, "u");
}

function rebuildNameEntries(): void {
  nameToCodeEntries = Array.from(nameToCode.entries()).sort((a, b) => b[0].length - a[0].length);
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseCorpCodeXml(xml: string): Array<{ code: string; name: string }> {
  const rows: Array<{ code: string; name: string }> = [];
  const listRegex = /<list>([\s\S]*?)<\/list>/g;
  let listMatch: RegExpExecArray | null;
  while ((listMatch = listRegex.exec(xml)) !== null) {
    const node = listMatch[1] ?? "";
    const stockCode = (node.match(/<stock_code>(.*?)<\/stock_code>/)?.[1] ?? "").trim();
    const corpName = decodeXml((node.match(/<corp_name>(.*?)<\/corp_name>/)?.[1] ?? "").trim());
    if (!/^\d{6}$/.test(stockCode) || !corpName) continue;
    rows.push({ code: stockCode, name: corpName });
  }
  return rows;
}

async function fetchNaverListingPage(market: 0 | 1, page: number): Promise<Array<{ code: string; name: string }>> {
  const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${market}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (stock-analysis-event)"
    }
  });
  if (!res.ok) return [];
  const bytes = new Uint8Array(await res.arrayBuffer());
  const html = new TextDecoder("euc-kr").decode(bytes);
  const rows: Array<{ code: string; name: string }> = [];
  const regex = /href="\/item\/main\.naver\?code=(\d{6})"[^>]*>([^<]+)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const code = (match[1] ?? "").trim();
    const name = decodeHtml((match[2] ?? "").trim());
    if (!/^\d{6}$/.test(code) || !name) continue;
    rows.push({ code, name });
  }
  return rows;
}

async function fetchKrTickersFromNaver(): Promise<Array<{ code: string; name: string }>> {
  const dedup = new Map<string, string>();
  for (const market of [0, 1] as const) {
    for (let page = 1; page <= NAVER_LISTING_MAX_PAGES; page += 1) {
      const rows = await fetchNaverListingPage(market, page);
      if (rows.length === 0) break;
      for (const row of rows) {
        if (!dedup.has(row.code)) dedup.set(row.code, row.name);
      }
    }
  }
  return Array.from(dedup.entries()).map(([code, name]) => ({ code, name }));
}

export async function refreshKrTickersIfNeeded(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchedAt < CACHE_TTL_MS) return;

  const key = getEnv("DART_API_KEY");
  let rows: Array<{ code: string; name: string }> = [];
  if (key) {
    const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      let xml = "";
      try {
        xml = unzipSync(bytes).toString("utf-8");
      } catch {
        xml = new TextDecoder("utf-8").decode(bytes);
      }
      rows = parseCorpCodeXml(xml);
    }
  }
  if (rows.length === 0) {
    rows = await fetchKrTickersFromNaver();
  }
  if (rows.length === 0) {
    lastFetchedAt = now;
    return;
  }

  for (const row of rows) {
    codeToName.set(row.code, row.name);
    nameToCode.set(normalizeKrName(row.name), row.code);
  }
  rebuildNameEntries();

  hasFullUniverse = true;
  lastFetchedAt = now;
}

export function hasKrTickerUniverse(): boolean {
  return hasFullUniverse;
}

export function isKnownKrxTicker(code: string): boolean {
  if (!/^\d{6}$/.test(code.trim())) return false;
  if (!hasFullUniverse) return true;
  return codeToName.has(code);
}

export function lookupKrTickerName(code: string): string | null {
  return codeToName.get(code.trim()) ?? null;
}

export function lookupKrTickerCodeByName(name: string): string | null {
  return nameToCode.get(normalizeKrName(name)) ?? null;
}

export interface KrTickerSearchResult {
  code: string;
  name: string;
}

export function searchKrTickers(query: string, limit = 10): KrTickerSearchResult[] {
  const raw = query.trim();
  if (!raw) return [];
  const normalized = normalizeKrName(raw);
  const max = Math.max(1, Math.min(limit, 30));

  const ranked: Array<{ score: number; code: string; name: string }> = [];
  for (const [code, name] of codeToName.entries()) {
    const normalizedName = normalizeKrName(name);
    let score = Number.POSITIVE_INFINITY;

    if (code === raw) score = 0;
    else if (normalizedName === normalized) score = 0.1;
    else if (code.startsWith(raw)) score = 1;
    else if (normalizedName.startsWith(normalized)) score = 2;
    else if (code.includes(raw)) score = 3;
    else if (normalizedName.includes(normalized)) score = 4;
    else continue;

    ranked.push({ score, code, name });
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.code.length !== b.code.length) return a.code.length - b.code.length;
    return a.code.localeCompare(b.code);
  });

  return ranked.slice(0, max).map((item) => ({ code: item.code, name: item.name }));
}

export function extractKrTickerCandidatesByName(text: string, limit = 3): string[] {
  const normalized = normalizeKrName(text);
  const upperText = text.toUpperCase();
  if (!normalized || !upperText) return [];
  const matches = new Set<string>();
  const regexCache = new Map<string, RegExp>();

  for (const [name, code] of nameToCodeEntries) {
    if (name.length < 2) continue;
    if (!normalized.includes(name)) continue;
    let matcher = regexCache.get(name);
    if (!matcher) {
      matcher = buildFlexibleNameRegex(name);
      regexCache.set(name, matcher);
    }
    if (!matcher.test(upperText)) continue;
    matches.add(code);
    if (matches.size >= limit) break;
  }

  return Array.from(matches);
}
