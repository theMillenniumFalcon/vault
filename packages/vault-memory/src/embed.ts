export type EmbedFn = (text: string) => Promise<number[]>;

export interface EmbedConfig {
  embed?: EmbedFn;
  apiKey?: string;
  embeddingModel?: string;
}

export function createDefaultOpenAIEmbed(
  apiKey: string,
  model = "text-embedding-3-small",
): EmbedFn {
  return async (text: string) => {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI embeddings API error: ${response.status} ${err}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding) {
      throw new Error("Empty embedding response");
    }

    return embedding;
  };
}

export function resolveEmbed(config: EmbedConfig): EmbedFn {
  if (config.embed) return config.embed;
  if (config.apiKey) {
    return createDefaultOpenAIEmbed(config.apiKey, config.embeddingModel);
  }
  throw new Error("vault-memory: config requires embed or apiKey");
}
