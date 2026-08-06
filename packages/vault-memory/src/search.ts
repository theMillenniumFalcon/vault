import { and, eq, inArray, type SQL } from "drizzle-orm";
import { claims } from "./db/schema";
import type { ClaimRow, VaultDb } from "./db/types";
import type { EmbedFn } from "./embed";
import type { Claim, ScoredClaim, SearchOpts } from "./types";
import type { VectorStore } from "./vector-store/types";
import { parseEmbedding, withActiveFilter } from "./vector-store/utils";

export type { ClaimRow, VaultDb } from "./db/types";
export {
  cosineSimilarity,
  parseEmbedding,
} from "./vector-store/utils";

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

async function hydrateScoredClaims(
  db: VaultDb,
  hits: Array<{ claimId: string; score: number }>,
): Promise<ScoredClaim[]> {
  if (hits.length === 0) return [];

  const ids = hits.map((hit) => hit.claimId);
  const rows = await db
    .select()
    .from(claims)
    .where(inArray(claims.id, ids));
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return hits
    .map((hit) => {
      const row = rowById.get(hit.claimId);
      if (!row) return null;
      return {
        ...rowToClaim(row),
        score: hit.score,
      };
    })
    .filter((claim): claim is ScoredClaim => claim !== null);
}

export async function searchClaims(
  db: VaultDb,
  vectorStore: VectorStore,
  queryEmbedding: number[],
  opts: SearchOpts = {},
): Promise<ScoredClaim[]> {
  const limit = opts.limit ?? 10;
  const filter = withActiveFilter({
    sourceAgent: opts.sourceAgent,
    excludeAgent: opts.excludeAgent,
    entity: opts.entity,
    status: opts.status,
    conversationId: opts.conversationId,
  });

  const hits = await vectorStore.search(queryEmbedding, { limit, filter });
  return hydrateScoredClaims(db, hits);
}

export async function searchOwnClaims(
  db: VaultDb,
  vectorStore: VectorStore,
  sourceAgent: string,
  queryEmbedding: number[],
  limit = 5,
): Promise<ScoredClaim[]> {
  return searchClaims(db, vectorStore, queryEmbedding, { sourceAgent, limit });
}

export async function search(
  db: VaultDb,
  vectorStore: VectorStore,
  embed: EmbedFn,
  query: string,
  opts: SearchOpts = {},
): Promise<ScoredClaim[]> {
  const queryEmbedding = await embed(query);
  return searchClaims(db, vectorStore, queryEmbedding, opts);
}

export async function getClaimRow(db: VaultDb, claimId: string): Promise<ClaimRow> {
  const rows = await db.select().from(claims).where(eq(claims.id, claimId));
  const row = rows[0];
  if (!row) {
    throw new Error(`Claim not found: ${claimId}`);
  }
  return row;
}

export function agentClaimFilter(claimId: string, agentId: string): SQL {
  return and(eq(claims.id, claimId), eq(claims.sourceAgent, agentId))!;
}
