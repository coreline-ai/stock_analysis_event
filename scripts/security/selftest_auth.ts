import assert from "node:assert";
import type { NextRequest } from "next/server";
import { assertApiAuth, secureTokenEquals } from "@/security/auth";

function mockReq(headersInput: Record<string, string>): NextRequest {
  const headers = new Headers();
  for (const [key, value] of Object.entries(headersInput)) {
    headers.set(key, value);
  }
  return { headers } as unknown as NextRequest;
}

function expectThrowsUnauthorized(fn: () => void): void {
  assert.throws(fn, (err: unknown) => err instanceof Error && err.message === "unauthorized");
}

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function run(): void {
  const snapshot = { ...process.env };
  try {
    setEnv("NODE_ENV", "development");
    setEnv("API_TOKEN", "unit-test-token");
    setEnv("DEEPSTOCK_API_TOKEN", undefined);
    setEnv("DEV_AUTH_BYPASS", undefined);
    setEnv("DEEPSTOCK_DEV_AUTH_BYPASS", undefined);

    expectThrowsUnauthorized(() => assertApiAuth(mockReq({})));
    expectThrowsUnauthorized(() => assertApiAuth(mockReq({ "x-api-token": "wrong-token" })));

    assert.ok(secureTokenEquals("same", "same"));
    assert.ok(!secureTokenEquals("same", "diff"));

    assert.doesNotThrow(() => assertApiAuth(mockReq({ "x-api-token": "unit-test-token" })));
    assert.doesNotThrow(() => assertApiAuth(mockReq({ authorization: "Bearer unit-test-token" })));

    setEnv("DEV_AUTH_BYPASS", "true");
    assert.doesNotThrow(() => assertApiAuth(mockReq({})));

    console.log("selftest_auth passed");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in snapshot)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

run();
