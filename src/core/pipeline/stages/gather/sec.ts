import type { SignalRaw } from "@/core/domain/types";
import { nowIso } from "@/core/utils/time";
import { fetchJson, fetchText } from "./http";

interface SecEntry {
  id: string;
  title: string;
  updated: string;
  form: string;
  company: string;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] ?? null : null;
}

export function parseAtom(xml: string): SecEntry[] {
  const entries: SecEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    if (!entryXml) continue;

    const id = extractTag(entryXml, "id") ?? `sec_${Date.now()}`;
    const title = extractTag(entryXml, "title") ?? "";
    const updated = extractTag(entryXml, "updated") ?? new Date().toISOString();

    const formMatch = title.match(/\(([^)]+)\)/);
    const form = formMatch ? formMatch[1] ?? "" : "";
    const companyMatch = title.match(/^([^\(]+)/);
    const company = companyMatch ? companyMatch[1]?.trim() ?? "" : "";

    if (form && company) entries.push({ id, title, updated, form, company });
  }

  return entries;
}

const companyCache = new Map<string, string | null>();

async function resolveTickerFromCompany(company: string): Promise<string | null> {
  const key = company.toUpperCase();
  if (companyCache.has(key)) return companyCache.get(key) ?? null;

  try {
    const data = await fetchJson<Record<string, { ticker: string; title: string }>>(
      "https://www.sec.gov/files/company_tickers.json",
      { headers: { "User-Agent": "mahoraga-research-only" } }
    );
    if (!data) return null;

    for (const entry of Object.values(data)) {
      const title = entry.title.toUpperCase();
      if (title === key || title.includes(key) || key.includes(title)) {
        companyCache.set(key, entry.ticker);
        return entry.ticker;
      }
    }
  } catch {
    return null;
  }

  companyCache.set(key, null);
  return null;
}

export async function gatherSecEdgar(limit = 20): Promise<SignalRaw[]> {
  const xml = await fetchText(
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&count=40&output=atom",
    {
      headers: {
        "User-Agent": "mahoraga-research-only",
        Accept: "application/atom+xml"
      }
    }
  );
  if (!xml) return [];
  const entries = parseAtom(xml);
  const results: SignalRaw[] = [];

  for (const entry of entries.slice(0, limit)) {
    const ticker = await resolveTickerFromCompany(entry.company);
    if (!ticker) continue;

    results.push({
      source: "sec",
      externalId: entry.id,
      symbolCandidates: [ticker],
      title: entry.title,
      body: null,
      url: null,
      author: null,
      publishedAt: new Date(entry.updated).toISOString(),
      collectedAt: nowIso(),
      engagement: null,
      rawPayload: {
        form: entry.form,
        company: entry.company
      }
    });
  }

  return results;
}
