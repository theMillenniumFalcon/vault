import { and, eq, isNull } from "drizzle-orm";
import { claims, disputes } from "./db/schema";
import type { DisputeRow, VaultDb } from "./db/types";
import { syncClaimVectorFromRow } from "./ops";
import { getClaimRow, rowToClaim } from "./search";
import type { Claim } from "./types";
import type { VectorStore } from "./vector-store/types";

export type Dispute = {
  id: string;
  claimAId: string;
  claimBId: string;
  entity: string;
  resolutionStrategy: string | null;
  resolvedOp: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type OpenDispute = Dispute & {
  claimA: Claim;
  claimB: Claim;
};

export type ResolvedDispute = {
  dispute: Dispute;
  winner: Claim;
  loser: Claim;
};

function rowToDispute(row: DisputeRow): Dispute {
  return {
    id: row.id,
    claimAId: row.claimAId,
    claimBId: row.claimBId,
    entity: row.entity,
    resolutionStrategy: row.resolutionStrategy ?? null,
    resolvedOp: row.resolvedOp ?? null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

async function getDisputeRow(db: VaultDb, disputeId: string) {
  const rows = await db
    .select()
    .from(disputes)
    .where(eq(disputes.id, disputeId));
  return rows[0] ?? null;
}

export async function listOpenDisputes(
  db: VaultDb,
  opts: { entity?: string } = {},
): Promise<OpenDispute[]> {
  const rows = opts.entity
    ? await db
        .select()
        .from(disputes)
        .where(
          and(isNull(disputes.resolvedAt), eq(disputes.entity, opts.entity))!,
        )
    : await db
        .select()
        .from(disputes)
        .where(isNull(disputes.resolvedAt));

  const openDisputes: OpenDispute[] = [];
  for (const row of rows) {
    const claimA = rowToClaim(await getClaimRow(db, row.claimAId));
    const claimB = rowToClaim(await getClaimRow(db, row.claimBId));
    openDisputes.push({
      ...rowToDispute(row),
      claimA,
      claimB,
    });
  }

  return openDisputes;
}

/**
 * Resolve an open dispute by promoting the chosen claim to active and
 * superseding the other. Consumers pick the winner (human, app policy, etc.).
 */
export async function resolveDispute(
  db: VaultDb,
  vectorStore: VectorStore,
  disputeId: string,
  winningClaimId: string,
): Promise<ResolvedDispute> {
  const disputeRow = await getDisputeRow(db, disputeId);
  if (!disputeRow) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }
  if (disputeRow.resolvedAt !== null) {
    throw new Error(`Dispute already resolved: ${disputeId}`);
  }

  if (
    winningClaimId !== disputeRow.claimAId &&
    winningClaimId !== disputeRow.claimBId
  ) {
    throw new Error(
      `winningClaimId must be claim_a or claim_b of dispute ${disputeId}`,
    );
  }

  const loserId =
    winningClaimId === disputeRow.claimAId
      ? disputeRow.claimBId
      : disputeRow.claimAId;

  const now = new Date();

  await db
    .update(claims)
    .set({
      status: "active",
      supersedes: JSON.stringify([loserId]),
      lastAccessedAt: now,
    })
    .where(eq(claims.id, winningClaimId));

  await db
    .update(claims)
    .set({ status: "superseded" })
    .where(eq(claims.id, loserId));
  await vectorStore.remove(loserId);

  const winnerRow = await getClaimRow(db, winningClaimId);
  await syncClaimVectorFromRow(vectorStore, winnerRow);

  await db
    .update(disputes)
    .set({
      resolvedOp: winningClaimId,
      resolvedAt: now,
    })
    .where(eq(disputes.id, disputeId));

  const updatedDispute = await getDisputeRow(db, disputeId);
  if (!updatedDispute) {
    throw new Error(`Dispute not found after resolution: ${disputeId}`);
  }

  return {
    dispute: rowToDispute(updatedDispute),
    winner: rowToClaim(winnerRow),
    loser: rowToClaim(await getClaimRow(db, loserId)),
  };
}
