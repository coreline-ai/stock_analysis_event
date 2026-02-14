import assert from "node:assert";
import type { NextRequest } from "next/server";
import { assertRateLimit } from "@/security/rate_limit";

function mockReq(headersInput: Record<string, string>): NextRequest {
  const headers = new Headers();
  for (const [key, value] of Object.entries(headersInput)) {
    headers.set(key, value);
  }
  return { headers } as unknown as NextRequest;
}

function run(): void {
  const namespace = `selftest_rate_limit_${Date.now()}`;
  const req = mockReq({ "x-api-token": "rate-limit-token" });

  assert.doesNotThrow(() =>
    assertRateLimit(req, {
      namespace,
      limit: 2,
      windowMs: 30_000
    })
  );
  assert.doesNotThrow(() =>
    assertRateLimit(req, {
      namespace,
      limit: 2,
      windowMs: 30_000
    })
  );
  assert.throws(
    () =>
      assertRateLimit(req, {
        namespace,
        limit: 2,
        windowMs: 30_000
      }),
    (err: unknown) => err instanceof Error && err.message === "rate_limited"
  );

  console.log("selftest_rate_limit passed");
}

run();
