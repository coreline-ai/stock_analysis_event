import assert from "node:assert";
import { assertTelemetryContentLength, sanitizeTelemetryEvent } from "@/security/telemetry";

function run(): void {
  assert.doesNotThrow(() => assertTelemetryContentLength("1200"));
  assert.throws(
    () => assertTelemetryContentLength(String(1024 * 20)),
    (err: unknown) => err instanceof Error && err.message === "invalid_request"
  );

  const sanitized = sanitizeTelemetryEvent({
    name: "dashboard_open",
    page: "/dashboard/reports",
    value: "ok",
    at: "",
    meta: {
      confidence: 0.73,
      source: "ui",
      large_text: "x".repeat(500),
      unknown_object: { bad: "value" }
    }
  });
  assert.equal(sanitized.name, "dashboard_open");
  assert.equal(sanitized.page, "/dashboard/reports");
  assert.equal(sanitized.value, "ok");
  assert.equal(sanitized.meta.confidence, 0.73);
  assert.equal(sanitized.meta.source, "ui");
  assert.equal(typeof sanitized.meta.large_text, "string");
  assert.equal((sanitized.meta.large_text as string).length, 180);
  assert.equal(sanitized.meta.unknown_object, null);
  assert.ok(sanitized.at.length > 0);

  assert.throws(
    () => sanitizeTelemetryEvent({ page: "/dashboard" }),
    (err: unknown) => err instanceof Error && err.message === "invalid_request"
  );

  console.log("selftest_telemetry passed");
}

run();
