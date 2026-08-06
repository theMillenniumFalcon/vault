import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { VaultDb } from "vault-memory";

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS claims (
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

  CREATE TABLE IF NOT EXISTS agent_authority (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    weight REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    claim_a_id TEXT NOT NULL,
    claim_b_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    resolved_op TEXT,
    resolution_strategy TEXT,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
`;

export function createDb(path = ":memory:"): VaultDb {
  const sqlite = new Database(path);
  sqlite.exec(CREATE_TABLES);
  return drizzle(sqlite) as unknown as VaultDb;
}

export function getDrizzleDb(db: VaultDb) {
  return db as unknown as ReturnType<typeof drizzle>;
}
