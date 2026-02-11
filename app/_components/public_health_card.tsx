"use client";

import { useEffect, useState } from "react";

interface HealthPayload {
  status: string;
  time: string;
}

function statusLabel(status: string): string {
  if (status === "ok") return "정상";
  if (status === "down") return "중단";
  if (status === "unknown") return "미확인";
  return status;
}

export default function PublicHealthCard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("unknown");
  const [time, setTime] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`health_${res.status}`);
        const payload = (await res.json()) as HealthPayload;
        if (cancelled) return;
        setStatus(payload.status);
        setTime(payload.time);
      } catch {
        if (cancelled) return;
        setStatus("down");
        setTime("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card">
      <h3>현재 시스템 상태</h3>
      {loading ? <p>상태 확인 중...</p> : <p>상태: {statusLabel(status)}</p>}
      <p>마지막 응답 시각: {time ? new Date(time).toLocaleString() : "-"}</p>
    </div>
  );
}
