import { unzipSync } from "node:zlib";
import { getEnv } from "@/config/runtime";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_KR_TICKERS: Array<[string, string]> = [
  ["005930", "삼성전자"],
  ["000660", "SK하이닉스"],
  ["035420", "NAVER"],
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

export async function refreshKrTickersIfNeeded(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFetchedAt < CACHE_TTL_MS) return;

  const key = getEnv("DART_API_KEY");
  if (!key) {
    lastFetchedAt = now;
    return;
  }

  const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    lastFetchedAt = now;
    return;
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  let xml = "";
  try {
    xml = unzipSync(bytes).toString("utf-8");
  } catch {
    xml = bytes.toString("utf-8");
  }
  const rows = parseCorpCodeXml(xml);
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

export function extractKrTickerCandidatesByName(text: string, limit = 3): string[] {
  const normalized = normalizeKrName(text);
  if (!normalized) return [];
  const matches = new Set<string>();

  for (const [name, code] of nameToCodeEntries) {
    if (name.length < 2) continue;
    if (!normalized.includes(name)) continue;
    matches.add(code);
    if (matches.size >= limit) break;
  }

  return Array.from(matches);
}
