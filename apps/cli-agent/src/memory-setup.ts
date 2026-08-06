import {
  Memory,
  MemoryVectorStore,
  type EmbedFn,
  type LLMFn,
  type MemoryConfig,
  type VaultDb,
} from "vault-memory";

export type AgentMemoryOptions = Omit<MemoryConfig, "db" | "vectorStore">;

export function createAgentMemory(
  agentId: string,
  db: VaultDb,
  config: AgentMemoryOptions,
): { memory: Memory; vectorStore: MemoryVectorStore } {
  const vectorStore = new MemoryVectorStore();
  const memory = new Memory(agentId, {
    db,
    vectorStore,
    ...config,
  });
  return { memory, vectorStore };
}

export async function syncVectorIndex(
  vectorStore: MemoryVectorStore,
  db: VaultDb,
): Promise<void> {
  await vectorStore.rebuild(db);
}
