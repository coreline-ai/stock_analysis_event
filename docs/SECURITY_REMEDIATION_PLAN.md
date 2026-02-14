# Security Remediation Plan

Last updated: 2026-02-14

## Goal
- Close high-impact security gaps in API auth, error exposure, abuse controls, transport/config hardening, and dependency vulnerabilities.
- Keep behavior stable for existing dashboard and pipeline flows.

## Checklist (single source of truth)

- [x] 1. Auth hardening
  - Scope:
    - Default `DEV_AUTH_BYPASS` to `false` (fail closed).
    - Use constant-time token comparison for API token checks.
  - Done when:
    - Local/dev only bypasses auth if explicitly set (`DEV_AUTH_BYPASS=true`).
    - Auth checks are not using plain string equality.
  - Self-test:
    - `npx tsx scripts/security/selftest_auth.ts`

- [x] 2. API error sanitization
  - Scope:
    - Prevent raw internal errors (DB/stack/upstream body) from being returned to clients.
    - Keep machine-readable `code` and proper HTTP status.
  - Done when:
    - Client gets normalized messages by error code.
    - Server retains detailed logs for debugging.
  - Self-test:
    - `npx tsx scripts/security/selftest_http_errors.ts`

- [x] 3. Request abuse controls
  - Scope:
    - Add rate limiting for expensive/sensitive API endpoints.
    - Validate telemetry payload size/shape.
  - Done when:
    - Burst requests to protected endpoints return `429 rate_limited`.
    - Telemetry rejects oversized/invalid payloads.
  - Self-test:
    - `npx tsx scripts/security/selftest_rate_limit.ts`
    - `npx tsx scripts/security/selftest_telemetry.ts`

- [x] 4. LLM adapter hardening
  - Scope:
    - Gemini API key moved from query string to auth header.
    - Upstream provider error bodies are not exposed in thrown client-facing messages.
  - Done when:
    - No query-string API key usage in Gemini adapter.
    - Provider errors are normalized/sanitized.
  - Self-test:
    - `npx tsx scripts/security/selftest_llm_adapters.ts`

- [x] 5. Security headers baseline
  - Scope:
    - Add baseline headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
  - Done when:
    - Header policy is applied globally from Next config.
  - Self-test:
    - `npx tsx scripts/security/selftest_headers.ts`

- [x] 6. Lock token generation hardening
  - Scope:
    - Replace `Math.random()` lock tokens with cryptographically strong random bytes.
  - Done when:
    - Lock handle tokens use `crypto` RNG only.
  - Self-test:
    - `npm run -s test:lock:e2e`

- [x] 7. Dependency vulnerability remediation
  - Scope:
    - Upgrade vulnerable package versions (`next`, `eslint-config-next`, `tsx`) to patched lines.
  - Done when:
    - `npm audit` no longer reports known current high/critical issues from these packages.
  - Self-test:
    - `npm audit --json`

- [x] 8. End-to-end regression verification
  - Scope:
    - Typecheck and test suite validation after all remediations.
  - Done when:
    - Type check + core tests pass in local environment.
  - Self-test:
    - `npx tsc --noEmit`
    - `npm run -s test`

## Verification Log
- 2026-02-14: `npx tsx scripts/security/selftest_auth.ts` passed.
- 2026-02-14: `npx tsx scripts/security/selftest_http_errors.ts` passed.
- 2026-02-14: `npx tsx scripts/security/selftest_rate_limit.ts` passed.
- 2026-02-14: `npx tsx scripts/security/selftest_telemetry.ts` passed.
- 2026-02-14: `npx tsx scripts/security/selftest_llm_adapters.ts` passed.
- 2026-02-14: `npx tsx scripts/security/selftest_headers.ts` passed.
- 2026-02-14: `npx tsx scripts/security/selftest_lock_token.ts` passed.
- 2026-02-14: `set -a; source .env; set +a; npm run -s test:lock:e2e` passed.
- 2026-02-14: `npm audit --json` passed (`high=0, critical=0`).
- 2026-02-14: `set -a; source .env; set +a; npm run -s test` passed.
- 2026-02-14: `npx tsc --noEmit` passed.
- 2026-02-14: `npm run -s lint` passed (warnings only, no errors).
