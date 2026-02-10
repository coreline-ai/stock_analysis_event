import { requireEnv } from "@/config/runtime";
import type { LLMProvider, LLMRequest } from "./provider";

export function createOpenAIProvider(): LLMProvider {
  const apiKey = requireEnv("OPENAI_API_KEY");

  return {
    name: "openai",
    async complete(req: LLMRequest): Promise<string> {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: req.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user }
          ],
          max_tokens: req.maxTokens
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI error: ${res.status} ${text}`);
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
