import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ENTITY_MATCH_THRESHOLD,
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

function createConfig(
  db: ReturnType<typeof createTestDb>,
  vectorStore: ReturnType<typeof createTestVectorStore>,
  entityMatchThreshold?: number,
) {
  return resolveMemoryConfig({
    db,
    vectorStore,
    entityMatchThreshold,
    apiKey: "test-key",
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
    const config = createConfig(db, vectorStore, 0);

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
