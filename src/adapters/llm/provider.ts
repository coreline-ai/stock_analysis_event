export interface LLMRequest {
  system: string;
  user: string;
  maxTokens: number;
  model: string;
}

export interface LLMProvider {
  name: string;
  complete(req: LLMRequest): Promise<string>;
}
