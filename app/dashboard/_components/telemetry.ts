"use client";

interface TelemetryEvent {
  name: string;
  page?: string;
  value?: number | string | boolean | null;
  meta?: Record<string, unknown>;
}

export async function trackEvent(event: TelemetryEvent): Promise<void> {
  try {
    await fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...event,
        at: new Date().toISOString()
      }),
      keepalive: true
    });
  } catch {
    // best-effort telemetry only
  }
}
