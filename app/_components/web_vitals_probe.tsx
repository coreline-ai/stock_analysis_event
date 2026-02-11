"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";

function send(event: Record<string, unknown>) {
  void fetch("/api/telemetry/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "web_vital",
      page: typeof window !== "undefined" ? window.location.pathname : "",
      meta: event,
      at: new Date().toISOString()
    }),
    keepalive: true
  });
}

export default function WebVitalsProbe() {
  useReportWebVitals((metric) => {
    send({
      id: metric.id,
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType
    });
  });

  useEffect(() => {
    const start = performance.now();
    requestAnimationFrame(() => {
      const firstPaintReadyMs = Math.round(performance.now() - start);
      send({
        metric: "FIRST_PAINT_READY_MS",
        value: firstPaintReadyMs
      });
    });
  }, []);

  return null;
}
