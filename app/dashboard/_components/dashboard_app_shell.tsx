"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api_client";
import { DashboardProvider, useDashboardContext } from "./dashboard_context";
import { trackEvent } from "./telemetry";
import type { MarketScope } from "@/core/domain/types";

const NAV_LINKS = [
  { href: "/dashboard", label: "운영 콕핏" },
  { href: "/dashboard/decisions", label: "판단 탐색" },
  { href: "/dashboard/reports", label: "리포트" },
  { href: "/dashboard/runs", label: "실행 이력" },
  { href: "/dashboard/signals", label: "신호 탐색" },
  { href: "/dashboard/settings", label: "설정" }
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, setToken, requestRefresh, setAuthRequired, authRequired, pushToast, toasts, removeToast } =
    useDashboardContext();
  const [tokenInput, setTokenInput] = useState(token);
  const [runningUS, setRunningUS] = useState(false);
  const [runningKR, setRunningKR] = useState(false);

  useEffect(() => {
    setTokenInput(token);
  }, [token]);

  const tokenStateText = useMemo(() => {
    if (!token) return "저장된 토큰 없음 (로컬 개발 허용)";
    return `토큰 저장됨 (${Math.min(token.length, 16)}자)`;
  }, [token]);

  const mappedErrorGuide = useMemo(() => {
    return {
      unauthorized: "인증 실패: 운영 환경에서는 API_TOKEN 설정 및 전달이 필요합니다.",
      invalid_request: "요청 파라미터가 올바르지 않습니다. 시장 스코프/전략 키를 확인하세요.",
      missing_env: "필수 환경변수가 누락되었습니다. DATABASE_URL / CRON_SECRET를 확인하세요.",
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
    if (marketScope === "US") setRunningUS(true);
    if (marketScope === "KR") setRunningKR(true);
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
    }>("/api/agent/trigger", { token, method: "POST", body: { marketScope, strategyKey } });
    if (marketScope === "US") setRunningUS(false);
    if (marketScope === "KR") setRunningKR(false);

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
            </div>
          </div>
          <div className="dash-header-actions">
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
