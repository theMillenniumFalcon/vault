import { describe, expect, test } from "bun:test";
import { listOpenDisputes, resolveDispute } from "../src/disputes";
import { search } from "../src/search";
import {
  createAgentMemory,
  createHarnessEmbed,
} from "./helpers/conflict-harness";
import {
  createTestDb,
  createTestVectorStore,
  insertAuthority,
  listClaims,
  listDisputes,
} from "./helpers/db";

const timezoneFacts = {
  pst: {
    entity: "user.timezone",
    text: "The user is in PST",
    type: "semantic" as const,
  },
  est: {
    entity: "user.timezone",
    text: "The user is in EST",
    type: "semantic" as const,
  },
};

function createTimezoneAgents(
  db: ReturnType<typeof createTestDb>,
  vectorStore: ReturnType<typeof createTestVectorStore>,
) {
  return {
    agentA: createAgentMemory("agent-a", db, vectorStore, [timezoneFacts.pst], {
      entityStrategies: { "user.timezone": "authority" },
    }),
    agentB: createAgentMemory("agent-b", db, vectorStore, [timezoneFacts.est], {
      entityStrategies: { "user.timezone": "authority" },
    }),
  };
}

describe("disputes", () => {
  test("listOpenDisputes returns unresolved disputes with both claims", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertAuthority(db, [
      { entity: "user.timezone", agentId: "agent-a", weight: 0.5 },
      { entity: "user.timezone", agentId: "agent-b", weight: 0.5 },
    ]);

    const { agentA, agentB } = createTimezoneAgents(db, vectorStore);

    await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
    await agentB.add([{ role: "user", content: "I'm in EST" }], "conv1");

    const open = await listOpenDisputes(db);
    expect(open).toHaveLength(1);
    expect(open[0]?.entity).toBe("user.timezone");
    expect(open[0]?.claimA.status).toBe("disputed");
    expect(open[0]?.claimB.status).toBe("active");
    expect(open[0]?.resolvedAt).toBeNull();
  });

  test("resolveDispute promotes challenger and supersedes incumbent", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertAuthority(db, [
      { entity: "user.timezone", agentId: "agent-a", weight: 0.5 },
      { entity: "user.timezone", agentId: "agent-b", weight: 0.5 },
    ]);

    const { agentA, agentB } = createTimezoneAgents(db, vectorStore);

    await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
    const { added } = await agentB.add(
      [{ role: "user", content: "I'm in EST" }],
      "conv1",
    );

    const dispute = (await listDisputes(db))[0]!;
    const challengerId = added[0]!.id;

    const result = await resolveDispute(
      db,
      vectorStore,
      dispute.id,
      challengerId,
    );

    expect(result.winner.id).toBe(challengerId);
    expect(result.winner.status).toBe("active");
    expect(result.loser.status).toBe("superseded");
    expect(result.dispute.resolvedOp).toBe(challengerId);
    expect(result.dispute.resolvedAt).not.toBeNull();

    const rows = await listClaims(db);
    expect(rows.find((row) => row.id === challengerId)?.status).toBe("active");
    expect(rows.find((row) => row.sourceAgent === "agent-a")?.status).toBe(
      "superseded",
    );

    const active = await search(
      db,
      vectorStore,
      createHarnessEmbed(),
      "what timezone is the user in?",
      { status: "active", limit: 5 },
    );
    expect(active[0]?.sourceAgent).toBe("agent-b");
    expect(active[0]?.text).toContain("EST");
  });

  test("resolveDispute can keep incumbent as winner", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertAuthority(db, [
      { entity: "user.timezone", agentId: "agent-a", weight: 0.5 },
      { entity: "user.timezone", agentId: "agent-b", weight: 0.5 },
    ]);

    const { agentA, agentB } = createTimezoneAgents(db, vectorStore);

    await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
    await agentB.add([{ role: "user", content: "I'm in EST" }], "conv1");

    const dispute = (await listDisputes(db))[0]!;
    const incumbentId = dispute.claimBId;

    await resolveDispute(db, vectorStore, dispute.id, incumbentId);

    const rows = await listClaims(db);
    expect(rows.find((row) => row.id === incumbentId)?.status).toBe("active");
    expect(rows.find((row) => row.id === dispute.claimAId)?.status).toBe(
      "superseded",
    );
    expect(await listOpenDisputes(db)).toHaveLength(0);
  });

  test("resolveDispute rejects invalid winner and double resolution", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertAuthority(db, [
      { entity: "user.timezone", agentId: "agent-a", weight: 0.5 },
      { entity: "user.timezone", agentId: "agent-b", weight: 0.5 },
    ]);

    const { agentA, agentB } = createTimezoneAgents(db, vectorStore);

    await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
    await agentB.add([{ role: "user", content: "I'm in EST" }], "conv1");

    const dispute = (await listDisputes(db))[0]!;

    await expect(
      resolveDispute(db, vectorStore, dispute.id, crypto.randomUUID()),
    ).rejects.toThrow(/winningClaimId/);

    await resolveDispute(db, vectorStore, dispute.id, dispute.claimBId);

    await expect(
      resolveDispute(db, vectorStore, dispute.id, dispute.claimBId),
    ).rejects.toThrow(/already resolved/);
  });
});
