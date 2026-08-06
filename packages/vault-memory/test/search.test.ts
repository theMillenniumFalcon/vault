import { describe, expect, test } from "bun:test";
import {
  cosineSimilarity,
  parseEmbedding,
  search,
  searchClaims,
  searchOwnClaims,
} from "../src/search";
import {
  createTestDb,
  createTestVectorStore,
  insertClaim,
} from "./helpers/db";

describe("cosineSimilarity", () => {
  test("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  test("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  test("returns 0 for empty or mismatched vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe("parseEmbedding", () => {
  test("parses valid JSON float arrays", () => {
    expect(parseEmbedding("[1, 0, 0]")).toEqual([1, 0, 0]);
  });

  test("returns null for invalid values", () => {
    expect(parseEmbedding(null)).toBeNull();
    expect(parseEmbedding("not-json")).toBeNull();
    expect(parseEmbedding('["a"]')).toBeNull();
  });
});

describe("searchOwnClaims", () => {
  test("filters by sourceAgent and active status", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "a1",
        entity: "user.diet",
        text: "vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await insertClaim(
      db,
      {
        id: "b1",
        entity: "user.diet",
        text: "vegetarian",
        type: "semantic",
        sourceAgent: "agent-b",
        conversationId: "c1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await insertClaim(db, {
      id: "a2",
      entity: "user.diet",
      text: "old fact",
      type: "semantic",
      sourceAgent: "agent-a",
      conversationId: "c1",
      embedding: [0.9, 0.1, 0],
      status: "superseded",
    });

    const results = await searchOwnClaims(
      db,
      vectorStore,
      "agent-a",
      [1, 0, 0],
      5,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("a1");
  });

  test("ranks by cosine similarity", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "close",
        entity: "user.location",
        text: "lives in Berlin",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [0.9, 0.1, 0],
      },
      vectorStore,
    );
    await insertClaim(
      db,
      {
        id: "far",
        entity: "user.location",
        text: "lives in Tokyo",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [0, 0, 1],
      },
      vectorStore,
    );

    const results = await searchClaims(db, vectorStore, [1, 0, 0], {
      sourceAgent: "agent-a",
      limit: 2,
    });

    expect(results.map((r) => r.id)).toEqual(["close", "far"]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });
});

describe("search", () => {
  test("embeds query and returns scored claims", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const embed = async () => [1, 0, 0];
    const results = await search(db, vectorStore, embed, "what does the user eat?", {
      limit: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("The user is vegetarian");
    expect(results[0]?.score).toBe(1);
  });

  test("filters by conversationId when provided", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "c1-claim",
        entity: "user.job",
        text: "engineer",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0],
      },
      vectorStore,
    );
    await insertClaim(
      db,
      {
        id: "c2-claim",
        entity: "user.job",
        text: "designer",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-2",
        embedding: [1, 0],
      },
      vectorStore,
    );

    const embed = async () => [1, 0];
    const results = await search(db, vectorStore, embed, "job", {
      conversationId: "conv-1",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("c1-claim");
  });
});
