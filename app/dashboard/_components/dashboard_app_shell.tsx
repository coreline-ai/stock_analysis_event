"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api_client";
import { DashboardProvider, useDashboardContext } from "./dashboard_context";
import { trackEvent } from "./telemetry";
import type { MarketScope } from "@/core/domain/types";

interface ProgressStageDef {
  key: string;
  label: string;
  weight: number;
}

interface ProgressStageView {
  key: string;
  label: string;
  widthPct: number;
  fillPct: number;
}

interface ProgressSnapshot {
  percent: number;
  elapsedSec: number;
  stageLabel: string;
  stages: ProgressStageView[];
  stageFlowText: string;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "운영 대시보드" },
  { href: "/dashboard/decisions", label: "판단 탐색" },
  { href: "/dashboard/reports", label: "리포트" },
  { href: "/dashboard/symbol-report", label: "종목 리포트" },
  { href: "/dashboard/runs", label: "실행 이력" },
  { href: "/dashboard/signals", label: "신호 탐색" },
  { href: "/dashboard/settings", label: "설정" }
];

const KR_PROGRESS_STAGES: ProgressStageDef[] = [
  { key: "ticker", label: "티커 준비", weight: 0.08 },
  { key: "gather", label: "신호 수집", weight: 0.38 },
  { key: "normalize", label: "정규화", weight: 0.14 },
  { key: "enrich", label: "KR 보강", weight: 0.12 },
  { key: "score", label: "점수화", weight: 0.1 },
  { key: "decide", label: "판단", weight: 0.12 },
  { key: "report", label: "리포트", weight: 0.06 }
];

const US_PROGRESS_STAGES: ProgressStageDef[] = [
  { key: "ticker", label: "티커 준비", weight: 0.1 },
  { key: "gather", label: "신호 수집", weight: 0.45 },
  { key: "normalize", label: "정규화", weight: 0.12 },
  { key: "score", label: "점수화", weight: 0.12 },
  { key: "decide", label: "판단", weight: 0.15 },
  { key: "report", label: "리포트", weight: 0.06 }
];

function progressStagesByScope(scope: MarketScope): ProgressStageDef[] {
  return scope === "KR" ? KR_PROGRESS_STAGES : US_PROGRESS_STAGES;
}

