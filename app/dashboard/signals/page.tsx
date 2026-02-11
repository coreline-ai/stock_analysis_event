"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Decision, SignalRaw, SignalScored } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { useDashboardContext } from "../_components/dashboard_context";
import { sourceLabel, verdictLabel } from "../_components/labels";
import { trackEvent } from "../_components/telemetry";
import { EmptyState, ErrorState, LoadingBlock } from "../_components/ui_primitives";

interface PagedItems<T> {
  items: T[];
  meta?: {
    limit: number;
    offset: number;
    count: number;
  };
}

export default function SignalsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, refreshKey, setAuthRequired } = useDashboardContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"raw" | "scored">("raw");
  const [scope, setScope] = useState("ALL");
  const [rawData, setRawData] = useState<SignalRaw[]>([]);
  const [scoredData, setScoredData] = useState<SignalScored[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [selectedScoredId, setSelectedScoredId] = useState("");
  const [visibleRawCount, setVisibleRawCount] = useState(80);
  const [visibleScoredCount, setVisibleScoredCount] = useState(80);
  const qsSymbol = searchParams.get("symbol") ?? "";
  const qsScoredId = searchParams.get("scoredId") ?? "";
  const qsTab = searchParams.get("tab") ?? "";
  const qsScope = searchParams.get("scope") ?? "";

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/signals" });
  }, []);

  useEffect(() => {
    if (qsScope === "US" || qsScope === "KR" || qsScope === "ALL") {
      setScope(qsScope);
    } else {
      setScope("ALL");
    }
    if (qsSymbol) setSymbolSearch(qsSymbol);
    if (qsScoredId) setSelectedScoredId(qsScoredId);
    if (qsTab === "raw" || qsTab === "scored") setTab(qsTab);
  }, [qsScope, qsSymbol, qsScoredId, qsTab]);

  useEffect(() => {
    const currentScope = qsScope === "US" || qsScope === "KR" || qsScope === "ALL" ? qsScope : "ALL";
    const currentTab = qsTab === "raw" || qsTab === "scored" ? qsTab : "raw";
    if (scope === currentScope && tab === currentTab) return;
    const params = new URLSearchParams(searchParams.toString());
    if (scope === "ALL") params.delete("scope");
    else params.set("scope", scope);
    if (tab === "raw") params.delete("tab");
    else params.set("tab", tab);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [scope, tab, qsScope, qsTab, searchParams, router, pathname]);

  useEffect(() => {
    setVisibleRawCount(80);
    setVisibleScoredCount(80);
    void trackEvent({
      name: "signal_filter_changed",
      page: "/dashboard/signals",
      meta: { symbolSearch, tab, scope }
    });
  }, [symbolSearch, tab, scope, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const scopeQuery = scope !== "ALL" ? `&scope=${scope}` : "";
      const [rawRes, scoredRes, decisionRes] = await Promise.all([
        apiRequest<PagedItems<SignalRaw>>(`/api/agent/signals/raw?limit=150&offset=0${scopeQuery}`, { token }),
        apiRequest<PagedItems<SignalScored>>(`/api/agent/signals/scored?limit=150&offset=0${scopeQuery}`, { token }),
        apiRequest<PagedItems<Decision>>(`/api/agent/decisions?limit=100&offset=0${scopeQuery}`, { token })
      ]);
      if (cancelled) return;
      setLoading(false);

      if (!rawRes.ok) {
        if (rawRes.status === 401) setAuthRequired(true);
        setError(rawRes.error);
        return;
      }
      if (!scoredRes.ok) {
        if (scoredRes.status === 401) setAuthRequired(true);
        setError(scoredRes.error);
        return;
      }
      if (!decisionRes.ok) {
        if (decisionRes.status === 401) setAuthRequired(true);
        setError(decisionRes.error);
        return;
      }

      setRawData(rawRes.data.items ?? []);
      const scoredItems = scoredRes.data.items ?? [];
      setScoredData(scoredItems);
      setDecisions(decisionRes.data.items ?? []);
      if (scoredItems.length > 0) {
        const desired = qsScoredId ? scoredItems.find((s) => s.id === qsScoredId) : null;
        setSelectedScoredId((desired ?? scoredItems[0])?.id ?? "");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, setAuthRequired, qsScoredId, scope]);

  const normalizedQuery = symbolSearch.trim().toUpperCase();
  const filteredRaw = useMemo(() => {
    if (!normalizedQuery) return rawData;
    return rawData.filter((r) => r.symbolCandidates.some((s) => s.toUpperCase().includes(normalizedQuery)));
  }, [rawData, normalizedQuery]);

  const filteredScored = useMemo(() => {
    if (!normalizedQuery) return scoredData;
    return scoredData.filter((s) => s.symbol.toUpperCase().includes(normalizedQuery));
  }, [scoredData, normalizedQuery]);

  const visibleRaw = filteredRaw.slice(0, visibleRawCount);
  const visibleScored = filteredScored.slice(0, visibleScoredCount);

  const selectedScored = useMemo(
    () => visibleScored.find((s) => s.id === selectedScoredId) ?? filteredScored.find((s) => s.id === selectedScoredId) ?? filteredScored[0] ?? null,
    [visibleScored, filteredScored, selectedScoredId]
  );

  const relatedDecisions = useMemo(() => {
    if (!selectedScored) return [];
    return decisions.filter((d) => d.symbol === selectedScored.symbol).slice(0, 5);
  }, [decisions, selectedScored]);

  function metricText(value?: number): string {
    if (typeof value !== "number") return "-";
    return value.toFixed(2);
  }

  function passLabel(value?: boolean): string {
    if (typeof value !== "boolean") return "-";
    return value ? "통과" : "실패";
  }

  if (loading) return <LoadingBlock label="신호 데이터를 불러오는 중..." />;
  if (error) return <ErrorState message={error} />;
  if (rawData.length === 0 && scoredData.length === 0) {
    return <EmptyState title="신호 데이터 없음" description="파이프라인 실행 후 이 페이지를 새로고침하세요." />;
  }

  return (
    <div className="dash-grid">
      <section className="card">
        <div className="list-item-head">
          <h3>신호 탐색기</h3>
          <div className="button-row">
            <label>
              시장
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="ALL">전체</option>
                <option value="US">미국</option>
                <option value="KR">한국</option>
              </select>
            </label>
            <input value={symbolSearch} onChange={(e) => setSymbolSearch(e.target.value)} placeholder="심볼 필터..." />
          </div>
        </div>
        <div className="button-row">
          <button type="button" className={tab === "raw" ? "" : "ghost"} onClick={() => setTab("raw")}>
            원시 신호
          </button>
          <button type="button" className={tab === "scored" ? "" : "ghost"} onClick={() => setTab("scored")}>
            스코어 신호
          </button>
        </div>
      </section>

      {tab === "raw" ? (
        <section className="card">
          <h3>원시 신호 ({filteredRaw.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">원시 신호 테이블</caption>
              <thead>
                <tr>
                  <th>소스</th>
                  <th>외부 ID</th>
                  <th>심볼</th>
                  <th>게시 시각</th>
                  <th>제목</th>
                </tr>
              </thead>
              <tbody>
                {visibleRaw.map((r) => (
                  <tr key={`${r.source}:${r.externalId}`}>
                    <td>{sourceLabel(r.source)}</td>
                    <td className="mono">{r.externalId}</td>
                    <td>{r.symbolCandidates.join(", ") || "-"}</td>
                    <td>{r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "-"}</td>
                    <td>{r.title ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleRawCount < filteredRaw.length ? (
            <div className="button-row" style={{ marginTop: 10 }}>
              <button type="button" onClick={() => setVisibleRawCount((prev) => prev + 80)}>
                원시 신호 더 보기
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <h3>스코어 신호 ({filteredScored.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">스코어 신호 테이블</caption>
              <thead>
                <tr>
                  <th>심볼</th>
                  <th>최종 점수</th>
                  <th>감성 점수</th>
                  <th>퀀트</th>
                  <th>하드필터</th>
                  <th>삼관왕</th>
                  <th>근거</th>
                </tr>
              </thead>
              <tbody>
                {visibleScored.map((s) => (
                  <tr
                    key={s.id}
                    className={selectedScored?.id === s.id ? "table-row-selected" : ""}
                    onClick={() => setSelectedScoredId(s.id ?? "")}
                    tabIndex={0}
                    aria-label={`스코어 신호 선택 ${s.symbol}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedScoredId(s.id ?? "");
                      }
                    }}
                  >
                    <td>{s.symbol}</td>
                    <td>{s.finalScore.toFixed(3)}</td>
                    <td>{s.sentimentScore.toFixed(3)}</td>
                    <td>{metricText(s.quantScore)}</td>
                    <td>{passLabel(s.hardFilterPassed)}</td>
                    <td>{passLabel(s.tripleCrownPassed)}</td>
                    <td>{s.reasonSummary ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleScoredCount < filteredScored.length ? (
            <div className="button-row" style={{ marginTop: 10 }}>
              <button type="button" onClick={() => setVisibleScoredCount((prev) => prev + 80)}>
                스코어 신호 더 보기
              </button>
            </div>
          ) : null}
        </section>
      )}

      {tab === "scored" ? (
        <section className="card">
          <h3>신호-판단 추적</h3>
          {!selectedScored ? (
            <p>테이블에서 스코어 신호를 선택하세요.</p>
          ) : (
            <div className="detail-stack">
              <p><strong>선택 심볼:</strong> {selectedScored.symbol}</p>
              <p><strong>점수:</strong> {selectedScored.finalScore.toFixed(3)}</p>
              <p><strong>근거:</strong> {selectedScored.reasonSummary ?? "-"}</p>
              <div className="metric-list">
                <div className="metric-row"><span>감성/신선도/가중치</span><strong>{metricText(selectedScored.sentimentScore)} / {metricText(selectedScored.freshnessScore)} / {metricText(selectedScored.sourceWeight)}</strong></div>
                <div className="metric-row"><span>소셜/이벤트</span><strong>{metricText(selectedScored.socialScore)} / {metricText(selectedScored.eventScore)}</strong></div>
                <div className="metric-row"><span>거래량/수급/기술</span><strong>{metricText(selectedScored.volumeScore)} / {metricText(selectedScored.flowScore)} / {metricText(selectedScored.technicalScore)}</strong></div>
                <div className="metric-row"><span>퀀트/승수/리스크</span><strong>{metricText(selectedScored.quantScore)} / {metricText(selectedScored.quantMultiplier)} / {metricText(selectedScored.contextRiskScore)}</strong></div>
                <div className="metric-row"><span>하드필터/삼관왕</span><strong>{passLabel(selectedScored.hardFilterPassed)} / {passLabel(selectedScored.tripleCrownPassed)}</strong></div>
              </div>
              <p><strong>연결된 판단:</strong></p>
              {relatedDecisions.length === 0 ? (
                <p>이 심볼에 연결된 판단이 아직 없습니다.</p>
              ) : (
                <div className="list">
                  {relatedDecisions.map((d) => (
                    <div key={d.id} className="list-item">
                      <div className="list-item-head">
                        <strong>{d.symbol}</strong>
                        <span className="badge">{verdictLabel(d.verdict)}</span>
                      </div>
                      <p>{d.thesisSummary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
