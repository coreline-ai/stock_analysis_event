"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { SymbolReport } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { useDashboardContext } from "../_components/dashboard_context";
import { formatKrSymbol, useKrSymbolNameMap } from "../_components/kr_symbol_names";
import { marketScopeLabel } from "../_components/labels";
import { useAllSymbolSuggestions } from "../_components/symbol_autocomplete";
import { trackEvent } from "../_components/telemetry";
import { ErrorState } from "../_components/ui_primitives";

type ScopeValue = "ALL" | "US" | "KR";

interface SymbolReportSnapshot {
  scope: ScopeValue;
  symbolQuery: string;
  symbolReport: SymbolReport;
}

const SYMBOL_REPORT_SNAPSHOT_KEY = "dashboard_symbol_report_snapshot";

function parseScopeValue(value: string | null): ScopeValue {
  if (value === "US" || value === "KR" || value === "ALL") return value;
  return "ALL";
}

function loadSnapshot(): SymbolReportSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SYMBOL_REPORT_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SymbolReportSnapshot>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.symbolReport || typeof parsed.symbolReport !== "object") return null;
    const symbolQuery = typeof parsed.symbolQuery === "string" ? parsed.symbolQuery : "";
    const scope = parseScopeValue(typeof parsed.scope === "string" ? parsed.scope : null);
    if (!symbolQuery.trim()) return null;
    return { scope, symbolQuery, symbolReport: parsed.symbolReport as SymbolReport };
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: SymbolReportSnapshot): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SYMBOL_REPORT_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export default function SymbolReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, llmProvider, setAuthRequired } = useDashboardContext();
  const [scope, setScope] = useState<ScopeValue>("ALL");
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolReport, setSymbolReport] = useState<SymbolReport | null>(null);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [symbolError, setSymbolError] = useState("");
  const qsScope = searchParams.get("scope");

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/symbol-report" });
  }, []);

  useEffect(() => {
    setScope(parseScopeValue(qsScope));
  }, [qsScope]);

  useEffect(() => {
    const currentScope = parseScopeValue(qsScope);
    if (scope === currentScope) return;
    const params = new URLSearchParams(searchParams.toString());
    if (scope === "ALL") params.delete("scope");
    else params.set("scope", scope);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [scope, qsScope, searchParams, router, pathname]);

  useEffect(() => {
    const snapshot = loadSnapshot();
    if (!snapshot) return;
    setScope(snapshot.scope);
    setSymbolQuery(snapshot.symbolQuery);
    setSymbolReport(snapshot.symbolReport);
  }, []);

  const krSymbolNames = useKrSymbolNameMap(
    [symbolReport?.symbol ?? "", ...(symbolReport?.scoredSignals ?? []).map((s) => s.symbol)],
    token
  );

  const { items: symbolSuggestions, loading: suggestionLoading } = useAllSymbolSuggestions({
    query: symbolQuery,
    scope,
    token,
    enabled: true
  });

  async function runSymbolReport(symbol: string) {
    const trimmed = symbol.trim();
    if (!trimmed) return;
    setSymbolLoading(true);
    setSymbolError("");
    const scopeQuery = scope !== "ALL" ? `&scope=${scope}` : "";
    const res = await apiRequest<SymbolReport>(
      `/api/agent/symbol-report?symbol=${encodeURIComponent(trimmed)}${scopeQuery}&refresh=1&llmProvider=${encodeURIComponent(llmProvider)}`,
      { token }
    );
    setSymbolLoading(false);
    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      setSymbolError(res.error);
      setSymbolReport(null);
      return;
    }
    setSymbolReport(res.data);
    saveSnapshot({
      scope,
      symbolQuery: trimmed,
      symbolReport: res.data
    });
    void trackEvent({
      name: "symbol_report_generated",
      page: "/dashboard/symbol-report",
      meta: { symbol: trimmed.toUpperCase(), scope, onDemand: Boolean(res.data.onDemandRun) }
    });
  }

  return (
    <div className="grid grid-2">
      <section className="card">
        <div className="symbol-report-header">
          <h3>개별 종목 실시간 리포트</h3>
          <div className="symbol-search-help">심볼 또는 한글 종목명을 입력하세요.</div>
        </div>
        <div className="button-row" style={{ marginTop: 10 }}>
          <label>
            시장
            <select value={scope} onChange={(e) => setScope(e.target.value as ScopeValue)}>
              <option value="ALL">전체</option>
              <option value="US">미국</option>
              <option value="KR">한국</option>
            </select>
          </label>
        </div>
        <div className="symbol-search-stack" style={{ marginTop: 10 }}>
          <div className="symbol-search-wrap">
            <input
              value={symbolQuery}
              onChange={(e) => setSymbolQuery(e.target.value)}
              placeholder={scope === "KR" ? "종목명/코드 검색" : "티커 검색"}
            />
            {symbolSuggestions.length > 0 || suggestionLoading ? (
              <div className="autocomplete-list" role="listbox" aria-label="종목 자동완성">
                {symbolSuggestions.map((item) => (
                  <button
                    key={`${item.marketScope}:${item.symbol}`}
                    type="button"
                    className="autocomplete-item"
                    onClick={() => {
                      setSymbolQuery(item.symbol);
                      void runSymbolReport(item.symbol);
                    }}
                  >
                    {item.display}
                  </button>
                ))}
                {suggestionLoading ? <div className="autocomplete-item muted">검색 중...</div> : null}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => void runSymbolReport(symbolQuery)} disabled={symbolLoading}>
            {symbolLoading ? "생성 중..." : "종목 리포트 생성"}
          </button>
          <div className="symbol-search-quick">
            <span className="signal-chip">예시</span>
            <button type="button" className="signal-chip" onClick={() => void runSymbolReport("005930")}>
              삼성전자
            </button>
            <button type="button" className="signal-chip" onClick={() => void runSymbolReport("AAPL")}>
              AAPL
            </button>
          </div>
        </div>
        {symbolError ? <ErrorState message={symbolError} /> : null}
      </section>

      <section className="card">
        {!symbolReport ? (
          <p>심볼을 입력해 실시간 리포트를 생성하세요.</p>
        ) : (
          <div>
            <p>
              <strong>종목:</strong> {formatKrSymbol(symbolReport.symbol, krSymbolNames)}
            </p>
            <p>
              <strong>시장:</strong> {marketScopeLabel(symbolReport.marketScope)}
            </p>
            <p>
              <strong>생성 시각:</strong> {new Date(symbolReport.generatedAt).toLocaleString()}
            </p>
            {symbolReport.onDemandRun ? (
              <p>
                <strong>온디맨드 실행:</strong>{" "}
                {`${symbolReport.onDemandRun.status} (raw=${symbolReport.onDemandRun.rawCount}, scored=${symbolReport.onDemandRun.scoredCount}, decided=${symbolReport.onDemandRun.decidedCount})`}
              </p>
            ) : null}
            <div className="source-grid">
              {Object.entries(symbolReport.sourceCounts).map(([key, value]) => (
                <div key={key} className="source-card">
                  <strong>{key}</strong>
                  <div>{value}건</div>
                </div>
              ))}
            </div>
            <div className="markdown-box" style={{ marginTop: 12 }}>
              {symbolReport.summaryMarkdown}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
