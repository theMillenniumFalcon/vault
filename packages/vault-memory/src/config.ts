import type { EmbedConfig } from "./embed";
import type { VaultDb } from "./db/types";
import type { EntityResolverFn } from "./resolve-entity";
import type { ResolutionStrategy } from "./resolve";
import { createDefaultVectorStore } from "./vector-store/create";
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
  /** Defaults to {@link createDefaultVectorStore} (FAISS). */
  vectorStore?: VectorStore;
  /** Embedding dimensions for the default FAISS index. Default: 1536. */
  vectorDimensions?: number;
  entityStrategies?: Partial<Record<string, ResolutionStrategy>>;
  /**
   * Cosine similarity threshold (0–1) to align a new fact's entity with an
   * existing active claim. Set to 0 to disable. Default: 0.85.
   */
  entityMatchThreshold?: number;
  /**
   * Minimum similarity (0–1) for borderline LLM entity disambiguation.
   * Scores between this and {@link entityMatchThreshold} may call the LLM.
   * Default: 0.70.
   */
  entityDisambiguationThreshold?: number;
  /**
   * When false, skip LLM disambiguation in the borderline band (keep extracted entity).
   * Default: true when llm/apiKey is configured.
   */
  entityResolutionUseLlm?: boolean;
  /** Override entity resolution (default: similarity-based {@link resolveEntity}). */
  resolveEntity?: EntityResolverFn;
  /**
   * Enable canonical entity registry: constrained extraction, key validation,
   * and optional auto-registration of new keys.
   */
  useEntityRegistry?: boolean;
  /**
   * When true (default), new keys that pass {@link entityKeyPattern} are
   * inserted into the registry on first use.
   */
  entityRegistryAutoRegister?: boolean;
  /** Regex source for new entity keys. Default: `user.<domain>` dotted paths. */
  entityKeyPattern?: string;
}

export type ResolvedMemoryConfig = MemoryConfig & { vectorStore: VectorStore };

export function resolveVectorStore(config: MemoryConfig): VectorStore {
  if (config.vectorStore) return config.vectorStore;
  return createDefaultVectorStore({ dimensions: config.vectorDimensions });
}

export function resolveMemoryConfig(config: MemoryConfig): ResolvedMemoryConfig {
  return {
    ...config,
    vectorStore: resolveVectorStore(config),
  };
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
