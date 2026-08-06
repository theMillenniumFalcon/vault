import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { claims, Memory, type EmbedFn, type LLMFn, type VaultDb } from "vault-memory";

const AGENT_ID = "agent-a";
const CONVERSATION_ID = "regression-session";

const CREATE_CLAIMS_TABLE = `
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
  )
`;

export function createTestDb(): VaultDb {
  const sqlite = new Database(":memory:");
  sqlite.exec(CREATE_CLAIMS_TABLE);
  return drizzle(sqlite) as unknown as VaultDb;
}

export function getSqliteDb(db: VaultDb) {
  return db as unknown as ReturnType<typeof drizzle>;
}

export async function listClaims(db: VaultDb) {
  return getSqliteDb(db).select().from(claims);
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
) {
  await getSqliteDb(db).insert(claims).values({
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
  });
}

export function createMemory(
  db: VaultDb,
  llm: LLMFn,
  embed: EmbedFn = async () => [1, 0, 0],
) {
  return new Memory(AGENT_ID, { db, llm, embed });
}

export async function countActiveClaims(db: VaultDb) {
  const rows = await getSqliteDb(db)
    .select()
    .from(claims)
    .where(eq(claims.status, "active"));
  return rows.length;
}
