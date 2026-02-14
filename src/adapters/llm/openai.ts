import { getEnv, requireEnv } from "@/config/runtime";
import type { LLMProvider, LLMRequest } from "./provider";
import { fetchLlmWithTimeout } from "./http";

export function createOpenAIProvider(): LLMProvider {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const baseUrl = getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
  const temperature = Number(getEnv("OPENAI_TEMPERATURE", "0.2"));

  return {
    name: "openai",
    async complete(req: LLMRequest): Promise<string> {
      const res = await fetchLlmWithTimeout(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: req.model,
          temperature: Number.isFinite(temperature) ? temperature : 0.2,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user }
          ],
          max_tokens: req.maxTokens
        })
      });

      if (!res.ok) {
        throw new Error(`OpenAI error: ${res.status}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI response empty");
      return content;
    }
  };
}
