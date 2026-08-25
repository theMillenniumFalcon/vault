import { eq } from "drizzle-orm";
import { claims, disputes } from "./db/schema";
import type { DisputeInsert, VaultDb } from "./db/types";
import { getClaimRow, rowToClaim } from "./search";
import type {
  Claim,
  ClaimOp,
  CrossAgentClassifyResult,
  ExtractedFact,
} from "./types";
import type { VectorStore } from "./vector-store/types";
import { claimRowToVectorMeta } from "./vector-store/utils";

function newClaimId(): string {
  return crypto.randomUUID();
}

async function indexActiveClaim(
  vectorStore: VectorStore,
  claim: Claim,
  embedding: number[],
): Promise<void> {
  if (claim.status !== "active") {
    await vectorStore.remove(claim.id);
    return;
  }

  await vectorStore.upsert(claim.id, embedding, {
    claimId: claim.id,
    sourceAgent: claim.sourceAgent,
    entity: claim.entity,
    status: claim.status,
    conversationId: claim.conversationId,
  });
}

export async function applyOp(
  db: VaultDb,
  vectorStore: VectorStore,
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
    const claim = rowToClaim(values);
    await indexActiveClaim(vectorStore, claim, embedding);
    return claim;
  }

  if (op === "UPDATE") {
    if (!targetClaimId) {
      throw new Error("UPDATE requires targetClaimId");
    }

    const existing = await getClaimRow(db, targetClaimId);

    await db
      .update(claims)
      .set({
        // Keep the incumbent entity when merging — extractor labels can drift.
        entity: existing.entity,
        text: fact.text,
        type: fact.type,
        embedding: embeddingJson,
        lastAccessedAt: now,
      })
      .where(eq(claims.id, targetClaimId));

    const claim = rowToClaim(await getClaimRow(db, targetClaimId));
    await indexActiveClaim(vectorStore, claim, embedding);
    return claim;
  }

  if (op === "REPLACE") {
    if (!targetClaimId) {
      throw new Error("REPLACE requires targetClaimId");
    }

    await db
      .update(claims)
      .set({ status: "superseded" })
      .where(eq(claims.id, targetClaimId));
    await vectorStore.remove(targetClaimId);

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
    const claim = rowToClaim(values);
    await indexActiveClaim(vectorStore, claim, embedding);
    return claim;
  }

  throw new Error(`Unknown op: ${op}`);
}

async function supersedeClaims(
  db: VaultDb,
  vectorStore: VectorStore,
  claimIds: string[],
): Promise<void> {
  for (const claimId of claimIds) {
    await db
      .update(claims)
      .set({ status: "superseded" })
      .where(eq(claims.id, claimId));
    await vectorStore.remove(claimId);
  }
}

export async function applyCrossAgentResolution(
  db: VaultDb,
  vectorStore: VectorStore,
  resolution: CrossAgentClassifyResult,
  fact: ExtractedFact,
  embedding: number[],
  sourceAgent: string,
  conversationId: string,
): Promise<Claim> {
  if (resolution.op === "ADD") {
    return applyOp(
      db,
      vectorStore,
      "ADD",
      fact,
      embedding,
      undefined,
      sourceAgent,
      conversationId,
    );
  }

  if (resolution.op === "REPLACE") {
    await supersedeClaims(db, vectorStore, resolution.supersedes);
    return applyOp(
      db,
      vectorStore,
      "ADD",
      fact,
      embedding,
      undefined,
      sourceAgent,
      conversationId,
    );
  }

  const embeddingJson = JSON.stringify(embedding);
  const now = new Date();
  const claimId = newClaimId();
  const values = {
    id: claimId,
    entity: fact.entity,
    text: fact.text,
    type: fact.type,
    sourceAgent,
    conversationId,
    confidence: 1,
    status: "disputed" as const,
    supersedes: null,
    embedding: embeddingJson,
    createdAt: now,
    lastAccessedAt: null,
  };

  // Loser is stored as disputed and not indexed. The existing claim stays
  // active/searchable so higher-authority memory remains the answer until
  // an explicit resolution updates the dispute row.
  await db.insert(claims).values(values);

  const dispute: DisputeInsert = {
    id: crypto.randomUUID(),
    claimAId: claimId,
    claimBId: resolution.conflictingClaimId,
    entity: fact.entity,
    resolvedOp: null,
    resolutionStrategy: "authority",
    createdAt: now,
    resolvedAt: null,
  };
  await db.insert(disputes).values(dispute);

  return rowToClaim(values);
}

export async function syncClaimVectorFromRow(
  vectorStore: VectorStore,
  row: Awaited<ReturnType<typeof getClaimRow>>,
): Promise<void> {
  const embedding = row.embedding ? JSON.parse(row.embedding) as number[] : null;
  if (!embedding || row.status !== "active") {
    await vectorStore.remove(row.id);
    return;
  }

  await vectorStore.upsert(row.id, embedding, claimRowToVectorMeta(row));
}
