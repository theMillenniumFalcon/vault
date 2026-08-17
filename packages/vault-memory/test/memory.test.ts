import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import type { EmbedFn } from "../src/embed";
import { Memory } from "../src/memory";
import type { VectorStore } from "../src/vector-store/types";
import {
  createTestDb,
  createTestVectorStore,
  insertClaim,
  listClaims,
} from "./helpers/db";

const agentId = "agent-a";
const conversationId = "conv-1";

function createMemory(
  db: ReturnType<typeof createTestDb>,
  vectorStore: VectorStore,
  llm: LLMFn,
  embed: EmbedFn = async () => [1, 0, 0],
) {
  return new Memory(agentId, { db, vectorStore, llm, embed });
}

describe("Memory", () => {
  test("add stores extracted facts as new claims", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    let call = 0;
    const llm: LLMFn = async (params) => {
      call += 1;
      if (call === 1) {
        return params.schema.parse({
          facts: [
            {
              entity: "user.diet",
              text: "The user is vegetarian",
              type: "semantic",
            },
          ],
        });
      }
      return params.schema.parse({ op: "ADD" });
    };

    const memory = createMemory(db, vectorStore, llm);
    const { added } = await memory.add(
      [{ role: "user", content: "I'm vegetarian" }],
      conversationId,
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.text).toBe("The user is vegetarian");
    expect(added[0]?.sourceAgent).toBe(agentId);

    const rows = await listClaims(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("active");

    const results = await memory.search("diet");
    expect(results).toHaveLength(1);
  });

  test("add REPLACE supersedes the existing claim", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-old",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: agentId,
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    let call = 0;
    const llm: LLMFn = async (params) => {
      call += 1;
      if (call === 1) {
        return params.schema.parse({
          facts: [
            {
              entity: "user.diet",
              text: "The user eats meat",
              type: "semantic",
            },
          ],
        });
      }
      return params.schema.parse({
        op: "REPLACE",
        targetClaimId: "claim-old",
      });
    };

    const memory = createMemory(db, vectorStore, llm);
    const { added } = await memory.add(
      [{ role: "user", content: "I eat meat now" }],
      conversationId,
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.text).toBe("The user eats meat");
    expect(added[0]?.supersedes).toBe(JSON.stringify(["claim-old"]));

    const rows = await listClaims(db);
    expect(rows).toHaveLength(2);
    const oldClaim = rows.find((row) => row.id === "claim-old");
    const newClaim = rows.find((row) => row.id === added[0]?.id);
    expect(oldClaim?.status).toBe("superseded");
    expect(newClaim?.status).toBe("active");

    const results = await memory.search("diet");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(added[0]?.id);
  });

  test("add NOOP does not create a new claim", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: agentId,
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    let call = 0;
    const llm: LLMFn = async (params) => {
      call += 1;
      if (call === 1) {
        return params.schema.parse({
          facts: [
            {
              entity: "user.diet",
              text: "The user is vegetarian",
              type: "semantic",
            },
          ],
        });
      }
      return params.schema.parse({
        op: "NOOP",
        targetClaimId: "claim-1",
      });
    };

    const memory = createMemory(db, vectorStore, llm);
    const { added } = await memory.add(
      [{ role: "user", content: "I'm vegetarian" }],
      conversationId,
    );

    expect(added).toHaveLength(0);
    expect(await listClaims(db)).toHaveLength(1);
  });

  test("search returns claims for this agent", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
        sourceAgent: agentId,
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );
    await insertClaim(
      db,
      {
        id: "claim-2",
        entity: "user.diet",
        text: "Other agent claim",
        type: "semantic",
        sourceAgent: "agent-b",
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const llm: LLMFn = async ({ schema }) => schema.parse({ facts: [] });
    const memory = createMemory(db, vectorStore, llm);
    const results = await memory.search("diet");

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("claim-1");
  });

  test("update changes claim text and embedding", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.job",
        text: "engineer",
        type: "semantic",
        sourceAgent: agentId,
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const embed = async (text: string) =>
      text === "designer" ? [0, 1, 0] : [1, 0, 0];
    const llm: LLMFn = async ({ schema }) => schema.parse({ facts: [] });
    const memory = createMemory(db, vectorStore, llm, embed);

    await memory.update("claim-1", "designer");

    const row = (await listClaims(db))[0];
    expect(row?.text).toBe("designer");
    expect(row?.embedding).toBe(JSON.stringify([0, 1, 0]));

    const results = await memory.search("job");
    expect(results[0]?.text).toBe("designer");
  });

  test("delete removes a claim for this agent only", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "claim-1",
        entity: "user.job",
        text: "engineer",
        type: "semantic",
        sourceAgent: agentId,
        conversationId,
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    const llm: LLMFn = async ({ schema }) => schema.parse({ facts: [] });
    const memory = createMemory(db, vectorStore, llm);
    await memory.delete("claim-1");

    expect(await listClaims(db)).toHaveLength(0);
    expect(await memory.search("job")).toHaveLength(0);
  });
});