function expectedRunSeconds(scope: MarketScope): number {
  if (scope === "KR") return 90;
  if (scope === "US") return 60;
  return 120;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function computeProgressSnapshot(scope: MarketScope, startedAtMs: number, nowMs: number): ProgressSnapshot {
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const totalMs = expectedRunSeconds(scope) * 1000;
  const stageDefs = progressStagesByScope(scope);
  // 98%에서 고정 후 서버 완료 응답 시 종료되도록 처리
  const ratio = clamp01(Math.min(0.98, elapsedMs / Math.max(1, totalMs)));
  let consumed = ratio;
  const stages = stageDefs.map((stage) => {
    const widthPct = Math.round(stage.weight * 1000) / 10;
    const filledWeight = Math.max(0, Math.min(stage.weight, consumed));
    const fillPct = stage.weight > 0 ? Math.round((filledWeight / stage.weight) * 1000) / 10 : 0;
    consumed = Math.max(0, consumed - stage.weight);
    return {
      key: stage.key,
      label: stage.label,
      widthPct,
      fillPct
    };
  });
  const active = stages.find((stage) => stage.fillPct < 100) ?? stages[stages.length - 1];
  return {
    percent: Math.round(ratio * 100),
    elapsedSec: Math.floor(elapsedMs / 1000),
    stageLabel: active?.label ?? "진행 중",
    stages,
    stageFlowText: stageDefs.map((stage) => stage.label).join(" → ")
  };
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, setToken, llmProvider, setLlmProvider, requestRefresh, setAuthRequired, authRequired, pushToast, toasts, removeToast } =
    useDashboardContext();
  const [tokenInput, setTokenInput] = useState(token);
  const [runningUS, setRunningUS] = useState(false);
  const [runningKR, setRunningKR] = useState(false);
  const [usStartedAt, setUsStartedAt] = useState<number | null>(null);
  const [krStartedAt, setKrStartedAt] = useState<number | null>(null);
  const [progressTick, setProgressTick] = useState<number>(Date.now());

  useEffect(() => {
    setTokenInput(token);
  }, [token]);

  useEffect(() => {
    if (!runningUS && !runningKR) return;
    const timer = window.setInterval(() => {
      setProgressTick(Date.now());
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [runningUS, runningKR]);

  const tokenStateText = useMemo(() => {
    if (!token) return "저장된 토큰 없음 (로컬 개발 허용)";
    return `토큰 저장됨 (${Math.min(token.length, 16)}자)`;
  }, [token]);

  const mappedErrorGuide = useMemo(() => {
    return {
      unauthorized: "인증 실패: 운영 환경에서는 API_TOKEN 설정 및 전달이 필요합니다.",
      invalid_request: "요청 파라미터가 올바르지 않습니다. 시장 스코프/전략 키를 확인하세요.",
      missing_env: "필수 환경변수가 누락되었습니다. DATABASE_URL / LLM_PROVIDER를 확인하세요.",
      forbidden_env: "금지된 거래 관련 환경변수가 감지되었습니다. 브로커/거래 키를 제거하세요.",
      db_error: "데이터베이스 연결 또는 쿼리에 실패했습니다. Postgres와 마이그레이션을 확인하세요.",
      unknown_error: "알 수 없는 오류가 발생했습니다. 서버 로그를 확인하세요."
    };
  }, []);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAuthRequired(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onEsc);
    };
  }, [setAuthRequired]);

  async function handleRunNow(marketScope: MarketScope) {
    const strategyKey = marketScope === "KR" ? "kr_default" : marketScope === "US" ? "us_default" : "all_default";
    if (marketScope === "US") {
      setRunningUS(true);
      setUsStartedAt(Date.now());
    }
    if (marketScope === "KR") {
      setRunningKR(true);
      setKrStartedAt(Date.now());
    }
    const res = await apiRequest<{
      runId: string;
      marketScope: MarketScope;
      strategyKey: string;
      status: "success" | "partial" | "failed";
      errorSummary?: string | null;
      rawCount: number;
      scoredCount: number;
      decidedCount: number;
      reportId?: string;
    }>("/api/agent/trigger", { token, method: "POST", body: { marketScope, strategyKey, llmProvider } });
    if (marketScope === "US") {
      setRunningUS(false);
      setUsStartedAt(null);
    }
    if (marketScope === "KR") {
      setRunningKR(false);
      setKrStartedAt(null);
    }

    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      const defaultGuide = mappedErrorGuide[res.code as keyof typeof mappedErrorGuide] ?? mappedErrorGuide.unknown_error;
      const guide =
        marketScope === "KR" && res.code === "missing_env" && res.error.includes("DART_API_KEY")
          ? "KR 실행 필수값 누락: `DART_API_KEY`를 설정하세요."
          : defaultGuide;
      pushToast(`[${marketScope}] 실행 실패: ${res.error} | ${guide}`, "error");
      void trackEvent({
        name: "trigger_failed",
        page: pathname,
        meta: { status: res.status, code: res.code ?? "unknown", marketScope, strategyKey }
      });
      return;
    }

    requestRefresh();
    if (res.data.status === "partial") {
      pushToast(
        `[${res.data.marketScope}] 부분 완료 (${res.data.errorSummary ?? "guarded"}) raw=${res.data.rawCount}, scored=${res.data.scoredCount}, decisions=${res.data.decidedCount}`,
        "info"
      );
    } else {
      pushToast(
        `[${res.data.marketScope}] 실행 완료 (raw=${res.data.rawCount}, scored=${res.data.scoredCount}, decisions=${res.data.decidedCount})`,
        "success"
      );
    }
    void trackEvent({
      name: "trigger_completed",
      page: pathname,
      meta: {
        status: res.data.status,
        rawCount: res.data.rawCount,
        scoredCount: res.data.scoredCount,
        decidedCount: res.data.decidedCount,
        errorSummary: res.data.errorSummary ?? null,
        marketScope: res.data.marketScope,
        strategyKey: res.data.strategyKey
      }
    });
  }

  const usProgress = runningUS && usStartedAt ? computeProgressSnapshot("US", usStartedAt, progressTick) : null;
  const krProgress = runningKR && krStartedAt ? computeProgressSnapshot("KR", krStartedAt, progressTick) : null;

  return (
    <div className="dash-shell">
      <a href="#main-content" className="skip-link">
        본문으로 바로가기
      </a>
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <h2>리서치 엔진</h2>
          <p>리서치 전용</p>
        </div>

        <nav className="dash-nav" aria-label="대시보드 내비게이션">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "dash-link active" : "dash-link"}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="token-panel">
          <h3>API 토큰</h3>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="API_TOKEN"
            aria-label="API 토큰 입력"
          />
          <div className="token-actions">
            <button
              type="button"
              onClick={() => {
                setToken(tokenInput);
                void trackEvent({
                  name: "token_saved",
                  page: pathname,
                  meta: { tokenLength: tokenInput.length }
                });
              }}
            >
              저장
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setToken("");
                void trackEvent({ name: "token_cleared", page: pathname });
              }}
            >
              지우기
            </button>
          </div>
          <p>{tokenStateText}</p>
        </div>
      </aside>

      <section className="dash-main">
        <header className="dash-header">
          <div>
            <div className="pill-row">
              <span className="pill">리서치 전용</span>
              <span className="pill">실거래 실행 없음</span>
              <span className="pill">GUI 사용 가능</span>
              <span className="pill">LLM: {llmProvider.toUpperCase()}</span>
            </div>
          </div>
          <div className="dash-header-actions">
            <label className="inline-select">
              LLM
              <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value as "glm" | "openai" | "gemini")}>
                <option value="glm">GLM</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <button
              type="button"
              className="run-button"
              onClick={() => handleRunNow("US")}
              disabled={runningUS}
              aria-label="미국 분석 실행"
            >
              {runningUS ? "미국 분석 실행 중..." : "미국 분석 실행"}
            </button>
            <button
              type="button"
              className="run-button ghost"
              onClick={() => handleRunNow("KR")}
              disabled={runningKR}
              aria-label="한국 분석 실행"
            >
              {runningKR ? "한국 분석 실행 중..." : "한국 분석 실행"}
            </button>
          </div>
        </header>
        {(usProgress || krProgress) ? (
          <section className="run-progress-wrap" aria-live="polite">
            {usProgress ? (
              <div className="run-progress-card">
                <div className="list-item-head">
                  <strong>미국 분석 진행률 {usProgress.percent}%</strong>
                  <span className="badge-alt">{usProgress.stageLabel}</span>
                </div>
                <div className="run-progress-stagebar" aria-label="미국 분석 단계 진행">
                  {usProgress.stages.map((stage) => (
                    <div key={`US-${stage.key}`} className="run-progress-seg" style={{ width: `${stage.widthPct}%` }} title={stage.label}>
                      <span className="run-progress-seg-fill" style={{ width: `${stage.fillPct}%` }} />
                    </div>
                  ))}
                </div>
                <p className="muted-line">경과 {usProgress.elapsedSec}초 · 구간: {usProgress.stageFlowText}</p>
              </div>
            ) : null}
            {krProgress ? (
              <div className="run-progress-card">
                <div className="list-item-head">
                  <strong>한국 분석 진행률 {krProgress.percent}%</strong>
                  <span className="badge-alt">{krProgress.stageLabel}</span>
                </div>
                <div className="run-progress-stagebar" aria-label="한국 분석 단계 진행">
                  {krProgress.stages.map((stage) => (
                    <div key={`KR-${stage.key}`} className="run-progress-seg" style={{ width: `${stage.widthPct}%` }} title={stage.label}>
                      <span className="run-progress-seg-fill" style={{ width: `${stage.fillPct}%` }} />
                    </div>
                  ))}
                </div>
                <p className="muted-line">경과 {krProgress.elapsedSec}초 · 구간: {krProgress.stageFlowText}</p>
              </div>
            ) : null}
          </section>
        ) : null}
        <main id="main-content" className="dash-content" tabIndex={-1}>
          {children}
        </main>
      </section>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast ${toast.type}`}
            onClick={() => removeToast(toast.id)}
            title="닫기"
          >
            {toast.message}
          </button>
        ))}
      </div>

      {authRequired ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="modal-card">
            <h3 id="auth-modal-title">인증 필요</h3>
            <p>이 런타임은 `API_TOKEN`이 필요합니다. 좌측 패널에 저장 후 다시 시도하세요.</p>
            <button type="button" onClick={() => setAuthRequired(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardAppShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <ShellInner>{children}</ShellInner>
    </DashboardProvider>
  );
}
