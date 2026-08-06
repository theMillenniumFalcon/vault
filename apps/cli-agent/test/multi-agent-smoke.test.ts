import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { LLMFn } from "vault-memory";
import { claims } from "vault-memory/schema";
import { createDb, getDrizzleDb } from "../src/db";
import { createAgentMemory, syncVectorIndex } from "../src/memory-setup";

function createMockLlm(
  facts: Array<{ entity: string; text: string; type: "semantic" | "episodic" }>,
  classifyOp: { op: "ADD" | "UPDATE" | "REPLACE" | "NOOP"; targetClaimId?: string } = {
    op: "ADD",
  },
): LLMFn {
  let call = 0;
  return async ({ schema }) => {
    call += 1;
    if (call === 1) {
      return schema.parse({ facts });
    }
    return schema.parse(classifyOp);
  };
}

describe("multi-agent smoke", () => {
  test("two agents sharing one db resolve a cross-agent conflict via recency", async () => {
    const db = createDb(":memory:");
    const embed = async () => [1, 0, 0];

    const { memory: agentA, vectorStore: vectorStoreA } = createAgentMemory(
      "agent-a",
      db,
      {
        llm: createMockLlm([
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ]),
        embed,
      },
    );

    await syncVectorIndex(vectorStoreA, db);
    await agentA.add(
      [{ role: "user", content: "I'm in PST" }],
      "conv-1",
    );

    const { memory: agentB, vectorStore: vectorStoreB } = createAgentMemory(
      "agent-b",
      db,
      {
        llm: createMockLlm([
          {
            entity: "user.timezone",
            text: "The user is in EST",
            type: "semantic",
          },
        ]),
        embed,
      },
    );

    await syncVectorIndex(vectorStoreB, db);
    const { added } = await agentB.add(
      [{ role: "user", content: "I'm in EST" }],
      "conv-1",
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.sourceAgent).toBe("agent-b");
    expect(added[0]?.text).toBe("The user is in EST");

    const rows = await getDrizzleDb(db).select().from(claims);
    const oldClaim = rows.find((row) => row.sourceAgent === "agent-a");
    const newClaim = rows.find((row) => row.id === added[0]?.id);
    expect(oldClaim?.status).toBe("superseded");
    expect(newClaim?.status).toBe("active");

    await syncVectorIndex(vectorStoreB, db);
    const results = await agentB.search("timezone");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(added[0]?.id);
    expect(results[0]?.text).toContain("EST");
  });

  test("syncVectorIndex lets a fresh agent process see another agent's claims", async () => {
    const db = createDb(":memory:");
    const embed = async () => [1, 0, 0];

    const { memory: agentA, vectorStore: vectorStoreA } = createAgentMemory(
      "agent-a",
      db,
      {
        llm: createMockLlm([
          {
            entity: "user.diet",
            text: "The user is vegetarian",
            type: "semantic",
          },
        ]),
        embed,
      },
    );

    await syncVectorIndex(vectorStoreA, db);
    await agentA.add(
      [{ role: "user", content: "I'm vegetarian" }],
      "conv-1",
    );

    const { memory: agentB, vectorStore: vectorStoreB } = createAgentMemory(
      "agent-b",
      db,
      {
        llm: createMockLlm([]),
        embed,
      },
    );

    await syncVectorIndex(vectorStoreB, db);
    const crossAgentHits = await vectorStoreB.search([1, 0, 0], {
      limit: 5,
      filter: { excludeAgent: "agent-b", entity: "user.diet", status: "active" },
    });

    expect(crossAgentHits).toHaveLength(1);
    expect(crossAgentHits[0]?.claimId).toBeDefined();

    const stored = await getDrizzleDb(db)
      .select()
      .from(claims)
      .where(eq(claims.sourceAgent, "agent-a"));
    expect(stored).toHaveLength(1);
  });
});
