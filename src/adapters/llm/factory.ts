import { getEnv } from "@/config/runtime";
import type { LLMProvider, LLMProviderName } from "./provider";
import { createGLMProvider } from "./glm";
import { createOpenAIProvider } from "./openai";
import { createGeminiProvider } from "./gemini";

const ALL_PROVIDER_NAMES: LLMProviderName[] = ["glm", "openai", "gemini"];

function parseProviderName(input: unknown): LLMProviderName | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase() as LLMProviderName;
  return ALL_PROVIDER_NAMES.includes(normalized) ? normalized : null;
}

export function getAllowedDashboardProviderNames(): Array<Extract<LLMProviderName, "glm" | "openai" | "gemini">> {
  return ["glm", "openai", "gemini"];
}

export function createLLMProviderFromEnv(providerOverride?: LLMProviderName | null): LLMProvider {
  const configured = parseProviderName(providerOverride) ?? parseProviderName(getEnv("LLM_PROVIDER"));
  const providerName = configured ?? (process.env.GLM_API_KEY ? "glm" : process.env.OPENAI_API_KEY ? "openai" : null);

  if (!providerName || !ALL_PROVIDER_NAMES.includes(providerName)) {
    throw new Error("Missing required env: LLM_PROVIDER(glm|openai|gemini)");
  }

  switch (providerName) {
    case "glm":
      return createGLMProvider();
    case "openai":
      return createOpenAIProvider();
    case "gemini":
      return createGeminiProvider();
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${providerName}`);
  }
}
