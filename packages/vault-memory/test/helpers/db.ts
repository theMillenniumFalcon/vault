import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { agentAuthority, claims, disputes } from "../../src/db/schema";
import type { VaultDb } from "../../src/db/types";
import type { AuthoritySeed } from "../../src/resolve";
import { FaissVectorStore } from "../../src/vector-store/faiss";
import type { VectorStore } from "../../src/vector-store/types";
import { claimRowToVectorMeta } from "../../src/vector-store/utils";
import { createPureJsFaiss } from "./pure-js-faiss";

export const TEST_EMBEDDING_DIMENSIONS = 3;

export function createTestDb(): VaultDb {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE claims (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      source_agent TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'active',
      supersedes TEXT,
      embedding TEXT,
      created_at INTEGER NOT NULL,
      last_accessed_at INTEGER
    );

    CREATE TABLE agent_authority (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      weight REAL NOT NULL
    );

    CREATE TABLE disputes (
      id TEXT PRIMARY KEY,
      claim_a_id TEXT NOT NULL,
      claim_b_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      resolved_op TEXT,
      resolution_strategy TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    )
  `);

  return drizzle(sqlite) as unknown as VaultDb;
}

export function createTestVectorStore(): FaissVectorStore {
  return new FaissVectorStore({
    dimensions: TEST_EMBEDDING_DIMENSIONS,
    faiss: createPureJsFaiss(),
  });
}

export function getSqliteDb(db: VaultDb) {
  return db as unknown as ReturnType<typeof drizzle>;
}

export async function insertClaim(
  db: VaultDb,
  claim: {
    id: string;
    entity: string;
    text: string;
    type: "semantic" | "episodic";
    sourceAgent: string;
    conversationId: string;
    embedding: number[];
    status?: "active" | "superseded" | "disputed";
  },
  vectorStore?: VectorStore,
) {
  const values = {
    id: claim.id,
    entity: claim.entity,
    text: claim.text,
    type: claim.type,
    sourceAgent: claim.sourceAgent,
    conversationId: claim.conversationId,
    confidence: 1,
    status: claim.status ?? "active",
    supersedes: null,
    embedding: JSON.stringify(claim.embedding),
    createdAt: new Date(),
    lastAccessedAt: null,
  };

  await getSqliteDb(db).insert(claims).values(values);

  if (vectorStore && values.status === "active") {
    await vectorStore.upsert(claim.id, claim.embedding, {
      ...claimRowToVectorMeta(values),
      claimId: claim.id,
    });
  }
}

export async function listClaims(db: VaultDb) {
  return getSqliteDb(db).select().from(claims);
}

export async function insertAuthority(db: VaultDb, seeds: AuthoritySeed[]) {
  for (const seed of seeds) {
    await getSqliteDb(db).insert(agentAuthority).values({
      id: crypto.randomUUID(),
      entity: seed.entity,
      agentId: seed.agentId,
      weight: seed.weight,
    });
  }
}

export async function listDisputes(db: VaultDb) {
  return getSqliteDb(db).select().from(disputes);
}
