import { describe, expect, test } from "bun:test";
import { disputes } from "vault-memory/schema";
import { listOpenDisputes } from "vault-memory";
import {
  createTestDb,
  createTestVectorStore,
  getSqliteDb,
  insertClaim,
  listClaims,
} from "./helpers";
import {
  choiceToWinningClaimId,
  formatDisputePrompt,
  reviewOpenDisputes,
} from "../src/review-disputes";
import type { OpenDispute } from "vault-memory";

const dispute: OpenDispute = {
  id: "dispute-1",
  claimAId: "est",
  claimBId: "pst",
  entity: "user.timezone",
  resolutionStrategy: "authority",
  resolvedOp: null,
  createdAt: new Date(),
  resolvedAt: null,
  claimA: {
    id: "est",
    entity: "user.timezone",
    text: "The user is in EST",
    type: "semantic",
    sourceAgent: "agent-b",
    conversationId: "conv-1",
    confidence: 1,
    status: "disputed",
    supersedes: null,
    embedding: null,
    createdAt: new Date(),
    lastAccessedAt: null,
  },
  claimB: {
    id: "pst",
    entity: "user.timezone",
    text: "The user is in PST",
    type: "semantic",
    sourceAgent: "agent-a",
    conversationId: "conv-1",
    confidence: 1,
    status: "active",
    supersedes: null,
    embedding: null,
    createdAt: new Date(),
    lastAccessedAt: null,
  },
};

async function seedTimezoneDispute() {
  const db = createTestDb();
  const vectorStore = createTestVectorStore();
  await insertClaim(
    db,
    {
      id: "pst",
      entity: "user.timezone",
      text: "The user is in PST",
      type: "semantic",
      sourceAgent: "agent-a",
      conversationId: "conv-1",
      embedding: [1, 0, 0],
      status: "active",
    },
    vectorStore,
  );
  await insertClaim(
    db,
    {
      id: "est",
      entity: "user.timezone",
      text: "The user is in EST",
      type: "semantic",
      sourceAgent: "agent-b",
      conversationId: "conv-1",
      embedding: [0, 1, 0],
      status: "disputed",
    },
    vectorStore,
  );
  await getSqliteDb(db).insert(disputes).values({
    id: "dispute-1",
    claimAId: "est",
    claimBId: "pst",
    entity: "user.timezone",
    resolvedOp: null,
    resolutionStrategy: "authority",
    createdAt: new Date(),
    resolvedAt: null,
  });
  return { db, vectorStore };
}

describe("dispute review", () => {
  test("prompt shows the claim in use first", () => {
    const prompt = formatDisputePrompt(dispute);
    expect(prompt).toContain('1. agent-a (in use): "The user is in PST"');
    expect(prompt).toContain('2. agent-b (saved, not used): "The user is in EST"');
    expect(choiceToWinningClaimId(dispute, "1")).toBe("pst");
    expect(choiceToWinningClaimId(dispute, "2")).toBe("est");
    expect(choiceToWinningClaimId(dispute, "")).toBe("skip");
  });

  test("picking 1 keeps the claim already in use", async () => {
    const { db, vectorStore } = await seedTimezoneDispute();
    const lines: string[] = [];

    await reviewOpenDisputes({
      db,
      vectorStore,
      ask: async () => "1",
      log: (line) => lines.push(line),
    });

    const rows = await listClaims(db);
    expect(rows.find((row) => row.id === "pst")?.status).toBe("active");
    expect(rows.find((row) => row.id === "est")?.status).toBe("superseded");
    expect(await listOpenDisputes(db)).toHaveLength(0);
    expect(lines[0]).toContain("Kept");
    expect(lines[0]).toContain("PST");
  });

  test("picking 2 switches search to the saved claim", async () => {
    const { db, vectorStore } = await seedTimezoneDispute();

    await reviewOpenDisputes({
      db,
      vectorStore,
      ask: async () => "2",
    });

    const rows = await listClaims(db);
    expect(rows.find((row) => row.id === "est")?.status).toBe("active");
    expect(rows.find((row) => row.id === "pst")?.status).toBe("superseded");
    const hits = await vectorStore.search([0, 1, 0], {
      limit: 5,
      filter: { status: "active", entity: "user.timezone" },
    });
    expect(hits.map((hit) => hit.claimId)).toContain("est");
    expect(hits.map((hit) => hit.claimId)).not.toContain("pst");
  });

  test("Enter leaves the dispute open", async () => {
    const { db, vectorStore } = await seedTimezoneDispute();
    const lines: string[] = [];

    await reviewOpenDisputes({
      db,
      vectorStore,
      ask: async () => "",
      log: (line) => lines.push(line),
    });

    expect(await listOpenDisputes(db)).toHaveLength(1);
    expect(lines).toEqual(["Left open."]);
  });
});
