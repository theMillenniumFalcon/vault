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

function createMemory(
  db: ReturnType<typeof createTestDb>,
  vectorStore: VectorStore,
  agentId: string,
  llm: LLMFn,
  embed: EmbedFn = async () => [1, 0, 0],
) {
  return new Memory(agentId, { db, vectorStore, llm, embed });
}

describe("Memory two-pass classification", () => {
  test("cross-agent ADD supersedes conflicting claims via recency", async () => {
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

    let call = 0;
    const llm: LLMFn = async ({ schema }) => {
      call += 1;
      if (call === 1) {
        return schema.parse({
          facts: [
            {
              entity: "user.timezone",
              text: "The user is in EST",
              type: "semantic",
            },
          ],
        });
      }
      return schema.parse({ op: "ADD" });
    };

    const memory = createMemory(db, vectorStore, "agent-b", llm);
    const { added } = await memory.add(
      [{ role: "user", content: "I'm in EST" }],
      "conv-1",
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.sourceAgent).toBe("agent-b");
    expect(added[0]?.text).toBe("The user is in EST");

    const rows = await listClaims(db);
    const oldClaim = rows.find((row) => row.id === "agent-a-claim");
    const newClaim = rows.find((row) => row.id === added[0]?.id);
    expect(oldClaim?.status).toBe("superseded");
    expect(newClaim?.status).toBe("active");

    const results = await memory.search("timezone");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(added[0]?.id);
  });

  test("skips cross-agent pass when own history returns UPDATE", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertClaim(
      db,
      {
        id: "own-claim",
        entity: "user.timezone",
        text: "The user is in EST",
        type: "semantic",
        sourceAgent: "agent-b",
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
        text: "The user is in PST",
        type: "semantic",
        sourceAgent: "agent-a",
        conversationId: "conv-1",
        embedding: [1, 0, 0],
      },
      vectorStore,
    );

    let call = 0;
    const llm: LLMFn = async ({ schema }) => {
      call += 1;
      if (call === 1) {
        return schema.parse({
          facts: [
            {
              entity: "user.timezone",
              text: "The user is in Eastern Time",
              type: "semantic",
            },
          ],
        });
      }
      return schema.parse({ op: "UPDATE", targetClaimId: "own-claim" });
    };

    const memory = createMemory(db, vectorStore, "agent-b", llm);
    const { added } = await memory.add(
      [{ role: "user", content: "Eastern Time" }],
      "conv-1",
    );

    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe("own-claim");
    expect(added[0]?.text).toBe("The user is in Eastern Time");

    const otherClaim = (await listClaims(db)).find((row) => row.id === "other-claim");
    expect(otherClaim?.status).toBe("active");
  });
});
