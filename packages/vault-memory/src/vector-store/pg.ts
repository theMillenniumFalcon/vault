import { sql } from "drizzle-orm";
import type { VaultDb } from "../db/types";
import { loadActiveClaimVectors } from "./rebuild";
import type { VectorFilter, VectorMeta, VectorStore } from "./types";
import { withActiveFilter } from "./utils";

export type PgExecutor = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export type PgVectorStoreOptions = {
  dimensions: number;
  tableName?: string;
};

const DEFAULT_TABLE = "vault_claim_vectors";

export class PgVectorStore implements VectorStore {
  private readonly tableName: string;

  constructor(
    private readonly db: PgExecutor,
    private readonly dimensions: number,
    options: Pick<PgVectorStoreOptions, "tableName"> = {},
  ) {
    this.tableName = options.tableName ?? DEFAULT_TABLE;
  }

  async ensureSchema(): Promise<void> {
    await this.db.execute(
      sql.raw("CREATE EXTENSION IF NOT EXISTS vector"),
    );
    await this.db.execute(
      sql.raw(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          claim_id TEXT PRIMARY KEY,
          embedding vector(${this.dimensions}) NOT NULL,
          source_agent TEXT NOT NULL,
          entity TEXT NOT NULL,
          status TEXT NOT NULL,
          conversation_id TEXT NOT NULL
        )
      `),
    );
    await this.db.execute(
      sql.raw(`
        CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx
        ON ${this.tableName}
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `),
    );
  }

  async upsert(id: string, embedding: number[], meta: VectorMeta): Promise<void> {
    const vectorLiteral = `[${embedding.join(",")}]`;
    await this.db.execute(sql`
      INSERT INTO ${sql.raw(this.tableName)} (
        claim_id,
        embedding,
        source_agent,
        entity,
        status,
        conversation_id
      ) VALUES (
        ${id},
        ${vectorLiteral}::vector,
        ${meta.sourceAgent ?? ""},
        ${meta.entity ?? ""},
        ${meta.status ?? "active"},
        ${meta.conversationId ?? ""}
      )
      ON CONFLICT (claim_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        source_agent = EXCLUDED.source_agent,
        entity = EXCLUDED.entity,
        status = EXCLUDED.status,
        conversation_id = EXCLUDED.conversation_id
    `);
  }

  async remove(id: string): Promise<void> {
    await this.db.execute(
      sql`DELETE FROM ${sql.raw(this.tableName)} WHERE claim_id = ${id}`,
    );
  }

  async search(
    embedding: number[],
    opts: { limit: number; filter?: VectorFilter },
  ): Promise<Array<{ claimId: string; score: number }>> {
    const filter = withActiveFilter(opts.filter);
    const vectorLiteral = `[${embedding.join(",")}]`;
    const conditions = [sql`status = ${filter.status ?? "active"}`];

    if (filter.sourceAgent) {
      conditions.push(sql`source_agent = ${filter.sourceAgent}`);
    }
    if (filter.excludeAgent) {
      conditions.push(sql`source_agent <> ${filter.excludeAgent}`);
    }
    if (filter.entity) {
      conditions.push(sql`entity = ${filter.entity}`);
    }
    if (filter.conversationId) {
      conditions.push(sql`conversation_id = ${filter.conversationId}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);
    const result = await this.db.execute(sql`
      SELECT
        claim_id,
        1 - (embedding <=> ${vectorLiteral}::vector) AS score
      FROM ${sql.raw(this.tableName)}
      WHERE ${whereClause}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${opts.limit}
    `);

    return extractPgRows(result).map((row) => ({
      claimId: String(row.claim_id),
      score: Number(row.score),
    }));
  }

  async rebuild(db: VaultDb): Promise<void> {
    await this.db.execute(sql`DELETE FROM ${sql.raw(this.tableName)}`);
    const loaded = await loadActiveClaimVectors(db);
    for (const item of loaded) {
      await this.upsert(item.id, item.embedding, item.meta);
    }
  }
}

function extractPgRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as Array<Record<string, unknown>>;
  }
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}
