import { describe, expect, test } from "bun:test";
import type { LLMFn } from "vault-memory";
import {
  countActiveClaims,
  createMemory,
  createTestDb,
  insertClaim,
  listClaims,
  syncVectorIndex,
} from "./helpers";

const conversationId = "regression-session";

function routingLlm(
  handlers: Array<(params: Parameters<LLMFn>[0]) => Promise<unknown>>,
): LLMFn {
  let call = 0;
  return async (params) => {
    const handler = handlers[call];
    call += 1;
    if (!handler) {
      throw new Error(`Unexpected LLM call #${call}`);
    }
    return params.schema.parse(await handler(params));
  };
}

describe("cli-agent regression", () => {
  test("extracts and stores a fact from conversation input", async () => {
    const db = createTestDb();
    const llm = routingLlm([
      async () => ({
        facts: [
          {
            entity: "user.diet",
            text: "The user is vegetarian",
            type: "semantic",
          },
        ],
      }),
      async () => ({ op: "ADD" }),
    ]);

    const { memory, vectorStore } = createMemory(db, llm);
    await syncVectorIndex(vectorStore, db);
    const { added } = await memory.add(
      [{ role: "user", content: "I'm vegetarian" }],
      conversationId,
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.text).toBe("The user is vegetarian");
    expect(await countActiveClaims(db)).toBe(1);
  });

  test("REPLACEs on contradiction instead of duplicating", async () => {
    const db = createTestDb();
    const llm = routingLlm([
      async () => ({
        facts: [
          {
            entity: "user.diet",
            text: "The user eats meat",
            type: "semantic",
          },
        ],
      }),
      async () => ({
        op: "REPLACE",
        targetClaimId: "claim-old",
      }),
    ]);

    const { memory, vectorStore } = createMemory(db, llm);
    await insertClaim(
      db,
      {
        id: "claim-old",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await syncVectorIndex(vectorStore, db);

    const { added } = await memory.add(
      [{ role: "user", content: "Actually I eat meat now" }],
      conversationId,
    );

    expect(added).toHaveLength(1);
    expect(await countActiveClaims(db)).toBe(1);

    const rows = await listClaims(db);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === "claim-old")?.status).toBe("superseded");
    expect(rows.find((row) => row.id === added[0]?.id)?.status).toBe("active");
  });

  test("NOOP on restated fact does not bloat the table", async () => {
    const db = createTestDb();
    const llm = routingLlm([
      async () => ({
        facts: [
          {
            entity: "user.diet",
            text: "The user is vegetarian",
            type: "semantic",
          },
        ],
      }),
      async () => ({
        op: "NOOP",
        targetClaimId: "claim-1",
      }),
    ]);

    const { memory, vectorStore } = createMemory(db, llm);
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await syncVectorIndex(vectorStore, db);

    const { added } = await memory.add(
      [{ role: "user", content: "As I said, I'm vegetarian" }],
      conversationId,
    );

    expect(added).toHaveLength(0);
    expect(await listClaims(db)).toHaveLength(1);
    expect(await countActiveClaims(db)).toBe(1);
  });

  test("search matches semantically different wording, not just keywords", async () => {
    const db = createTestDb();
    const dietVector = [1, 0, 0];
    const jobVector = [0, 1, 0];

    const semanticQuery = "what food preferences does the user have";
    const embed: import("vault-memory").EmbedFn = async (text) => {
      if (text === "The user is vegetarian") return dietVector;
      if (text === "The user is a software engineer") return jobVector;
      if (text === semanticQuery) return [0.98, 0.02, 0];
      return [0, 0, 1];
    };

    const llm: LLMFn = async ({ schema }) => schema.parse({ facts: [] });
    const { memory, vectorStore } = createMemory(db, llm, embed);

    await insertClaim(
      db,
      {
        id: "diet-claim",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId,
        embedding: dietVector,
      },
      vectorStore,
    );
    await insertClaim(
      db,
      {
        id: "job-claim",
        entity: "user.job",
        text: "The user is a software engineer",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId,
        embedding: jobVector,
      },
      vectorStore,
    );
    await syncVectorIndex(vectorStore, db);

    const results = await memory.search(semanticQuery);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe("diet-claim");
    expect(results[0]?.text).toBe("The user is vegetarian");
    expect(semanticQuery.includes("vegetarian")).toBe(false);
    expect((results[0]?.score ?? 0)).toBeGreaterThan(0.9);
  });
});
