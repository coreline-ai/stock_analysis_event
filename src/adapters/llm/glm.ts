import { getEnv, requireEnv } from "@/config/runtime";
import type { LLMProvider, LLMRequest } from "./provider";
import { fetchLlmWithTimeout } from "./http";

function extractContent(data: {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const merged = content.map((c) => c.text ?? "").join("").trim();
    if (merged) return merged;
  }
  throw new Error("GLM response empty");
}

export function createGLMProvider(): LLMProvider {
  const apiKey = requireEnv("GLM_API_KEY");
  const baseUrl = getEnv("GLM_BASE_URL", "https://api.z.ai/api/coding/paas/v4");
  const temperature = Number(getEnv("GLM_TEMPERATURE", "0"));
  const thinkingType = getEnv("GLM_THINKING_TYPE", "disabled") || "disabled";

  return {
    name: "glm",
    async complete(req: LLMRequest): Promise<string> {
      const model = req.model || getEnv("GLM_MODEL", "GLM-4.6") || "GLM-4.6";
      const res = await fetchLlmWithTimeout(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: Number.isFinite(temperature) ? temperature : 0,
          thinking: { type: thinkingType },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user }
          ],
          max_tokens: req.maxTokens
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GLM error: ${res.status} ${text}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      };
      return extractContent(data);
    }
  };
}
