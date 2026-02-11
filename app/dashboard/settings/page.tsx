"use client";

import { useEffect, useMemo } from "react";
import { useDashboardContext } from "../_components/dashboard_context";
import { trackEvent } from "../_components/telemetry";

export default function SettingsPage() {
  const { token } = useDashboardContext();
  const tokenHint = useMemo(() => (token ? `${"*".repeat(Math.min(token.length, 8))} (${token.length}자)` : "미설정"), [token]);

  useEffect(() => {
    void trackEvent({ name: "page_view", page: "/dashboard/settings" });
  }, []);

  return (
    <div className="dash-grid">
      <section className="card">
        <h3>런타임 설정</h3>
        <p><strong>토큰:</strong> {tokenHint}</p>
        <p>
          로컬 개발은 기본적으로 무토큰 실행이 가능합니다. 운영 환경에서는 `/api/agent/*` 호출 시
          `x-api-token` 헤더에 `API_TOKEN` 전달이 필요합니다.
        </p>
      </section>

      <section className="card">
        <h3>로컬 빠른 명령어</h3>
        <pre className="code-box">
{`npm run db:up
DATABASE_URL=postgres://mahoraga:mahoraga@127.0.0.1:15432/mahoraga npm run db:migrate
npm run dev:active`}
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
    </div>
  );
}
