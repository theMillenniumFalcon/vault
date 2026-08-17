import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { claims } from "../src/db/schema";
import { createDefaultVectorStore } from "../src/vector-store/create";
import { MemoryVectorStore } from "../src/vector-store/memory";
import {
  createTestDb,
  createTestVectorStore,
  getSqliteDb,
  insertClaim,
  TEST_EMBEDDING_DIMENSIONS,
} from "./helpers/db";
import { createPureJsFaiss } from "./helpers/pure-js-faiss";
import { FaissVectorStore } from "../src/vector-store/faiss";

describe("FaissVectorStore (default)", () => {
  test("createDefaultVectorStore returns a FAISS-backed index", () => {
    const store = createDefaultVectorStore({
      dimensions: TEST_EMBEDDING_DIMENSIONS,
    });
    expect(store).toBeInstanceOf(FaissVectorStore);
  });

  test("upsert, search, and remove keep the index in sync", async () => {
    const vectorStore = createTestVectorStore();

    await vectorStore.upsert("claim-1", [1, 0, 0], {
      claimId: "claim-1",
      sourceAgent: "agent-a",
      entity: "user.diet",
      status: "active",
      conversationId: "conv-1",
    });

    const hits = await vectorStore.search([1, 0, 0], { limit: 5 });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.claimId).toBe("claim-1");

    await vectorStore.remove("claim-1");
    expect(await vectorStore.search([1, 0, 0], { limit: 5 })).toHaveLength(0);
  });

  test("excludeAgent filters cross-agent results", async () => {
    const vectorStore = createTestVectorStore();

    await vectorStore.upsert("a", [1, 0, 0], {
      claimId: "a",
      sourceAgent: "agent-a",
      entity: "user.timezone",
      status: "active",
      conversationId: "conv-1",
    });
    await vectorStore.upsert("b", [1, 0, 0], {
      claimId: "b",
      sourceAgent: "agent-b",
      entity: "user.timezone",
      status: "active",
      conversationId: "conv-1",
    });

    const hits = await vectorStore.search([1, 0, 0], {
      limit: 5,
      filter: { excludeAgent: "agent-a", status: "active" },
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.claimId).toBe("b");
  });

  test("rebuild restores active claims from the database", async () => {
    const db = createTestDb();
    const vectorStore = new FaissVectorStore({
      dimensions: TEST_EMBEDDING_DIMENSIONS,
      faiss: createPureJsFaiss(),
    });

    await insertClaim(db, {
      id: "claim-1",
      entity: "user.job",
      text: "engineer",
      type: "semantic",
      sourceAgent: "agent-a",
      conversationId: "conv-1",
      embedding: [1, 0, 0],
    });
    await insertClaim(db, {
      id: "claim-2",
      entity: "user.job",
      text: "old",
      type: "semantic",
      sourceAgent: "agent-a",
      conversationId: "conv-1",
      embedding: [0, 1, 0],
      status: "superseded",
    });

    await vectorStore.rebuild(db);

    const hits = await vectorStore.search([1, 0, 0], { limit: 5 });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.claimId).toBe("claim-1");
  });

  test("rebuild replaces stale index entries after claim status changes", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();

    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.job",
        text: "engineer",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    await getSqliteDb(db)
      .update(claims)
      .set({ status: "superseded" })
      .where(eq(claims.id, "claim-1"));

    await vectorStore.rebuild(db);
    expect(await vectorStore.search([1, 0, 0], { limit: 5 })).toHaveLength(0);
  });
});

describe("MemoryVectorStore (legacy brute-force)", () => {
  test("still available as an explicit fallback", async () => {
    const vectorStore = new MemoryVectorStore();

    await vectorStore.upsert("claim-1", [1, 0, 0], {
      claimId: "claim-1",
      sourceAgent: "agent-a",
      entity: "user.diet",
      status: "active",
      conversationId: "conv-1",
    });

    const hits = await vectorStore.search([1, 0, 0], { limit: 5 });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.claimId).toBe("claim-1");
  });
});
