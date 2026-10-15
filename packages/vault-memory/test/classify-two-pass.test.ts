import { describe, expect, test } from "bun:test";
import {
  classifyAgainstOtherAgents,
  classifyAgainstOwnHistory,
} from "../src/classify";
import type { LLMFn, MemoryConfig, ResolvedMemoryConfig } from "../src/config";
import { resolveMemoryConfig } from "../src/config";
import { EXAMPLE_AUTHORITY_SEED } from "../src/resolve";
import type { ExtractedFact } from "../src/types";
import {
  createTestDb,
  createTestVectorStore,
  insertAuthority,
  insertClaim,
} from "./helpers/db";
import { scriptedMemoryResponse } from "./helpers/llm";

const fact: ExtractedFact = {
  entity: "user.timezone",
  text: "The user is in EST",
  type: "semantic",
};

function createConfig(
  llm: LLMFn,
  overrides: Partial<MemoryConfig> = {},
): ResolvedMemoryConfig {
  return resolveMemoryConfig({
    db: createTestDb(),
    vectorStore: createTestVectorStore(),
    llm,
    ...overrides,
  });
}

describe("classifyAgainstOwnHistory", () => {
  test("uses same-agent claims from the vector store", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "own-claim",
        entity: "user.timezone",
        text: "The user is in PST",
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
        id: "other-claim",
        entity: "user.timezone",
        text: "The user is in GMT",
        type: "semantic",
        sourceAgent: "agent-b",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const llm: LLMFn = async ({ schema }) =>
      schema.parse({ op: "REPLACE", targetClaimId: "own-claim" });

    const result = await classifyAgainstOwnHistory(
      fact,
      "agent-a",
      [1, 0, 0],
      { db, vectorStore, llm },
    );

    expect(result).toEqual({ op: "REPLACE", targetClaimId: "own-claim" });
  });
});

describe("classifyAgainstOtherAgents", () => {
  test("returns ADD when no cross-agent conflicts exist", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const config = createConfig(async ({ schema }) => schema.parse({ op: "ADD" }), {
      db,
      vectorStore,
    });

    const result = await classifyAgainstOtherAgents(
      fact,
      "agent-b",
      [1, 0, 0],
      config,
    );

    expect(result).toEqual({ op: "ADD" });
  });

  test("returns REPLACE with conflicting claim ids via recency strategy", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "agent-a-claim",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const config = createConfig(
      async ({ messages, schema }) =>
        scriptedMemoryResponse(schema, messages, { op: "ADD" }),
      {
        db,
        vectorStore,
      },
    );

    const result = await classifyAgainstOtherAgents(
      fact,
      "agent-b",
      [0, 1, 0],
      config,
    );

    expect(result).toEqual({
      op: "REPLACE",
      supersedes: ["agent-a-claim"],
    });
  });

  test("ignores claims from other entities", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "other-entity",
        entity: "user.mood",
        text: "The user is happy",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const config = createConfig(async ({ schema }) => schema.parse({ op: "ADD" }), {
      db,
      vectorStore,
    });

    const result = await classifyAgainstOtherAgents(
      fact,
      "agent-b",
      [1, 0, 0],
      config,
    );

    expect(result).toEqual({ op: "ADD" });
  });

  test("authority strategy: higher-weighted agent REPLACE", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "agent-b-claim",
        entity: "user.timezone",
        text: "The user is in EST",
        type: "semantic",
        sourceAgent: "agent-b",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await insertAuthority(db, EXAMPLE_AUTHORITY_SEED);

    const config = createConfig(
      async ({ messages, schema }) =>
        scriptedMemoryResponse(schema, messages, { op: "ADD" }),
      {
        db,
        vectorStore,
        entityStrategies: { "user.timezone": "authority" },
      },
    );

    const result = await classifyAgainstOtherAgents(
      { ...fact, text: "The user is in PST" },
      "agent-a",
      [1, 0, 0],
      config,
    );

    expect(result).toEqual({
      op: "REPLACE",
      supersedes: ["agent-b-claim"],
    });
  });

  test("authority strategy: lower-weighted agent DISPUTE", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "agent-a-claim",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await insertAuthority(db, EXAMPLE_AUTHORITY_SEED);

    const config = createConfig(
      async ({ messages, schema }) =>
        scriptedMemoryResponse(schema, messages, { op: "ADD" }),
      {
        db,
        vectorStore,
        entityStrategies: { "user.timezone": "authority" },
      },
    );

    const result = await classifyAgainstOtherAgents(
      fact,
      "agent-b",
      [1, 0, 0],
      config,
    );

    expect(result).toEqual({
      op: "DISPUTE",
      conflictingClaimId: "agent-a-claim",
    });
  });

  test("compatible facts on the same entity stay an ADD", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "diet-claim",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const config = createConfig(
      async ({ schema }) =>
        schema.parse({
          relations: [{ claimId: "diet-claim", relation: "compatible" }],
        }),
      { db, vectorStore },
    );

    const result = await classifyAgainstOtherAgents(
      {
        entity: "user.diet",
        text: "The user likes Italian food",
        type: "semantic",
      },
      "agent-b",
      [0, 1, 0],
      config,
    );

    expect(result).toEqual({ op: "ADD" });
  });

  test("equivalent cross-agent fact is a NOOP", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "diet-claim",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const config = createConfig(
      async ({ schema }) =>
        schema.parse({
          relations: [{ claimId: "diet-claim", relation: "equivalent" }],
        }),
      { db, vectorStore },
    );

    const result = await classifyAgainstOtherAgents(
      {
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
      },
      "agent-b",
      [1, 0, 0],
      config,
    );

    expect(result).toEqual({ op: "NOOP" });
  });

  test("recency supersedes only the contradicting claim", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "vegetarian",
        entity: "user.diet",
        text: "The user is vegetarian",
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
        id: "italian",
        entity: "user.diet",
        text: "The user likes Italian food",
        type: "semantic",
        sourceAgent: "agent-c",
        conversationId: "conv-1",
        embedding: [0, 1, 0],
      },
      vectorStore,
    );

    const config = createConfig(
      async ({ schema }) =>
        schema.parse({
          relations: [
            { claimId: "vegetarian", relation: "contradicts" },
            { claimId: "italian", relation: "compatible" },
          ],
        }),
      { db, vectorStore },
    );

    const result = await classifyAgainstOtherAgents(
      {
        entity: "user.diet",
        text: "The user eats meat",
        type: "semantic",
      },
      "agent-b",
      [0, 0, 1],
      config,
    );

    expect(result).toEqual({ op: "REPLACE", supersedes: ["vegetarian"] });
  });
});
