"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Decision, SignalRaw, SignalScored } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { EnergyGauge } from "../_components/charts/energy_gauge";
import { EntryTriggerTracker } from "../_components/charts/entry_trigger_tracker";
import { FlowBalanceBar } from "../_components/charts/flow_balance_bar";
import { RadarPentagonChart } from "../_components/charts/radar_pentagon_chart";
import { RiskHeatmapPanel } from "../_components/charts/risk_heatmap_panel";
import { StackedWeightBar } from "../_components/charts/stacked_weight_bar";
import { TripleCrownGate } from "../_components/charts/triple_crown_gate";
import { useDashboardContext } from "../_components/dashboard_context";
import { formatKrSymbol, formatKrSymbolCandidates, useKrSymbolNameMap } from "../_components/kr_symbol_names";
import { sourceLabel, verdictLabel } from "../_components/labels";
import { useSymbolSuggestions } from "../_components/symbol_autocomplete";
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

  const krSymbolNames = useKrSymbolNameMap(
    [
      ...scoredData.map((item) => item.symbol),
      ...decisions.map((item) => item.symbol),
      ...rawData.flatMap((item) => item.symbolCandidates)
    ],
    token
  );

  const { items: symbolSuggestions, loading: suggestionLoading } = useSymbolSuggestions({
    query: symbolSearch,
    scope,
    token,
    enabled: true
  });

  function normalizeSearchText(value: string): string {
    return value.replace(/\s+/g, "").toUpperCase();
  }

  const normalizedQuery = normalizeSearchText(symbolSearch.trim());

  function matchesSymbolOrKrName(symbol: string): boolean {
    if (!normalizedQuery) return true;
    const normalizedSymbol = normalizeSearchText(symbol);
    if (normalizedSymbol.includes(normalizedQuery)) return true;
    const normalizedName = normalizeSearchText(krSymbolNames[symbol] ?? "");
    return normalizedName.includes(normalizedQuery);
  }

  const filteredRaw = useMemo(() => {
    if (!normalizedQuery) return rawData;
    return rawData.filter((r) => r.symbolCandidates.some((s) => matchesSymbolOrKrName(s)));
  }, [rawData, normalizedQuery, krSymbolNames]);

  const filteredScored = useMemo(() => {
    if (!normalizedQuery) return scoredData;
    return scoredData.filter((s) => matchesSymbolOrKrName(s.symbol));
  }, [scoredData, normalizedQuery, krSymbolNames]);

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
  const primaryDecision = relatedDecisions[0] ?? null;

  function metricText(value?: number): string {
    if (typeof value !== "number") return "-";
    return value.toFixed(2);
  }

  function passLabel(value?: boolean): string {
    if (typeof value !== "boolean") return "-";
    return value ? "통과" : "미통과";
  }

  function compactText(value: string, max = 18): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
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
          <h3>신호 분석</h3>
          <div className="button-row">
            <label>
              시장
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="ALL">전체</option>
                <option value="US">미국</option>
                <option value="KR">한국</option>
              </select>
            </label>
            <div className="symbol-search-wrap">
              <input
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                placeholder={scope === "KR" ? "코드/한글 종목명 필터..." : "심볼 필터..."}
              />
              {scope === "KR" && (suggestionLoading || symbolSuggestions.length > 0) ? (
                <div className="autocomplete-list" role="listbox" aria-label="한국 종목 자동완성">
                  {symbolSuggestions.map((item) => (
                    <button
                      key={`${item.marketScope}:${item.symbol}`}
                      type="button"
                      className="autocomplete-item"
                      onClick={() => setSymbolSearch(item.symbol)}
                    >
                      {item.display}
                    </button>
                  ))}
                  {suggestionLoading ? <div className="autocomplete-item muted">검색 중...</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="button-row">
            <button type="button" className={tab === "raw" ? "" : "ghost"} onClick={() => setTab("raw")}>
              원시 데이터
            </button>
            <button type="button" className={tab === "scored" ? "" : "ghost"} onClick={() => setTab("scored")}>
              점수 데이터
            </button>
          </div>
      </section>

      {tab === "raw" ? (
        <section className="card">
          <h3>원시 데이터 ({filteredRaw.length})</h3>
          <div className="table-wrap table-wrap-raw" role="region" aria-label="원시 데이터 테이블 영역" tabIndex={0}>
            <table className="table table-raw">
              <caption className="sr-only">원시 데이터 테이블</caption>
              <thead>
                <tr>
                  <th className="t-center">소스</th>
                  <th className="t-center">심볼</th>
                  <th className="t-right">게시 시각</th>
                  <th className="t-center">링크</th>
                  <th>원문</th>
                </tr>
              </thead>
              <tbody>
                {visibleRaw.map((r) => (
                  <tr key={`${r.source}:${r.externalId}`}>
                    <td className="t-center">{sourceLabel(r.source)}</td>
                    <td className="t-center">{r.symbolCandidates.length > 0 ? formatKrSymbolCandidates(r.symbolCandidates, krSymbolNames) : "-"}</td>
                    <td className="t-right">{r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "-"}</td>
                    <td className="t-center">
                      {r.url ? (
                        <a className="inline-link" href={r.url} target="_blank" rel="noreferrer">
                          이동
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="raw-link-cell">
                      {r.title ? <span className="raw-title-sub" title={r.title}>{r.title}</span> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleRawCount < filteredRaw.length ? (
            <div className="button-row mt-10">
              <button type="button" onClick={() => setVisibleRawCount((prev) => prev + 80)}>
                원시 데이터 더 보기
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <h3>점수 데이터 ({filteredScored.length})</h3>
          <div className="table-wrap" role="region" aria-label="점수 데이터 테이블 스크롤 영역" tabIndex={0}>
            <table className="table">
              <caption className="sr-only">점수 데이터 테이블</caption>
              <thead>
                <tr>
                  <th className="t-center">심볼</th>
                  <th className="t-right">최종 점수</th>
                  <th className="t-right">감성 점수</th>
                  <th className="t-right">숫자 근거</th>
                  <th className="t-center">기본 안전</th>
                  <th className="t-center">3중 확인</th>
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
                    aria-label={`점수 데이터 선택 ${formatKrSymbol(s.symbol, krSymbolNames)}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedScoredId(s.id ?? "");
                      }
                    }}
                  >
                    <td className="t-center">{formatKrSymbol(s.symbol, krSymbolNames)}</td>
                    <td className="t-right">{s.finalScore.toFixed(3)}</td>
                    <td className="t-right">{s.sentimentScore.toFixed(3)}</td>
                    <td className="t-right">{metricText(s.quantScore)}</td>
                    <td className="t-center">{passLabel(s.hardFilterPassed)}</td>
                    <td className="t-center">{passLabel(s.tripleCrownPassed)}</td>
                    <td>{s.reasonSummary ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleScoredCount < filteredScored.length ? (
            <div className="button-row mt-10">
              <button type="button" onClick={() => setVisibleScoredCount((prev) => prev + 80)}>
                점수 데이터 더 보기
              </button>
            </div>
          ) : null}
        </section>
      )}

      {tab === "scored" ? (
        <section className="card">
          <h3>신호-판단 추적</h3>
          {!selectedScored ? (
            <p>테이블에서 점수 데이터를 선택하세요.</p>
          ) : (
            <div className="detail-stack">
              <p><strong>선택 심볼:</strong> {formatKrSymbol(selectedScored.symbol, krSymbolNames)}</p>
              <p><strong>점수:</strong> {selectedScored.finalScore.toFixed(3)}</p>
              <p><strong>근거:</strong> {selectedScored.reasonSummary ?? "-"}</p>
              <div className="metric-list">
                <div className="metric-row"><span>감성/최신성/출처신뢰</span><strong>{metricText(selectedScored.sentimentScore)} / {metricText(selectedScored.freshnessScore)} / {metricText(selectedScored.sourceWeight)}</strong></div>
                <div className="metric-row"><span>시장 반응/이벤트</span><strong>{metricText(selectedScored.socialScore)} / {metricText(selectedScored.eventScore)}</strong></div>
                <div className="metric-row"><span>거래량/수급/기술</span><strong>{metricText(selectedScored.volumeScore)} / {metricText(selectedScored.flowScore)} / {metricText(selectedScored.technicalScore)}</strong></div>
                <div className="metric-row"><span>숫자 근거/보정 계수/과열 위험</span><strong>{metricText(selectedScored.quantScore)} / {metricText(selectedScored.quantMultiplier)} / {metricText(selectedScored.contextRiskScore)}</strong></div>
                <div className="metric-row"><span>기본 안전/3중 확인</span><strong>{passLabel(selectedScored.hardFilterPassed)} / {passLabel(selectedScored.tripleCrownPassed)}</strong></div>
              </div>
              <div className="grid grid-2">
                <RadarPentagonChart
                  socialScore={selectedScored.socialScore}
                  eventScore={selectedScored.eventScore}
                  volumeScore={selectedScored.volumeScore}
                  flowScore={selectedScored.flowScore}
                  technicalScore={selectedScored.technicalScore}
                />
                <TripleCrownGate
                  socialLayerPassed={selectedScored.socialLayerPassed}
                  eventLayerPassed={selectedScored.eventLayerPassed}
                  hardFilterPassed={selectedScored.hardFilterPassed}
                  volumeGuardPassed={selectedScored.volumeGuardPassed}
                  flowGuardPassed={selectedScored.flowGuardPassed}
                  technicalGuardPassed={selectedScored.technicalGuardPassed}
                  tripleCrownPassed={selectedScored.tripleCrownPassed}
                  verdict={primaryDecision?.verdict}
                />
                <EnergyGauge volumeScore={selectedScored.volumeScore} />
                <FlowBalanceBar flowScore={selectedScored.flowScore} socialScore={selectedScored.socialScore} />
                <RiskHeatmapPanel
                  contextRiskScore={selectedScored.contextRiskScore}
                  volumeGuardPassed={selectedScored.volumeGuardPassed}
                  flowGuardPassed={selectedScored.flowGuardPassed}
                  technicalGuardPassed={selectedScored.technicalGuardPassed}
                />
                <StackedWeightBar
                  socialScore={selectedScored.socialScore}
                  eventScore={selectedScored.eventScore}
                  quantScore={selectedScored.quantScore}
                  quantMultiplier={selectedScored.quantMultiplier}
                  finalScore={selectedScored.finalScore}
                />
              </div>
              {primaryDecision ? (
                <EntryTriggerTracker symbol={primaryDecision.symbol} entryTrigger={primaryDecision.entryTrigger} token={token} />
              ) : null}
              <p><strong>연결된 판단:</strong></p>
              {relatedDecisions.length === 0 ? (
                <p>이 심볼에 연결된 판단이 아직 없습니다.</p>
              ) : (
                <div className="list">
                  {relatedDecisions.map((d) => (
                    <div key={d.id} className="list-item">
                      <div className="list-item-head">
                        <strong>{formatKrSymbol(d.symbol, krSymbolNames)}</strong>
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
