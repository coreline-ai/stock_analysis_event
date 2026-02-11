import type { SignalRaw } from "@/core/domain/types";
import { getEnv } from "@/config/runtime";
import { nowIso } from "@/core/utils/time";
import { extractKrTickerCandidates } from "../normalize/symbol_map";
import { fetchJson } from "./http";

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

export async function gatherDart(limit = 20): Promise<SignalRaw[]> {
  const key = getEnv("DART_API_KEY");
  if (!key) {
    return [];
  }
  const end = new Date();
  const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 7);
  const url =
    `https://opendart.fss.or.kr/api/list.json?crtfc_key=${encodeURIComponent(key)}` +
    `&bgn_de=${yyyymmdd(start)}&end_de=${yyyymmdd(end)}&page_no=1&page_count=${Math.max(1, Math.min(limit, 100))}`;

  const response = await fetchJson<DartListResponse>(url);
  if (!response) return [];
  if (response.status && response.status !== "000") {
    return [];
  }

  return (response.list ?? []).slice(0, limit).map((item) => {
    const corpName = item.corp_name?.trim() || "";
    const reportName = item.report_nm?.trim() || "";
    const text = `${corpName} ${reportName}`.trim();
    const candidates = new Set<string>(extractKrTickerCandidates(text));
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
      rawPayload: {
        source_detail: "dart_openapi",
        market_scope: "KR",
        corp_name: corpName || null,
        report_name: reportName || null
      }
    } satisfies SignalRaw;
  });
}
