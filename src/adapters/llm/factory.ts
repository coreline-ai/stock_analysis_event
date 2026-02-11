import { getEnv } from "@/config/runtime";
import type { LLMProvider } from "./provider";
import { createGLMProvider } from "./glm";
import { createOpenAIProvider } from "./openai";
import { createStubProvider } from "./stub";

export function createLLMProviderFromEnv(): LLMProvider {
  const configured = (getEnv("LLM_PROVIDER") || "").toLowerCase();
  const providerName = configured || (process.env.GLM_API_KEY ? "glm" : "openai");

  switch (providerName) {
    case "stub":
      return createStubProvider();
    case "glm":
      return createGLMProvider();
    case "openai":
      return createOpenAIProvider();
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${providerName}`);
  }
}
