import { eq } from "drizzle-orm";
import { claims } from "../db/schema";
import type { VaultDb } from "../db/types";
import type { VectorMeta } from "./types";
import { claimRowToVectorMeta, parseEmbedding } from "./utils";

export type LoadedClaimVector = {
  id: string;
  embedding: number[];
  meta: VectorMeta;
};

export async function loadActiveClaimVectors(
  db: VaultDb,
): Promise<LoadedClaimVector[]> {
  const rows = await db.select().from(claims).where(eq(claims.status, "active"));
  const results: LoadedClaimVector[] = [];

  for (const row of rows) {
    const embedding = parseEmbedding(row.embedding);
    if (!embedding) continue;
    results.push({
      id: row.id,
      embedding,
      meta: claimRowToVectorMeta(row),
    });
  }

  return results;
}
