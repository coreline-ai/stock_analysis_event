"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Decision, SignalScored } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { EntryTriggerTracker } from "../_components/charts/entry_trigger_tracker";
import { RiskHeatmapPanel } from "../_components/charts/risk_heatmap_panel";
import { SignalEvidenceBars } from "../_components/charts/signal_evidence_bars";
import { useDashboardContext } from "../_components/dashboard_context";
import { formatKrSymbol, formatUsSymbol, useKrSymbolNameMap, useUsSymbolNameMap } from "../_components/kr_symbol_names";
import { horizonLabel, marketScopeLabel, verdictLabel } from "../_components/labels";
import { useSymbolSuggestions } from "../_components/symbol_autocomplete";
import { trackEvent } from "../_components/telemetry";
import { EmptyState, ErrorState, LoadingBlock } from "../_components/ui_primitives";

const PAGE_SIZE = 20;

function asItems(payload: unknown): Decision[] {
  if (Array.isArray(payload)) return payload as Decision[];
  if (payload && typeof payload === "object" && "items" in payload) {
    return ((payload as { items?: unknown }).items ?? []) as Decision[];
  }
  return [];
}

interface DecisionRiskSnapshot {
  contextRiskScore: number;
  socialScore: number;
  eventScore: number;
  volumeScore: number;
  flowScore: number;
  technicalScore: number;
  volumeGuardPassed: boolean;
  flowGuardPassed: boolean;
  technicalGuardPassed: boolean;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function passRatio(items: SignalScored[], key: keyof SignalScored): number {
  if (items.length === 0) return 1;
  const passed = items.filter((item) => item[key] === true).length;
  return passed / items.length;
}

function summarizeDecisionRisk(scoredGroup: SignalScored[]): DecisionRiskSnapshot {
  return {
    contextRiskScore: avg(scoredGroup.map((item) => item.contextRiskScore ?? 0)),
    socialScore: avg(scoredGroup.map((item) => item.socialScore ?? 0)),
    eventScore: avg(scoredGroup.map((item) => item.eventScore ?? 0)),
    volumeScore: avg(scoredGroup.map((item) => item.volumeScore ?? 0)),
    flowScore: avg(scoredGroup.map((item) => item.flowScore ?? 0)),
    technicalScore: avg(scoredGroup.map((item) => item.technicalScore ?? 0)),
    volumeGuardPassed: passRatio(scoredGroup, "volumeGuardPassed") >= 0.5,
    flowGuardPassed: passRatio(scoredGroup, "flowGuardPassed") >= 0.5,
    technicalGuardPassed: passRatio(scoredGroup, "technicalGuardPassed") >= 0.5
  };
}

function formatDecisionSymbol(decision: Decision, krNames: Record<string, string>, usNames: Record<string, string>): string {
  if (decision.marketScope === "KR" || /^\d{6}$/.test(decision.symbol)) {
    return formatKrSymbol(decision.symbol, krNames);
  }
  return formatUsSymbol(decision.symbol, usNames);
}

export default function DecisionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, refreshKey, setAuthRequired } = useDashboardContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<Decision[]>([]);
  const [scoredItems, setScoredItems] = useState<SignalScored[]>([]);
  const [symbol, setSymbol] = useState("");
  const [scope, setScope] = useState("ALL");
  const [verdict, setVerdict] = useState("ALL");
  const [horizon, setHorizon] = useState("ALL");
  const [minConfidence, setMinConfidence] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");

  const qsScope = searchParams.get("scope") ?? "";

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/decisions" });
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
      const [decisionRes, scoredRes] = await Promise.all([
        apiRequest<unknown>(`/api/agent/decisions?limit=200&offset=0${scopeQuery}`, { token }),
        apiRequest<{ items: SignalScored[] }>(`/api/agent/signals/scored?limit=300&offset=0${scopeQuery}`, { token })
      ]);
      if (cancelled) return;
      setLoading(false);
      if (!decisionRes.ok) {
        if (decisionRes.status === 401) setAuthRequired(true);
        setItems([]);
        setError(decisionRes.error);
        return;
      }
      if (!scoredRes.ok) {
        if (scoredRes.status === 401) setAuthRequired(true);
        setItems([]);
        setError(scoredRes.error);
        return;
      }
      const list = asItems(decisionRes.data);
      setItems(list);
      setScoredItems(scoredRes.data.items ?? []);
      if (list.length > 0) setSelectedId(list[0].id ?? "");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, setAuthRequired, scope]);

  const krSymbolNames = useKrSymbolNameMap(
    items.map((item) => item.symbol),
    token
  );
  const usSymbolNames = useUsSymbolNameMap(
    items.map((item) => item.symbol),
    token
  );

  const { items: symbolSuggestions, loading: suggestionLoading } = useSymbolSuggestions({
    query: symbol,
    scope,
    token,
    enabled: true
  });

  function normalizeSearchText(value: string): string {
    return value.replace(/\s+/g, "").toUpperCase();
  }

  const filtered = useMemo(() => {
    const sym = normalizeSearchText(symbol.trim());
    return items.filter((d) => {
      if (sym) {
        const symbolMatch = normalizeSearchText(d.symbol).includes(sym);
        const nameMatch = normalizeSearchText(krSymbolNames[d.symbol] ?? "").includes(sym);
        const usNameMatch = normalizeSearchText(usSymbolNames[d.symbol] ?? "").includes(sym);
        if (!symbolMatch && !nameMatch && !usNameMatch) return false;
      }
      if (verdict !== "ALL" && d.verdict !== verdict) return false;
      if (horizon !== "ALL" && d.timeHorizon !== horizon) return false;
      if (d.confidence < minConfidence) return false;
      return true;
    });
  }, [items, symbol, verdict, horizon, minConfidence, krSymbolNames, usSymbolNames]);

  useEffect(() => {
    setPage(1);
    void trackEvent({
      name: "decision_filter_changed",
      page: "/dashboard/decisions",
      meta: { symbol, scope, verdict, horizon, minConfidence }
    });
  }, [symbol, scope, verdict, horizon, minConfidence]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);
  const selected = filtered.find((d) => d.id === selectedId) ?? pageItems[0] ?? null;
  const scoredById = useMemo(() => {
    const map = new Map<string, SignalScored>();
    for (const item of scoredItems) {
      if (item.id) map.set(item.id, item);
    }
    return map;
  }, [scoredItems]);
  const decisionRisk = useMemo(() => {
    if (!selected) return null;
    const scoredGroup = selected.sourcesUsed.map((sourceId) => scoredById.get(sourceId)).filter((item): item is SignalScored => Boolean(item));
    if (scoredGroup.length === 0) return null;
    return summarizeDecisionRisk(scoredGroup);
  }, [selected, scoredById]);
  const selectedScoredSignals = useMemo(() => {
    if (!selected) return [];
    return selected.sourcesUsed
      .map((sourceId) => scoredById.get(sourceId))
      .filter((item): item is SignalScored => Boolean(item));
  }, [selected, scoredById]);

  if (loading) return <LoadingBlock label="판단 데이터를 불러오는 중..." />;
  if (error) return <ErrorState message={error} />;
  if (items.length === 0) return <EmptyState title="판단 데이터 없음" description="파이프라인 실행 후 이 페이지를 새로고침하세요." />;

  return (
    <div className="dash-grid">
      <section className="card">
        <h3>판단 필터</h3>
        <div className="filters-grid">
          <label>
            심볼
            <div className="symbol-search-wrap">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={scope === "KR" ? "코드/한글 종목명" : "TSLA"}
              />
              {scope === "KR" && (suggestionLoading || symbolSuggestions.length > 0) ? (
                <div className="autocomplete-list" role="listbox" aria-label="한국 종목 자동완성">
                  {symbolSuggestions.map((item) => (
                    <button
                      key={`${item.marketScope}:${item.symbol}`}
                      type="button"
                      className="autocomplete-item"
                      onClick={() => setSymbol(item.symbol)}
                    >
                      {item.display}
                    </button>
                  ))}
                  {suggestionLoading ? <div className="autocomplete-item muted">검색 중...</div> : null}
                </div>
              ) : null}
            </div>
          </label>
          <label>
            시장
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="ALL">전체</option>
              <option value="US">미국</option>
              <option value="KR">한국</option>
            </select>
          </label>
          <label>
            판단 결과
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
              <option value="ALL">전체</option>
              <option value="BUY_NOW">{verdictLabel("BUY_NOW")}</option>
              <option value="WATCH">{verdictLabel("WATCH")}</option>
              <option value="AVOID">{verdictLabel("AVOID")}</option>
            </select>
          </label>
          <label>
            보유 기간
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
              <option value="ALL">전체</option>
              <option value="intraday">당일</option>
              <option value="swing">스윙</option>
              <option value="long_term">장기</option>
            </select>
          </label>
          <label>
            최소 신뢰도 ({Math.round(minConfidence * 100)}%)
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <h3>판단 목록 ({filtered.length})</h3>
          <div className="list">
            {pageItems.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`list-item as-button ${selected?.id === d.id ? "selected" : ""}`}
                onClick={() => setSelectedId(d.id ?? "")}
              >
                <div className="list-item-head">
                  <strong>{formatDecisionSymbol(d, krSymbolNames, usSymbolNames)}</strong>
                  <span className="badge">{verdictLabel(d.verdict)}</span>
                </div>
                <p>시장: {marketScopeLabel(d.marketScope)}</p>
                <p>신뢰도: {Math.round(d.confidence * 100)}%</p>
                <p>{d.thesisSummary.slice(0, 120)}...</p>
              </button>
            ))}
          </div>
          <div className="pagination">
            <button type="button" onClick={() => setPage(Math.max(1, clampedPage - 1))} disabled={clampedPage <= 1}>
              이전
            </button>
            <span>
              페이지 {clampedPage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, clampedPage + 1))}
              disabled={clampedPage >= pageCount}
            >
              다음
            </button>
          </div>
        </div>

        <div className="card">
          <h3>판단 상세</h3>
          {!selected ? (
            <p>목록에서 판단을 선택하세요.</p>
          ) : (
            <div className="detail-stack">
              <p><strong>심볼:</strong> {formatDecisionSymbol(selected, krSymbolNames, usSymbolNames)}</p>
              <p><strong>시장:</strong> {marketScopeLabel(selected.marketScope)}</p>
              <p><strong>판단:</strong> {verdictLabel(selected.verdict)}</p>
              <p><strong>신뢰도:</strong> {Math.round(selected.confidence * 100)}%</p>
              <p><strong>보유 기간:</strong> {horizonLabel(selected.timeHorizon)}</p>
              <p><strong>핵심 근거:</strong> {selected.thesisSummary}</p>
              <p><strong>진입 트리거:</strong> {selected.entryTrigger}</p>
              <EntryTriggerTracker symbol={selected.symbol} entryTrigger={selected.entryTrigger} token={token} />
              {selectedScoredSignals.length > 0 ? <SignalEvidenceBars signals={selectedScoredSignals} /> : null}
              {decisionRisk ? (
                <RiskHeatmapPanel
                  contextRiskScore={decisionRisk.contextRiskScore}
                  socialScore={decisionRisk.socialScore}
                  eventScore={decisionRisk.eventScore}
                  volumeScore={decisionRisk.volumeScore}
                  flowScore={decisionRisk.flowScore}
                  technicalScore={decisionRisk.technicalScore}
                  volumeGuardPassed={decisionRisk.volumeGuardPassed}
                  flowGuardPassed={decisionRisk.flowGuardPassed}
                  technicalGuardPassed={decisionRisk.technicalGuardPassed}
                />
              ) : null}
              <p><strong>무효화 조건:</strong> {selected.invalidation}</p>
              <p><strong>리스크 노트:</strong> {selected.riskNotes.join(", ") || "-"}</p>
              <p><strong>촉매 요인:</strong> {selected.catalysts.join(", ") || "-"}</p>
              <p><strong>연결 소스:</strong></p>
              <div className="tag-row">
                {selected.sourcesUsed.length === 0 ? (
                  <span className="tag">-</span>
                ) : (
                  selected.sourcesUsed.map((sourceId) => (
                    <Link
                      key={sourceId}
                      className="tag"
                      href={`/dashboard/signals?tab=scored&symbol=${encodeURIComponent(
                        selected.symbol
                      )}&scoredId=${encodeURIComponent(sourceId)}`}
                    >
                      {sourceId}
                    </Link>
                  ))
                )}
              </div>
              <div className="button-row">
                <Link
                  className="link-button"
                  href={`/dashboard/signals?tab=scored&symbol=${encodeURIComponent(selected.symbol)}`}
                >
                  관련 신호 보기
                </Link>
                <Link
                  className="link-button ghost"
                  href={`/dashboard/runs?decisionAt=${encodeURIComponent(selected.createdAt)}`}
                >
                  관련 실행 보기
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
