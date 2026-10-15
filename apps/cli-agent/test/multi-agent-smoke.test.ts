import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { FaissVectorStore, type LLMFn } from "vault-memory";
import { agentAuthority, claims, disputes } from "vault-memory/schema";
import { createDb, getDrizzleDb } from "../src/db";
import {
  bootstrapSharedStore,
  createAgentMemory,
  searchSharedStore,
  SHARED_ENTITY_STRATEGIES,
  syncVectorIndex,
} from "../src/memory-setup";
import { createPureJsFaiss } from "./pure-js-faiss";

const TEST_VECTOR_DIMENSIONS = 3;

function createTestVectorStore() {
  return new FaissVectorStore({
    dimensions: TEST_VECTOR_DIMENSIONS,
    faiss: createPureJsFaiss(),
  });
}

function testAgentConfig(
  config: Parameters<typeof createAgentMemory>[2],
): Parameters<typeof createAgentMemory>[2] {
  return {
    vectorDimensions: TEST_VECTOR_DIMENSIONS,
    vectorStore: createTestVectorStore(),
    ...config,
  };
}

function createMockLlm(
  facts: Array<{ entity: string; text: string; type: "semantic" | "episodic" }>,
  classifyOp: { op: "ADD" | "UPDATE" | "REPLACE" | "NOOP"; targetClaimId?: string } = {
    op: "ADD",
  },
): LLMFn {
  let call = 0;
  return async ({ messages, schema }) => {
    call += 1;
    if (call === 1) {
      return schema.parse({ facts });
    }
    const direct = schema.safeParse(classifyOp);
    if (direct.success) return direct.data;
    const user = messages.find((message) => message.role === "user")?.content ?? "";
    const ids = [...user.matchAll(/^- id: (.+)$/gm)].map((match) => match[1]!.trim());
    return schema.parse({
      relations: ids.map((claimId) => ({ claimId, relation: "contradicts" })),
    });
  };
}

describe("multi-agent wiring", () => {
  test("bootstrapSharedStore seeds authority once", async () => {
    const db = createDb(":memory:");
    await bootstrapSharedStore(db);
    const rows = await getDrizzleDb(db).select().from(agentAuthority);
    expect(rows.length).toBeGreaterThan(0);

    await bootstrapSharedStore(db);
    const again = await getDrizzleDb(db).select().from(agentAuthority);
    expect(again).toHaveLength(rows.length);
  });

  test("createAgentMemory applies shared entity strategies", () => {
    const db = createDb(":memory:");
    const { memory } = createAgentMemory("agent-a", db, testAgentConfig({
      llm: createMockLlm([]),
      embed: async () => [1, 0, 0],
    }));
    expect(memory).toBeDefined();
    expect(SHARED_ENTITY_STRATEGIES?.["user.timezone"]).toBe("authority");
  });

  test("two agents sharing one db resolve a cross-agent conflict via recency", async () => {
    const db = createDb(":memory:");
    const embed = async () => [1, 0, 0];

    const { memory: agentA, vectorStore: vectorStoreA } = createAgentMemory(
      "agent-a",
      db,
      testAgentConfig({
        llm: createMockLlm([
          {
            entity: "user.diet",
            text: "The user is vegetarian",
            type: "semantic",
          },
        ]),
        embed,
        entityStrategies: { "user.diet": "recency" },
      }),
    );

    await syncVectorIndex(vectorStoreA, db);
    await agentA.add(
      [{ role: "user", content: "I'm vegetarian" }],
      "conv-1",
    );

    const { memory: agentB, vectorStore: vectorStoreB } = createAgentMemory(
      "agent-b",
      db,
      testAgentConfig({
        llm: createMockLlm([
          {
            entity: "user.diet",
            text: "The user eats meat",
            type: "semantic",
          },
        ]),
        embed,
        entityStrategies: { "user.diet": "recency" },
      }),
    );

    await syncVectorIndex(vectorStoreB, db);
    const { added } = await agentB.add(
      [{ role: "user", content: "I eat meat" }],
      "conv-1",
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.sourceAgent).toBe("agent-b");
    expect(added[0]?.text).toBe("The user eats meat");

    const rows = await getDrizzleDb(db).select().from(claims);
    const oldClaim = rows.find((row) => row.sourceAgent === "agent-a");
    const newClaim = rows.find((row) => row.id === added[0]?.id);
    expect(oldClaim?.status).toBe("superseded");
    expect(newClaim?.status).toBe("active");

    await syncVectorIndex(vectorStoreB, db);
    const results = await searchSharedStore(
      db,
      vectorStoreB,
      embed,
      "what does the user eat?",
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(added[0]?.id);
    expect(results[0]?.text).toContain("meat");
  });

  test("two agents with authority: lower-weight agent disputes timezone conflict", async () => {
    const db = createDb(":memory:");
    await bootstrapSharedStore(db);
    const embed = async (text: string) => {
      const lower = text.toLowerCase();
      if (lower.includes("pst") || lower.includes("pacific")) return [1, 0, 0];
      if (lower.includes("est") || lower.includes("eastern")) return [0.05, 1, 0];
      return [0.5, 0.5, 0];
    };

    const { memory: agentA, vectorStore: vectorStoreA } = createAgentMemory(
      "agent-a",
      db,
      testAgentConfig({
        llm: createMockLlm([
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ]),
        embed,
      }),
    );

    await syncVectorIndex(vectorStoreA, db);
    await agentA.add([{ role: "user", content: "I'm in PST" }], "conv-1");

    const { memory: agentB, vectorStore: vectorStoreB } = createAgentMemory(
      "agent-b",
      db,
      testAgentConfig({
        llm: createMockLlm([
          {
            entity: "user.timezone",
            text: "The user is in EST",
            type: "semantic",
          },
        ]),
        embed,
      }),
    );

    await syncVectorIndex(vectorStoreB, db);
    const { added } = await agentB.add(
      [{ role: "user", content: "I'm in EST" }],
      "conv-1",
    );

    expect(added[0]?.status).toBe("disputed");

    const disputeRows = await getDrizzleDb(db).select().from(disputes);
    expect(disputeRows).toHaveLength(1);
    expect(disputeRows[0]?.resolutionStrategy).toBe("authority");

    await syncVectorIndex(vectorStoreB, db);
    const results = await searchSharedStore(
      db,
      vectorStoreB,
      embed,
      "what timezone is the user in?",
    );
    expect(results[0]?.sourceAgent).toBe("agent-a");
    expect(results[0]?.text).toContain("PST");
  });

  test("syncVectorIndex lets a fresh agent process see another agent's claims", async () => {
    const db = createDb(":memory:");
    const embed = async () => [1, 0, 0];

    const { memory: agentA, vectorStore: vectorStoreA } = createAgentMemory(
      "agent-a",
      db,
      testAgentConfig({
        llm: createMockLlm([
          {
            entity: "user.diet",
            text: "The user is vegetarian",
            type: "semantic",
          },
        ]),
        embed,
      }),
    );

    await syncVectorIndex(vectorStoreA, db);
    await agentA.add(
      [{ role: "user", content: "I'm vegetarian" }],
      "conv-1",
    );

    const { vectorStore: vectorStoreB } = createAgentMemory("agent-b", db, testAgentConfig({
      llm: createMockLlm([]),
      embed,
    }));

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
