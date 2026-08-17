import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { recencyWeightedScore } from "../src/decay";
import { claims } from "../src/db/schema";
import {
  cosineSimilarity,
  parseEmbedding,
  search,
  searchClaims,
  searchOwnClaims,
} from "../src/search";
import type { Claim } from "../src/types";
import {
  createTestDb,
  createTestVectorStore,
  getSqliteDb,
  insertClaim,
} from "./helpers/db";

function makeClaim(overrides: Partial<Claim> & Pick<Claim, "id">): Claim {
  return {
    entity: "user.test",
    text: "test",
    type: "semantic",
    sourceAgent: "agent-a",
    conversationId: "c1",
    confidence: 1,
    status: "active",
    supersedes: null,
    embedding: null,
    createdAt: new Date("2025-01-01"),
    lastAccessedAt: null,
    ...overrides,
  };
}

describe("recencyWeightedScore", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");

  test("returns base score when accessed today", () => {
    const claim = makeClaim({
      id: "c1",
      lastAccessedAt: new Date(now),
    });
    expect(recencyWeightedScore(claim, 1, now)).toBeCloseTo(1, 5);
  });

  test("decays score for stale access", () => {
    const claim = makeClaim({
      id: "c1",
      lastAccessedAt: new Date(now - 30 * 86_400_000),
    });
    const decayed = recencyWeightedScore(claim, 1, now);
    expect(decayed).toBeCloseTo(Math.exp(-1), 5);
    expect(decayed).toBeLessThan(1);
  });

  test("falls back to createdAt when lastAccessedAt is null", () => {
    const claim = makeClaim({
      id: "c1",
      createdAt: new Date(now - 60 * 86_400_000),
      lastAccessedAt: null,
    });
    const decayed = recencyWeightedScore(claim, 0.8, now);
    expect(decayed).toBeCloseTo(0.8 * Math.exp(-2), 5);
  });
});

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

describe("search decay", () => {
  test("re-ranks by recency when vector scores are close", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const now = Date.now();
    const recent = new Date(now - 1 * 86_400_000);
    const stale = new Date(now - 90 * 86_400_000);

    await insertClaim(
      db,
      {
        id: "recent",
        entity: "user.topic",
        text: "recent fact",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [0.95, 0.05, 0],
      },
      vectorStore,
    );
    await insertClaim(
      db,
      {
        id: "stale",
        entity: "user.topic",
        text: "stale fact",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    await getSqliteDb(db)
      .update(claims)
      .set({ lastAccessedAt: recent })
      .where(eq(claims.id, "recent"));
    await getSqliteDb(db)
      .update(claims)
      .set({ lastAccessedAt: stale })
      .where(eq(claims.id, "stale"));

    const results = await searchClaims(db, vectorStore, [1, 0, 0], {
      sourceAgent: "agent-a",
      limit: 2,
    });

    expect(results[0]?.id).toBe("recent");
    expect(results[1]?.id).toBe("stale");
  });

  test("bumps lastAccessedAt for returned claims", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.diet",
        text: "vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const before = await getSqliteDb(db)
      .select()
      .from(claims)
      .where(eq(claims.id, "claim-1"));
    expect(before[0]?.lastAccessedAt).toBeNull();

    await searchClaims(db, vectorStore, [1, 0, 0], {
      sourceAgent: "agent-a",
      limit: 5,
    });

    const after = await getSqliteDb(db)
      .select()
      .from(claims)
      .where(eq(claims.id, "claim-1"));
    expect(after[0]?.lastAccessedAt).not.toBeNull();
  });

  test("does not mutate stored confidence", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.diet",
        text: "vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "c1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    await searchClaims(db, vectorStore, [1, 0, 0], {
      sourceAgent: "agent-a",
      limit: 5,
    });

    const row = await getSqliteDb(db)
      .select()
      .from(claims)
      .where(eq(claims.id, "claim-1"));
    expect(row[0]?.confidence).toBe(1);
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
    expect(results[0]?.score).toBeCloseTo(1, 5);
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
        embedding: [1, 0, 0],
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
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const embed = async () => [1, 0, 0];
    const results = await search(db, vectorStore, embed, "job", {
      conversationId: "conv-1",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("c1-claim");
  });
});
