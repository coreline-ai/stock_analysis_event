import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface TelemetryEvent {
  name: string;
  page?: string;
  value?: number | string | boolean | null;
  meta?: Record<string, unknown>;
  at?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TelemetryEvent;
    const safe = {
      name: body?.name ?? "unknown_event",
      page: body?.page ?? "",
      value: body?.value ?? null,
      meta: body?.meta ?? {},
      at: body?.at ?? new Date().toISOString()
    };

    // Internal telemetry stream for GUI flow and basic web-vitals.
    console.info(
      JSON.stringify({
        level: "info",
        scope: "telemetry",
        event: safe
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
