import assert from "node:assert";
import nextConfig from "../../next.config.mjs";

async function run(): Promise<void> {
  assert.ok(typeof nextConfig.headers === "function");
  const rules = await nextConfig.headers?.();
  assert.ok(Array.isArray(rules));
  const globalRule = rules?.find((item) => item.source === "/:path*");
  assert.ok(globalRule);
  const map = new Map((globalRule?.headers ?? []).map((header) => [header.key, header.value]));

  assert.ok(map.get("Content-Security-Policy")?.includes("default-src 'self'"));
  assert.equal(map.get("X-Frame-Options"), "DENY");
  assert.equal(map.get("X-Content-Type-Options"), "nosniff");
  assert.equal(map.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(map.get("Permissions-Policy")?.includes("camera=()"));

  console.log("selftest_headers passed");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
