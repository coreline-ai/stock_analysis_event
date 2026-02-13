"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../_components/api_client";
import { useDashboardContext } from "../_components/dashboard_context";
import { trackEvent } from "../_components/telemetry";

type MaintenanceScope = "KR" | "US" | "BOTH";

export default function SettingsPage() {
  const { token, llmProvider, setLlmProvider, setAuthRequired } = useDashboardContext();
  const tokenHint = useMemo(() => (token ? `${"*".repeat(Math.min(token.length, 8))} (${token.length}자)` : "미설정"), [token]);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [maintenanceLog, setMaintenanceLog] = useState("");
  const [maintenanceScope, setMaintenanceScope] = useState<MaintenanceScope>("KR");

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/settings" });
  }, []);

  async function runPlaceholderMaintenance(cleanupOnly: boolean) {
    setMaintenanceRunning(true);
    const scopes = maintenanceScope === "BOTH" ? ["KR", "US"] : [maintenanceScope];
    const res = await apiRequest<{
      scopes: string[];
      cleanupOnly: boolean;
      llmProvider: string | null;
      cleanup: Record<string, { deletedDecisions: number; deletedReports: number }>;
      runs: Array<{ marketScope: string; status: string; errorSummary?: string | null }>;
    }>("/api/agent/maintenance/rebuild-placeholders", {
      token,
      method: "POST",
      body: { scopes, cleanupOnly, llmProvider }
    });
    setMaintenanceRunning(false);
    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      setMaintenanceLog(`실패: ${res.error}`);
      return;
    }
    setMaintenanceLog(JSON.stringify(res.data, null, 2));
  }

  return (
    <div className="dash-grid">
      <section className="card">
        <h3>런타임 설정</h3>
        <p><strong>토큰:</strong> {tokenHint}</p>
        <p>
          <label htmlFor="settings-llm-provider"><strong>LLM 제공자:</strong></label>{" "}
          <select
            id="settings-llm-provider"
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value as "glm" | "openai" | "gemini")}
          >
            <option value="glm">GLM</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </p>
        <p>
          로컬 개발은 기본적으로 무토큰 실행이 가능합니다. 운영 환경에서는 `/api/agent/*` 호출 시
          `x-api-token` 헤더에 `API_TOKEN` 전달이 필요합니다.
        </p>
        <p>
          Stub은 실행 경로에서 허용되지 않으며 `LLM_PROVIDER`는 `glm | openai | gemini` 중 하나여야 합니다.
        </p>
        <p>
          분석 실행은 주기 스케줄 없이 대시보드의 수동 실행 버튼(미국/한국)으로만 진행됩니다.
        </p>
      </section>

      <section className="card">
        <h3>로컬 빠른 명령어</h3>
        <pre className="code-box">
{`npm run db:up
DATABASE_URL=postgres://deepstock:deepstock@127.0.0.1:15432/deepstock npm run db:migrate
npm run dev:local`}
        </pre>
      </section>

      <section className="card">
        <h3>보호 엔드포인트</h3>
        <ul className="plain-list">
          <li>`POST /api/agent/trigger`</li>
          <li>`GET /api/agent/summary`</li>
          <li>`GET /api/agent/status`</li>
          <li>`GET /api/agent/decisions`</li>
          <li>`GET /api/agent/reports`</li>
          <li>`GET /api/agent/signals/raw`</li>
          <li>`GET /api/agent/signals/scored`</li>
          <li>`POST /api/agent/maintenance/rebuild-placeholders`</li>
        </ul>
      </section>

      <section className="card">
        <h3>오류 코드 가이드</h3>
        <ul className="plain-list">
          <li>`unauthorized`: 인증 실패 (운영 환경 토큰 미설정/불일치 등)</li>
          <li>`missing_env`: 필수 env 누락</li>
          <li>`forbidden_env`: 거래 관련 금지 env 감지</li>
          <li>`db_error`: DB 연결/쿼리 문제</li>
          <li>`unknown_error`: 분류되지 않은 오류</li>
        </ul>
      </section>

      <section className="card">
        <h3>Placeholder 정리/재생성</h3>
        <p>
          기존 `stub/tbd/none/없음` 판단 데이터를 정리한 뒤 선택한 LLM으로 지정한 스코프만 재생성합니다.
        </p>
        <p>
          <label htmlFor="settings-maintenance-scope"><strong>대상 스코프:</strong></label>{" "}
          <select
            id="settings-maintenance-scope"
            value={maintenanceScope}
            onChange={(e) => setMaintenanceScope(e.target.value as MaintenanceScope)}
          >
            <option value="KR">KR만</option>
            <option value="US">US만</option>
            <option value="BOTH">KR+US</option>
          </select>
        </p>
        <div className="button-row">
          <button type="button" disabled={maintenanceRunning} onClick={() => void runPlaceholderMaintenance(true)}>
            {maintenanceRunning ? "작업 중..." : "정리만 실행"}
          </button>
          <button type="button" disabled={maintenanceRunning} onClick={() => void runPlaceholderMaintenance(false)}>
            {maintenanceRunning ? "작업 중..." : "정리 + 재생성"}
          </button>
        </div>
        {maintenanceLog ? <pre className="code-box">{maintenanceLog}</pre> : null}
      </section>
    </div>
  );
}
