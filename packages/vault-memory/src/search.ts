import { and, eq, type SQL } from "drizzle-orm";
import { claims } from "./db/schema";
import type { EmbedFn } from "./embed";
import type { Claim, ScoredClaim, SearchOpts } from "./types";

export type ClaimRow = typeof claims.$inferSelect;

export type VaultDb = {
  select(): {
    from(table: typeof claims): {
      where(condition: SQL): Promise<ClaimRow[]>;
    };
  };
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function rowToClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    entity: row.entity,
    text: row.text,
    type: row.type,
    sourceAgent: row.sourceAgent,
    conversationId: row.conversationId,
    confidence: row.confidence,
    status: row.status,
    supersedes: row.supersedes,
    embedding: row.embedding,
    createdAt: row.createdAt,
    lastAccessedAt: row.lastAccessedAt,
  };
}

export async function bruteForceSearch(
  db: VaultDb,
  queryEmbedding: number[],
  opts: {
    limit?: number;
    sourceAgent?: string;
    conversationId?: string;
  } = {},
): Promise<ScoredClaim[]> {
  const limit = opts.limit ?? 10;
  const conditions: SQL[] = [eq(claims.status, "active")];

  if (opts.sourceAgent) {
    conditions.push(eq(claims.sourceAgent, opts.sourceAgent));
  }
  if (opts.conversationId) {
    conditions.push(eq(claims.conversationId, opts.conversationId));
  }

  const whereClause =
    conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const rows = await db.select().from(claims).where(whereClause);

  return rows
    .map((row) => {
      const embedding = parseEmbedding(row.embedding);
      if (!embedding) return null;

      return {
        ...rowToClaim(row),
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((claim): claim is ScoredClaim => claim !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchOwnClaims(
  db: VaultDb,
  sourceAgent: string,
  queryEmbedding: number[],
  limit = 5,
): Promise<ScoredClaim[]> {
  return bruteForceSearch(db, queryEmbedding, { sourceAgent, limit });
}

export async function search(
  db: VaultDb,
  embed: EmbedFn,
  query: string,
  opts: SearchOpts = {},
): Promise<ScoredClaim[]> {
  const queryEmbedding = await embed(query);
  return bruteForceSearch(db, queryEmbedding, opts);
}
