"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentRun, Decision, DailyReport } from "@/core/domain/types";
import { apiRequest } from "./_components/api_client";
import { useDashboardContext } from "./_components/dashboard_context";
import { formatKrSymbol, useKrSymbolNameMap } from "./_components/kr_symbol_names";
import { marketScopeLabel, runStatusLabel, sourceLabel, stageLabel, triggerLabel, verdictLabel } from "./_components/labels";
import { trackEvent } from "./_components/telemetry";
import { EmptyState, ErrorState, LoadingBlock } from "./_components/ui_primitives";

interface SummaryResponse {
  kpi: {
    buyNow: number;
    watch: number;
    avoid: number;
    decisions: number;
    reports: number;
    runs: number;
    usDecisions: number;
    krDecisions: number;
  };
  runHealth: {
    success: number;
    partial: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    latestRun: AgentRun | null;
  };
  latest: {
    decisions: Decision[];
    reports: DailyReport[];
  };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function DashboardCockpitPage() {
  const { token, refreshKey, setAuthRequired } = useDashboardContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const res = await apiRequest<SummaryResponse>("/api/agent/summary", { token });
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        if (res.status === 401) setAuthRequired(true);
        setSummary(null);
        setError(res.error);
        return;
      }
      setSummary(res.data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, setAuthRequired]);

  const sourcePairs = useMemo(() => {
    const counts = summary?.runHealth.latestRun?.gatheredCounts ?? {};
    return Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [summary]);

  const stagePairs = useMemo(() => {
    const timings = summary?.runHealth.latestRun?.stageTimingsMs ?? {};
    return Object.entries(timings).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [summary]);

  const krSymbolNames = useKrSymbolNameMap(
    summary?.latest.decisions.map((item) => item.symbol) ?? [],
    token
  );

  if (loading) return <LoadingBlock label="콕핏 데이터를 불러오는 중..." />;
  if (error) return <ErrorState message={error} />;
  if (!summary) return <EmptyState title="요약 데이터 없음" description="파이프라인 실행 후 콕핏을 새로고침하세요." />;

  return (
    <div className="dash-grid">
      <section className="hero">
        <h1 className="hero-title">운영 콕핏</h1>
        <p className="hero-subtitle">실행 상태, 판단 결과, 신호 처리량을 한눈에 확인합니다.</p>
        <div className="grid grid-3">
          <div className="card kpi">
            <span className="badge">{verdictLabel("BUY_NOW")}</span>
            <strong>{summary.kpi.buyNow}</strong>
            <span className="hero-subtitle">즉시 검토 후보</span>
          </div>
          <div className="card kpi">
            <span className="badge badge-alt">{verdictLabel("WATCH")}</span>
            <strong>{summary.kpi.watch}</strong>
            <span className="hero-subtitle">트리거 대기</span>
          </div>
          <div className="card kpi">
            <span className="badge badge-red">{verdictLabel("AVOID")}</span>
            <strong>{summary.kpi.avoid}</strong>
            <span className="hero-subtitle">고위험 구간</span>
          </div>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card kpi">
          <span className="badge">미국 결정 수</span>
          <strong>{summary.kpi.usDecisions}</strong>
          <span className="hero-subtitle">US 스코프 누적</span>
        </div>
        <div className="card kpi">
          <span className="badge badge-alt">한국 결정 수</span>
          <strong>{summary.kpi.krDecisions}</strong>
          <span className="hero-subtitle">KR 스코프 누적</span>
        </div>
      </section>

      <section className="grid grid-3">
        <div className="card">
          <h3>실행 건전성</h3>
          <p>성공률: {percent(summary.runHealth.successRate)}</p>
          <p>성공 / 부분 / 실패: {summary.runHealth.success} / {summary.runHealth.partial} / {summary.runHealth.failed}</p>
          <p>평균 소요: {summary.runHealth.avgDurationMs} ms</p>
        </div>
        <div className="card">
          <h3>처리량</h3>
          <p>실행: {summary.kpi.runs}</p>
          <p>판단: {summary.kpi.decisions}</p>
          <p>리포트: {summary.kpi.reports}</p>
          <p>미국 판단: {summary.kpi.usDecisions}</p>
          <p>한국 판단: {summary.kpi.krDecisions}</p>
        </div>
        <div className="card">
          <h3>최근 실행</h3>
          <p>상태: {runStatusLabel(summary.runHealth.latestRun?.status)}</p>
          <p>시작: {summary.runHealth.latestRun?.startedAt ? new Date(summary.runHealth.latestRun.startedAt).toLocaleString() : "-"}</p>
          <p>트리거: {triggerLabel(summary.runHealth.latestRun?.triggerType)}</p>
          <p>시장: {marketScopeLabel(summary.runHealth.latestRun?.marketScope)}</p>
          <p>전략: {summary.runHealth.latestRun?.strategyKey ?? "-"}</p>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <h3>소스 처리량</h3>
          {sourcePairs.length === 0 ? (
            <p>수집된 소스 데이터가 아직 없습니다.</p>
          ) : (
            <div className="metric-list">
              {sourcePairs.map(([name, value]) => (
                <div key={name} className="metric-row">
                  <span>{sourceLabel(name)}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>단계별 소요 시간 (ms)</h3>
          {stagePairs.length === 0 ? (
            <p>단계별 소요 시간 데이터가 아직 없습니다.</p>
          ) : (
            <div className="metric-list">
              {stagePairs.map(([name, value]) => (
                <div key={name} className="metric-row">
                  <span>{stageLabel(name)}</span>
                  <strong>{Math.round(value)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <h3>최근 판단</h3>
          <div className="list">
            {summary.latest.decisions.length === 0 ? (
              <div className="list-item">판단 데이터가 아직 없습니다.</div>
            ) : (
              summary.latest.decisions.map((d) => (
                <div key={d.id} className="list-item">
                  <div className="list-item-head">
                    <strong>{formatKrSymbol(d.symbol, krSymbolNames)}</strong>
                    <span className="badge">{verdictLabel(d.verdict)}</span>
                  </div>
                  <p>{d.thesisSummary}</p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <h3>최근 리포트</h3>
          <div className="list">
            {summary.latest.reports.length === 0 ? (
              <div className="list-item">리포트 데이터가 아직 없습니다.</div>
            ) : (
              summary.latest.reports.map((r) => (
                <div key={r.id} className="list-item">
                  <div className="list-item-head">
                    <strong>{new Date(r.reportDate).toISOString().slice(0, 10)}</strong>
                    <span className="badge badge-alt">리포트</span>
                  </div>
                  <p>{r.summaryMarkdown.slice(0, 180)}...</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
