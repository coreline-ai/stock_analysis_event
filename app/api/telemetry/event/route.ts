import type { NextRequest } from "next/server";
import { getNumberEnv } from "@/config/runtime";
import { classifyApiError, jsonError, jsonOk } from "@/core/utils/http";
import { assertRateLimit } from "@/security/rate_limit";
import { assertTelemetryContentLength, sanitizeTelemetryEvent } from "@/security/telemetry";

export async function POST(req: NextRequest) {
  try {
    assertRateLimit(req, {
      namespace: "telemetry_event",
      limit: getNumberEnv("TELEMETRY_RATE_LIMIT", 120),
      windowMs: getNumberEnv("TELEMETRY_RATE_WINDOW_MS", 60_000)
    });
    assertTelemetryContentLength(req.headers.get("content-length"));
    const safe = sanitizeTelemetryEvent(await req.json());

    // Internal telemetry stream for GUI flow and basic web-vitals.
    console.info(
      JSON.stringify({
        level: "info",
        scope: "telemetry",
        event: safe
      })
    );

    return jsonOk({ accepted: true });
  } catch (err) {
    const mapped = classifyApiError(err);
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
