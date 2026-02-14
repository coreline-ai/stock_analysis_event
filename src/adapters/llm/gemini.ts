import { getEnv, requireEnv } from "@/config/runtime";
import type { LLMProvider, LLMRequest } from "./provider";
import { fetchLlmWithTimeout } from "./http";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function extractContent(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const merged = parts.map((item) => item.text ?? "").join("").trim();
  if (!merged) throw new Error("Gemini response empty");
  return merged;
}

export function createGeminiProvider(): LLMProvider {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const baseUrl = getEnv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta");
  const temperature = Number(getEnv("GEMINI_TEMPERATURE", "0.2"));

  return {
    name: "gemini",
    async complete(req: LLMRequest): Promise<string> {
      const model = req.model || getEnv("GEMINI_MODEL", "gemini-2.0-flash") || "gemini-2.0-flash";
      const endpoint = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetchLlmWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            role: "system",
            parts: [{ text: req.system }]
          },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: {
            temperature: Number.isFinite(temperature) ? temperature : 0.2,
            maxOutputTokens: req.maxTokens
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini error: ${res.status}`);
      }

      const data = (await res.json()) as GeminiResponse;
      return extractContent(data);
    }
  };
}
