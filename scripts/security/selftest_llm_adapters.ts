import assert from "node:assert";
import { createGeminiProvider } from "@/adapters/llm/gemini";
import { createOpenAIProvider } from "@/adapters/llm/openai";
import { createGLMProvider } from "@/adapters/llm/glm";

interface FetchCall {
  url: string;
  init?: RequestInit;
}

async function run(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const calls: FetchCall[] = [];

  try {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.GLM_API_KEY = "glm-key";

    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response("internal_upstream_secret", { status: 500 });
    }) as typeof fetch;

    const gemini = createGeminiProvider();
    await assert.rejects(
      gemini.complete({ model: "gemini-2.0-flash", system: "sys", user: "usr", maxTokens: 32 }),
      (err: unknown) => err instanceof Error && err.message === "Gemini error: 500"
    );
    const geminiCall = calls[0];
    assert.ok(geminiCall);
    assert.ok(!geminiCall.url.includes("?key="));
    const geminiHeaders = new Headers(geminiCall.init?.headers);
    assert.equal(geminiHeaders.get("x-goog-api-key"), "gemini-key");

    const openai = createOpenAIProvider();
    await assert.rejects(
      openai.complete({ model: "gpt-4o-mini", system: "sys", user: "usr", maxTokens: 32 }),
      (err: unknown) => err instanceof Error && err.message === "OpenAI error: 500"
    );

    const glm = createGLMProvider();
    await assert.rejects(
      glm.complete({ model: "GLM-4.6", system: "sys", user: "usr", maxTokens: 32 }),
      (err: unknown) => err instanceof Error && err.message === "GLM error: 500"
    );

    console.log("selftest_llm_adapters passed");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
