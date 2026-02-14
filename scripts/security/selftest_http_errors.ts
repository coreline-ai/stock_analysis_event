import assert from "node:assert";
import { classifyApiError, jsonError } from "@/core/utils/http";

async function run(): Promise<void> {
  const unauthorized = classifyApiError(new Error("unauthorized"));
  assert.equal(unauthorized.code, "unauthorized");
  assert.equal(unauthorized.status, 401);

  const invalid = classifyApiError(new Error("invalid_target_symbol"));
  assert.equal(invalid.code, "invalid_request");
  assert.equal(invalid.status, 400);

  const limited = classifyApiError(new Error("rate_limited"));
  assert.equal(limited.code, "rate_limited");
  assert.equal(limited.status, 429);

  const dbError = classifyApiError(new Error("postgres connection timeout"));
  assert.equal(dbError.code, "db_error");

  const genericMissing = jsonError("Missing required env: DATABASE_URL", 500, "missing_env");
  const genericMissingBody = (await genericMissing.json()) as { error: string; code: string };
  assert.equal(genericMissingBody.error, "missing_env");
  assert.equal(genericMissingBody.code, "missing_env");

  const dartMissing = jsonError("Missing required env: DART_API_KEY", 500, "missing_env");
  const dartMissingBody = (await dartMissing.json()) as { error: string; code: string };
  assert.equal(dartMissingBody.error, "missing_env:DART_API_KEY");
  assert.equal(dartMissingBody.code, "missing_env");

  const dbPublic = jsonError("database password leaked", 500, "db_error");
  const dbPublicBody = (await dbPublic.json()) as { error: string; code: string };
  assert.equal(dbPublicBody.error, "db_error");
  assert.equal(dbPublicBody.code, "db_error");

  console.log("selftest_http_errors passed");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
