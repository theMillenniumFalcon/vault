import {
  EXAMPLE_AUTHORITY_SEED,
  Memory,
  resolveEmbed,
  resolveVectorStore,
  search as searchAllClaims,
  seedAuthority,
  type EmbedFn,
  type MemoryConfig,
  type ScoredClaim,
  type SearchOpts,
  type VaultDb,
  type VectorStore,
} from "vault-memory";
import { agentAuthority } from "vault-memory/schema";
import { getDrizzleDb } from "./db";

/** Default cross-agent resolution for the shared-store demo. */
export const SHARED_ENTITY_STRATEGIES: MemoryConfig["entityStrategies"] = {
  "user.timezone": "authority",
  "user.mood": "authority",
};

export type AgentMemoryOptions = Omit<MemoryConfig, "db">;

export function createAgentMemory(
  agentId: string,
  db: VaultDb,
  config: AgentMemoryOptions,
): {
  memory: Memory;
  vectorStore: VectorStore;
  embed: EmbedFn;
} {
  const vectorStore = resolveVectorStore({ ...config, db });
  const embed = resolveEmbed(config);
  const memory = new Memory(agentId, {
    ...config,
    db,
    vectorStore,
    entityStrategies: {
      ...SHARED_ENTITY_STRATEGIES,
      ...config.entityStrategies,
    },
  });
  return { memory, vectorStore, embed };
}

/** Seed authority rows once when the shared store is first used. */
export async function bootstrapSharedStore(db: VaultDb): Promise<void> {
  const existing = await getDrizzleDb(db)
    .select()
    .from(agentAuthority)
    .limit(1);
  if (existing.length > 0) return;
  await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);
}

export async function syncVectorIndex(
  vectorStore: VectorStore,
  db: VaultDb,
): Promise<void> {
  await vectorStore.rebuild(db);
}

/** Search across all agents in the shared store (no sourceAgent filter). */
export async function searchSharedStore(
  db: VaultDb,
  vectorStore: VectorStore,
  embed: EmbedFn,
  query: string,
  opts: SearchOpts = {},
): Promise<ScoredClaim[]> {
  return searchAllClaims(db, vectorStore, embed, query, {
    status: "active",
    limit: 10,
    ...opts,
  });
}
