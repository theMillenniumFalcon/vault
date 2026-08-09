import type { LLMFn, MemoryConfig } from "../../src/config";
import type { EmbedFn } from "../../src/embed";
import { Memory } from "../../src/memory";
import type { ExtractedFact } from "../../src/types";
import type { VectorStore } from "../../src/vector-store/types";
import type { VaultDb } from "../../src/db/types";

export const EMBED_DIM = 3;

/** Deterministic 3-d embeddings keyed by entity / timezone keywords. */
export function createHarnessEmbed(): EmbedFn {
  return async (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("pst") || lower.includes("pacific")) {
      return [1, 0.05, 0];
    }
    if (lower.includes("est") || lower.includes("eastern")) {
      return [0.05, 1, 0];
    }
    if (lower.includes("mood") || lower.includes("happy") || lower.includes("sad")) {
      return [0, 0.2, 1];
    }
    if (lower.includes("timezone") || lower.includes("time zone")) {
      return [0.7, 0.7, 0];
    }
    return [0.5, 0.5, 0.5];
  };
}

export function createScriptedLlm(facts: ExtractedFact[]): LLMFn {
  let call = 0;
  return async ({ schema }) => {
    call += 1;
    if (call === 1) {
      return schema.parse({ facts });
    }
    return schema.parse({ op: "ADD" });
  };
}

export function createAgentMemory(
  agentId: string,
  db: VaultDb,
  vectorStore: VectorStore,
  facts: ExtractedFact[],
  overrides: Partial<MemoryConfig> = {},
): Memory {
  return new Memory(agentId, {
    db,
    vectorStore,
    llm: createScriptedLlm(facts),
    embed: createHarnessEmbed(),
    ...overrides,
  });
}
