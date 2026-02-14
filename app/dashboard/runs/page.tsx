"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AgentRun } from "@/core/domain/types";
import { apiRequest } from "../_components/api_client";
import { useDashboardContext } from "../_components/dashboard_context";
import { marketScopeLabel, runStatusLabel, triggerLabel } from "../_components/labels";
import { trackEvent } from "../_components/telemetry";
import { EmptyState, ErrorState, LoadingBlock } from "../_components/ui_primitives";

function asItems(payload: unknown): AgentRun[] {
  if (Array.isArray(payload)) return payload as AgentRun[];
  if (payload && typeof payload === "object" && "items" in payload) {
    return ((payload as { items?: unknown }).items ?? []) as AgentRun[];
  }
  return [];
}

export default function RunsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, refreshKey, setAuthRequired } = useDashboardContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<AgentRun[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const decisionAt = searchParams.get("decisionAt") ?? "";
  const qsStatus = searchParams.get("status") ?? "";
  const qsScope = searchParams.get("scope") ?? "";

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/runs" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const scopeQs = scopeFilter !== "ALL" ? `&scope=${scopeFilter}` : "";
      const res = await apiRequest<unknown>(`/api/agent/status?limit=200&offset=0${scopeQs}`, { token });
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
      if (list.length > 0) {
        const atMs = decisionAt ? new Date(decisionAt).getTime() : Number.NaN;
        let candidate = list[0];
        if (Number.isFinite(atMs)) {
          const inside = list.find((r) => {
            const start = new Date(r.startedAt).getTime();
            const end = r.finishedAt ? new Date(r.finishedAt).getTime() : start;
            return start <= atMs && atMs <= end;
          });
          if (inside) {
            candidate = inside;
          } else {
            candidate =
              list
                .slice()
                .sort((a, b) => Math.abs(new Date(a.startedAt).getTime() - atMs) - Math.abs(new Date(b.startedAt).getTime() - atMs))[0] ??
              list[0];
          }
        }
        setSelectedId(candidate?.id ?? "");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, setAuthRequired, decisionAt, scopeFilter]);

  useEffect(() => {
    if (qsStatus === "success" || qsStatus === "partial" || qsStatus === "failed") {
      setStatusFilter(qsStatus);
    }
  }, [qsStatus]);

  useEffect(() => {
    if (qsScope === "US" || qsScope === "KR" || qsScope === "ALL") {
      setScopeFilter(qsScope);
    }
  }, [qsScope]);

  useEffect(() => {
    const currentStatus = qsStatus === "success" || qsStatus === "partial" || qsStatus === "failed" ? qsStatus : "ALL";
    const currentScope = qsScope === "US" || qsScope === "KR" || qsScope === "ALL" ? qsScope : "ALL";
    if (statusFilter === currentStatus && scopeFilter === currentScope) return;

    const params = new URLSearchParams(searchParams.toString());
    if (statusFilter === "ALL") params.delete("status");
    else params.set("status", statusFilter);
    if (scopeFilter === "ALL") params.delete("scope");
    else params.set("scope", scopeFilter);

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [statusFilter, scopeFilter, qsStatus, qsScope, searchParams, router, pathname]);

  useEffect(() => {
    setVisibleCount(60);
    void trackEvent({
      name: "run_filter_changed",
      page: "/dashboard/runs",
      meta: { statusFilter, scopeFilter }
    });
  }, [statusFilter, scopeFilter, refreshKey]);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return items;
    return items.filter((r) => r.status === statusFilter);
  }, [items, statusFilter]);
  const visibleRuns = filtered.slice(0, visibleCount);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  if (loading) return <LoadingBlock label="실행 이력을 불러오는 중..." />;
  if (error) return <ErrorState message={error} />;
  if (items.length === 0) return <EmptyState title="실행 이력 없음" description="파이프라인을 실행해 첫 이력을 생성하세요." />;

  return (
    <div className="grid grid-2">
      <section className="card">
        <div className="list-item-head">
          <h3>실행 이력</h3>
          <div className="button-row">
            <label>
              상태
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">전체</option>
                <option value="success">성공</option>
                <option value="partial">부분</option>
                <option value="failed">실패</option>
              </select>
            </label>
            <label>
              시장
              <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
                <option value="ALL">전체</option>
                <option value="US">미국</option>
                <option value="KR">한국</option>
              </select>
            </label>
          </div>
        </div>
        <div className="list">
          {visibleRuns.map((run) => (
            <button
              key={run.id}
              type="button"
              className={`list-item as-button ${selected?.id === run.id ? "selected" : ""}`}
              onClick={() => setSelectedId(run.id ?? "")}
            >
              <div className="list-item-head">
                <strong>{new Date(run.startedAt).toLocaleString()}</strong>
                <span className={`badge ${run.status === "failed" ? "badge-red" : run.status === "partial" ? "badge-alt" : ""}`}>
                  {runStatusLabel(run.status)}
                </span>
              </div>
              <p>트리거: {triggerLabel(run.triggerType)}</p>
              <p>시장: {marketScopeLabel(run.marketScope)} / 전략: {run.strategyKey ?? "-"}</p>
              <p>스코어링: {run.scoredCount ?? 0}, 판단: {run.decidedCount ?? 0}</p>
            </button>
          ))}
        </div>
        {visibleCount < filtered.length ? (
          <div className="button-row" style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setVisibleCount((prev) => prev + 60)}>
              실행 이력 더 보기
            </button>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h3>실행 상세</h3>
        {!selected ? (
          <p>실행 항목을 선택하세요.</p>
        ) : (
          <div className="detail-stack">
            <p><strong>상태:</strong> {runStatusLabel(selected.status)}</p>
            <p><strong>트리거:</strong> {triggerLabel(selected.triggerType)}</p>
            <p><strong>시장:</strong> {marketScopeLabel(selected.marketScope)}</p>
            <p><strong>전략:</strong> {selected.strategyKey ?? "-"}</p>
            <p><strong>시작:</strong> {new Date(selected.startedAt).toLocaleString()}</p>
            <p><strong>종료:</strong> {selected.finishedAt ? new Date(selected.finishedAt).toLocaleString() : "-"}</p>
            <p><strong>스코어링 수:</strong> {selected.scoredCount ?? 0}</p>
            <p><strong>판단 수:</strong> {selected.decidedCount ?? 0}</p>
            <p><strong>AI 판단 호출 수:</strong> {selected.llmCalls ?? 0}</p>
            <p><strong>AI 사용량(추정 토큰):</strong> {selected.llmTokensEstimated ?? 0}</p>
            <p><strong>오류:</strong> {selected.errorSummary ?? "-"}</p>
            <p><strong>수집 건수:</strong></p>
            <pre className="code-box">{JSON.stringify(selected.gatheredCounts ?? {}, null, 2)}</pre>
            <p><strong>단계별 소요:</strong></p>
            <pre className="code-box">{JSON.stringify(selected.stageTimingsMs ?? {}, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
