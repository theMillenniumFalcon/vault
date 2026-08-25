import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import {
  DEFAULT_ENTITY_DISAMBIGUATION_THRESHOLD,
  DEFAULT_ENTITY_MATCH_THRESHOLD,
  disambiguateEntityWithLlm,
  resolveEntity,
} from "../src/resolve-entity";
import { applyOp } from "../src/ops";
import type { ExtractedFact } from "../src/types";
import {
  createTestDb,
  createTestVectorStore,
  insertClaim,
  listClaims,
} from "./helpers/db";
import { resolveMemoryConfig } from "../src/config";

const pstEmbedding = [1, 0.05, 0];
const estEmbedding = [0.05, 1, 0];
/** ~0.76 cosine similarity with [1, 0, 0] — borderline band. */
const borderlineEmbedding = [0.7, 0.6, 0];

function createConfig(
  db: ReturnType<typeof createTestDb>,
  vectorStore: ReturnType<typeof createTestVectorStore>,
  overrides: {
    entityMatchThreshold?: number;
    entityDisambiguationThreshold?: number;
    entityResolutionUseLlm?: boolean;
    llm?: LLMFn;
    apiKey?: string;
  } = {},
) {
  return resolveMemoryConfig({
    db,
    vectorStore,
    apiKey: "test-key",
    ...overrides,
  });
}

describe("resolveEntity", () => {
  test("aligns entity when similar active claim exists above threshold", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const config = createConfig(db, vectorStore);

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: pstEmbedding,
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "The user is located in PST",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, pstEmbedding, config);
    expect(resolved.entity).toBe("user.timezone");
    expect(resolved.text).toBe(fact.text);
  });

  test("keeps extracted entity when similarity is below threshold", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const config = createConfig(db, vectorStore);

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: pstEmbedding,
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "The user is in EST",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, estEmbedding, config);
    expect(resolved.entity).toBe("user.abc");
  });

  test("keeps extracted entity when threshold is 0 (disabled)", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const config = createConfig(db, vectorStore, { entityMatchThreshold: 0 });

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: pstEmbedding,
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "The user is located in PST",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, pstEmbedding, config);
    expect(resolved.entity).toBe("user.abc");
  });

  test("aligns cross-agent: agent-b fact maps to agent-a entity", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const config = createConfig(db, vectorStore);

    await insertClaim(
      db,
      {
        id: "claim-a",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: pstEmbedding,
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.location",
      text: "The user is in Pacific time",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, pstEmbedding, config);
    expect(resolved.entity).toBe("user.timezone");
  });

  test("default threshold is 0.85", () => {
    expect(DEFAULT_ENTITY_MATCH_THRESHOLD).toBe(0.85);
  });

  test("default disambiguation threshold is 0.70", () => {
    expect(DEFAULT_ENTITY_DISAMBIGUATION_THRESHOLD).toBe(0.7);
  });

  test("borderline score: LLM aligns to candidate entity", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const llm: LLMFn = async ({ schema }) =>
      schema.parse({ entity: "user.timezone" });

    const config = createConfig(db, vectorStore, { llm });

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "The user is in Pacific time",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, borderlineEmbedding, config);
    expect(resolved.entity).toBe("user.timezone");
  });

  test("borderline score: LLM keeps extracted entity", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    const llm: LLMFn = async ({ schema }) =>
      schema.parse({ entity: "user.abc" });

    const config = createConfig(db, vectorStore, { llm });

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "Something vaguely related",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, borderlineEmbedding, config);
    expect(resolved.entity).toBe("user.abc");
  });

  test("borderline score: skips LLM when entityResolutionUseLlm is false", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    let llmCalls = 0;
    const llm: LLMFn = async ({ schema }) => {
      llmCalls += 1;
      return schema.parse({ entity: "user.timezone" });
    };

    const config = createConfig(db, vectorStore, {
      llm,
      entityResolutionUseLlm: false,
    });

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "Pacific time",
      type: "semantic",
    };

    const resolved = await resolveEntity(fact, borderlineEmbedding, config);
    expect(resolved.entity).toBe("user.abc");
    expect(llmCalls).toBe(0);
  });

  test("disambiguateEntityWithLlm rejects invalid entity keys", async () => {
    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "test",
      type: "semantic",
    };
    const llm: LLMFn = async ({ schema }) =>
      schema.parse({ entity: "user.invalid" });

    await expect(
      disambiguateEntityWithLlm(
        fact,
        [
          {
            claimId: "c1",
            entity: "user.timezone",
            text: "PST",
            score: 0.75,
          },
        ],
        { llm },
      ),
    ).rejects.toThrow();
  });

  test("UPDATE preserves incumbent entity when extractor label drifts", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();

    await insertClaim(
      db,
      {
        id: "claim-tz",
        entity: "user.timezone",
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: pstEmbedding,
      },
      vectorStore,
    );

    const fact: ExtractedFact = {
      entity: "user.abc",
      text: "The user is in Pacific time",
      type: "semantic",
    };

    await applyOp(
      db,
      vectorStore,
      "UPDATE",
      fact,
      pstEmbedding,
      "claim-tz",
      "agent-a",
      "conv-1",
    );

    const row = (await listClaims(db)).find((r) => r.id === "claim-tz");
    expect(row?.entity).toBe("user.timezone");
    expect(row?.text).toBe("The user is in Pacific time");
  });
});
