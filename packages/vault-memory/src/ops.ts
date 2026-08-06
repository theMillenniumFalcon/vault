import { eq } from "drizzle-orm";
import { claims } from "./db/schema";
import type { VaultDb } from "./db/types";
import { rowToClaim } from "./search";
import type { Claim, ClaimOp, ExtractedFact } from "./types";

function newClaimId(): string {
  return crypto.randomUUID();
}

async function getClaimRow(db: VaultDb, claimId: string) {
  const rows = await db.select().from(claims).where(eq(claims.id, claimId));
  const row = rows[0];
  if (!row) {
    throw new Error(`Claim not found: ${claimId}`);
  }
  return row;
}

export async function applyOp(
  db: VaultDb,
  op: ClaimOp,
  fact: ExtractedFact,
  embedding: number[],
  targetClaimId: string | undefined,
  sourceAgent: string,
  conversationId: string,
): Promise<Claim> {
  const embeddingJson = JSON.stringify(embedding);
  const now = new Date();

  if (op === "NOOP") {
    if (!targetClaimId) {
      throw new Error("NOOP requires targetClaimId");
    }
    return rowToClaim(await getClaimRow(db, targetClaimId));
  }

  if (op === "ADD") {
    const id = newClaimId();
    const values = {
      id,
      entity: fact.entity,
      text: fact.text,
      type: fact.type,
      sourceAgent,
      conversationId,
      confidence: 1,
      status: "active" as const,
      supersedes: null,
      embedding: embeddingJson,
      createdAt: now,
      lastAccessedAt: null,
    };
    await db.insert(claims).values(values);
    return rowToClaim(values);
  }

  if (op === "UPDATE") {
    if (!targetClaimId) {
      throw new Error("UPDATE requires targetClaimId");
    }

    await db
      .update(claims)
      .set({
        entity: fact.entity,
        text: fact.text,
        type: fact.type,
        embedding: embeddingJson,
        lastAccessedAt: now,
      })
      .where(eq(claims.id, targetClaimId));

    return rowToClaim(await getClaimRow(db, targetClaimId));
  }

  if (op === "REPLACE") {
    if (!targetClaimId) {
      throw new Error("REPLACE requires targetClaimId");
    }

    await db
      .update(claims)
      .set({ status: "superseded" })
      .where(eq(claims.id, targetClaimId));

    const id = newClaimId();
    const values = {
      id,
      entity: fact.entity,
      text: fact.text,
      type: fact.type,
      sourceAgent,
      conversationId,
      confidence: 1,
      status: "active" as const,
      supersedes: JSON.stringify([targetClaimId]),
      embedding: embeddingJson,
      createdAt: now,
      lastAccessedAt: null,
    };
    await db.insert(claims).values(values);
    return rowToClaim(values);
  }

  throw new Error(`Unknown op: ${op}`);
}
