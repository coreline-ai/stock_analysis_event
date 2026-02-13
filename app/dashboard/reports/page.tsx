"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DailyReport, SymbolReport } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { useDashboardContext } from "../_components/dashboard_context";
import { marketScopeLabel, verdictLabel } from "../_components/labels";
import { formatKrSymbol, useKrSymbolNameMap } from "../_components/kr_symbol_names";
import { trackEvent } from "../_components/telemetry";
import { EmptyState, ErrorState, LoadingBlock } from "../_components/ui_primitives";
import { useAllSymbolSuggestions } from "../_components/symbol_autocomplete";

function asItems(payload: unknown): DailyReport[] {
  if (Array.isArray(payload)) return payload as DailyReport[];
  if (payload && typeof payload === "object" && "items" in payload) {
    return ((payload as { items?: unknown }).items ?? []) as DailyReport[];
  }
  return [];
}

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, llmProvider, refreshKey, setAuthRequired } = useDashboardContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<DailyReport[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [scope, setScope] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolReport, setSymbolReport] = useState<SymbolReport | null>(null);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [symbolError, setSymbolError] = useState("");
  const qsScope = searchParams.get("scope") ?? "";

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/reports" });
  }, []);

  useEffect(() => {
    if (qsScope === "US" || qsScope === "KR" || qsScope === "ALL") {
      setScope(qsScope);
      return;
    }
    setScope("ALL");
  }, [qsScope]);

  useEffect(() => {
    const currentScope = qsScope === "US" || qsScope === "KR" || qsScope === "ALL" ? qsScope : "ALL";
    if (scope === currentScope) return;
    const params = new URLSearchParams(searchParams.toString());
    if (scope === "ALL") params.delete("scope");
    else params.set("scope", scope);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [scope, qsScope, searchParams, router, pathname]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const scopeQuery = scope !== "ALL" ? `&scope=${scope}` : "";
      const res = await apiRequest<unknown>(`/api/agent/reports?limit=100&offset=0${scopeQuery}`, { token });
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        if (res.status === 401) setAuthRequired(true);
        setItems([]);
        setError(res.error);
        return;
      }
      const list = asItems(res.data);
      setItems(list);
      if (list.length > 0) setSelectedId(list[0].id ?? "");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, setAuthRequired, scope]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (dateFrom && r.reportDate < dateFrom) return false;
      if (dateTo && r.reportDate > dateTo) return false;
      return true;
    });
  }, [items, dateFrom, dateTo]);
  const visibleReports = filtered.slice(0, visibleCount);

  const selected = useMemo(() => visibleReports.find((r) => r.id === selectedId) ?? filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null, [visibleReports, filtered, selectedId]);

  useEffect(() => {
    setVisibleCount(40);
    void trackEvent({
      name: "report_filter_changed",
      page: "/dashboard/reports",
      meta: { scope, dateFrom, dateTo }
    });
  }, [scope, dateFrom, dateTo, refreshKey]);

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
  }

  function downloadReport(mode: "json" | "markdown") {
    if (!selected) return;
    const content =
      mode === "json"
        ? JSON.stringify(selected, null, 2)
        : `# 일일 리포트 ${selected.reportDate}\n\n${selected.summaryMarkdown}`;
    const blob = new Blob([content], { type: mode === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${selected.reportDate}.${mode === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingBlock label="리포트를 불러오는 중..." />;
  if (error) return <ErrorState message={error} />;
  if (items.length === 0) return <EmptyState title="리포트 없음" description="파이프라인을 실행해 일일 리포트를 생성하세요." />;

  return (
    <div className="grid grid-2">
      <section className="card">
        <div className="symbol-report-header">
          <h3>개별 종목 실시간 리포트</h3>
          <div className="symbol-search-help">심볼 또는 한글 종목명을 입력하세요.</div>
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
        {symbolError ? <p style={{ marginTop: 10 }}>{symbolError}</p> : null}
        {!symbolReport ? null : (
          <div style={{ marginTop: 14 }}>
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
            <div className="markdown-box" style={{ marginTop: 12 }}>{symbolReport.summaryMarkdown}</div>
          </div>
        )}
      </section>
      <section className="card">
        <div className="list-item-head">
          <h3>리포트 목록 ({filtered.length})</h3>
          <div className="button-row">
            <label>
              시장
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="ALL">전체</option>
                <option value="US">미국</option>
                <option value="KR">한국</option>
              </select>
            </label>
            <label>
              시작일
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              종료일
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="list">
          {visibleReports.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`list-item as-button ${selected?.id === r.id ? "selected" : ""}`}
              onClick={() => setSelectedId(r.id ?? "")}
            >
              <div className="list-item-head">
                <strong>{new Date(r.reportDate).toISOString().slice(0, 10)}</strong>
                <span className="badge badge-alt">{marketScopeLabel(r.marketScope)}</span>
              </div>
              <p>{r.summaryMarkdown.slice(0, 140)}...</p>
            </button>
          ))}
        </div>
        {visibleCount < filtered.length ? (
          <div className="button-row" style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setVisibleCount((prev) => prev + 40)}>
              리포트 더 보기
            </button>
          </div>
        ) : null}
      </section>

      <section className="card">
        {!selected ? (
          <p>리포트를 선택하세요.</p>
        ) : (
          <>
            <div className="list-item-head">
              <h3>{new Date(selected.reportDate).toISOString().slice(0, 10)} 리포트</h3>
              <div className="button-row">
                <button type="button" onClick={() => downloadReport("json")}>
                  JSON 다운로드
                </button>
                <button type="button" onClick={() => downloadReport("markdown")}>
                  MD 다운로드
                </button>
              </div>
            </div>
            <p><strong>상위 {verdictLabel("BUY_NOW")}:</strong> {selected.topBuyNow.join(", ") || "-"}</p>
            <p><strong>상위 {verdictLabel("WATCH")}:</strong> {selected.topWatch.join(", ") || "-"}</p>
            <p><strong>시장:</strong> {marketScopeLabel(selected.marketScope)}</p>
            <p><strong>테마:</strong></p>
            <div className="tag-row">
              {selected.themes.length === 0 ? <span className="tag">-</span> : selected.themes.map((t) => <span className="tag" key={t}>{t}</span>)}
            </div>
            <p><strong>리스크:</strong></p>
            <div className="tag-row">
              {selected.risks.length === 0 ? <span className="tag">-</span> : selected.risks.map((t) => <span className="tag tag-risk" key={t}>{t}</span>)}
            </div>
            <div className="markdown-box">{selected.summaryMarkdown}</div>
          </>
        )}
      </section>
    </div>
  );
}
