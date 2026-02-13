import assert from "node:assert";
import { assertNoForbiddenEnv, requireEnv } from "@/config/runtime";

function testForbidden() {
  process.env.ALPACA_API_KEY = "x";
  assert.throws(() => assertNoForbiddenEnv());
  delete process.env.ALPACA_API_KEY;
}

function testMissingEnv() {
  delete process.env.DEEPSTOCK_API_TOKEN;
  assert.throws(() => requireEnv("DEEPSTOCK_API_TOKEN"));
}

function run() {
  testForbidden();
  testMissingEnv();
  console.log("Env checks passed.");
}

run();
