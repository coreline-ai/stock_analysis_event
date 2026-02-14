"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DailyReport } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { ReportSummaryPanel } from "../_components/charts/report_summary_panel";
import { useDashboardContext } from "../_components/dashboard_context";
import { useKrSymbolNameMap, useUsSymbolNameMap } from "../_components/kr_symbol_names";
import { marketScopeLabel, verdictLabel } from "../_components/labels";
import { trackEvent } from "../_components/telemetry";
import { EmptyState, ErrorState, LoadingBlock } from "../_components/ui_primitives";

function asItems(payload: unknown): DailyReport[] {
  if (Array.isArray(payload)) return payload as DailyReport[];
  if (payload && typeof payload === "object" && "items" in payload) {
    return ((payload as { items?: unknown }).items ?? []) as DailyReport[];
  }
  return [];
}

function reportDateLabel(value: string): string {
  if (!value) return "-";
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function extractEvidenceSymbols(markdown: string): string[] {
  const set = new Set<string>();
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[([^\]]+)\]\s*score=/);
    if (!match?.[1]) continue;
    const raw = match[1].trim();
    const codeMatch = raw.match(/^(\d{6}|[A-Za-z]{1,5})\b/);
    if (!codeMatch?.[1]) continue;
    set.add(codeMatch[1].toUpperCase());
  }
  return Array.from(set);
}

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, refreshKey, setAuthRequired } = useDashboardContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<DailyReport[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [scope, setScope] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
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
    void load();
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
  const selected = useMemo(
    () => visibleReports.find((r) => r.id === selectedId) ?? filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [visibleReports, filtered, selectedId]
  );
  const evidenceSymbols = useMemo(() => extractEvidenceSymbols(selected?.summaryMarkdown ?? ""), [selected?.summaryMarkdown]);
  const krSymbolNames = useKrSymbolNameMap(evidenceSymbols, token);
  const usSymbolNames = useUsSymbolNameMap(evidenceSymbols, token);

  useEffect(() => {
    setVisibleCount(40);
    void trackEvent({
      name: "report_filter_changed",
      page: "/dashboard/reports",
      meta: { scope, dateFrom, dateTo }
    });
  }, [scope, dateFrom, dateTo, refreshKey]);

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
        <div className="list-item-head">
          <h3>일일 리포트 목록 ({filtered.length})</h3>
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
                <strong>{reportDateLabel(r.reportDate)}</strong>
                <span className="badge badge-alt">{marketScopeLabel(r.marketScope)}</span>
              </div>
              <p>{r.summaryMarkdown.slice(0, 140)}...</p>
            </button>
          ))}
        </div>
        {visibleCount < filtered.length ? (
          <div className="button-row mt-10">
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
              <h3>{reportDateLabel(selected.reportDate)} 일일 리포트</h3>
              <div className="button-row">
                <button type="button" onClick={() => downloadReport("json")}>
                  JSON 다운로드
                </button>
                <button type="button" onClick={() => downloadReport("markdown")}>
                  MD 다운로드
                </button>
              </div>
            </div>
            <p>
              <strong>상위 {verdictLabel("BUY_NOW")}:</strong> {selected.topBuyNow.join(", ") || "-"}
            </p>
            <p>
              <strong>상위 {verdictLabel("WATCH")}:</strong> {selected.topWatch.join(", ") || "-"}
            </p>
            <p>
              <strong>시장:</strong> {marketScopeLabel(selected.marketScope)}
            </p>
            <p>
              <strong>테마:</strong>
            </p>
            <div className="tag-row">
              {selected.themes.length === 0 ? (
                <span className="tag">-</span>
              ) : (
                selected.themes.map((t) => <span className="tag" key={t}>{t}</span>)
              )}
            </div>
            <p>
              <strong>리스크:</strong>
            </p>
            <div className="tag-row">
              {selected.risks.length === 0 ? (
                <span className="tag">-</span>
              ) : (
                selected.risks.map((t) => (
                  <span className="tag tag-risk" key={t}>
                    {t}
                  </span>
                ))
              )}
            </div>
            <ReportSummaryPanel
              report={selected}
              marketScope={selected.marketScope}
              krSymbolNames={krSymbolNames}
              usSymbolNames={usSymbolNames}
            />
            <div className="markdown-box">{selected.summaryMarkdown}</div>
          </>
        )}
      </section>
    </div>
  );
}
