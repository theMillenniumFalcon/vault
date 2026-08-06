import type { EmbedConfig } from "./embed";
import type { VaultDb } from "./db/types";
import type { VectorStore } from "./vector-store/types";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMFn = <T>(params: {
  messages: LLMMessage[];
  schema: import("zod").ZodType<T>;
}) => Promise<T>;

export interface LLMConfig {
  llm?: LLMFn;
  apiKey?: string;
  model?: string;
}

export interface MemoryConfig extends LLMConfig, EmbedConfig {
  db: VaultDb;
  vectorStore: VectorStore;
}

export function createDefaultOpenAILLM(
  apiKey: string,
  model = "gpt-4o-mini",
): LLMFn {
  return async ({ messages, schema }) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${err}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty LLM response");
    }

    return schema.parse(JSON.parse(content));
  };
}

export function resolveLLM(config: LLMConfig): LLMFn {
  if (config.llm) return config.llm;
  if (config.apiKey) {
    return createDefaultOpenAILLM(config.apiKey, config.model);
  }
  throw new Error("vault-memory: config requires llm or apiKey");
}
