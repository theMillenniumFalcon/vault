import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import { extractFacts } from "../src/extract";
import { EXAMPLE_ENTITY_SEED, seedEntities } from "../src/entity-registry";
import { Memory } from "../src/memory";
import { createTestDb, createTestVectorStore, listClaims } from "./helpers/db";
import { getSqliteDb } from "./helpers/db";
import { entities } from "../src/db/schema";

describe("registry-constrained extraction", () => {
  test("extractFacts uses known registry key", async () => {
    const db = createTestDb();
    await seedEntities(db, EXAMPLE_ENTITY_SEED);

    let capturedSystem = "";
    const llm: LLMFn = async ({ messages, schema }) => {
      capturedSystem = messages[0]?.content ?? "";
      return schema.parse({
        facts: [
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ],
      });
    };

    const facts = await extractFacts([{ role: "user", content: "PST" }], {
      db,
      llm,
      useEntityRegistry: true,
    });

    expect(facts[0]?.entity).toBe("user.timezone");
    expect(capturedSystem).toContain("user.timezone");
    expect(capturedSystem).toContain("user.diet");
  });

  test("extractFacts accepts new: prefix for unregistered keys", async () => {
    const db = createTestDb();
    await seedEntities(db, EXAMPLE_ENTITY_SEED);

    const llm: LLMFn = async ({ schema }) =>
      schema.parse({
        facts: [
          {
            entity: "new:user.hobby",
            text: "The user likes hiking",
            type: "semantic",
          },
        ],
      });

    const facts = await extractFacts([{ role: "user", content: "I hike" }], {
      db,
      llm,
      useEntityRegistry: true,
    });

    expect(facts[0]?.entity).toBe("user.hobby");
  });

  test("extractFacts rejects unknown key without new: prefix", async () => {
    const db = createTestDb();
    await seedEntities(db, EXAMPLE_ENTITY_SEED);

    const llm: LLMFn = async ({ schema }) =>
      schema.parse({
        facts: [
          {
            entity: "user.hobby",
            text: "The user likes hiking",
            type: "semantic",
          },
        ],
      });

    await expect(
      extractFacts([{ role: "user", content: "I hike" }], {
        db,
        llm,
        useEntityRegistry: true,
      }),
    ).rejects.toThrow("not in the registry");
  });

  test("Memory.add auto-registers new entity keys when registry enabled", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await seedEntities(db, EXAMPLE_ENTITY_SEED);

    let calls = 0;
    const llm: LLMFn = async ({ schema }) => {
      calls += 1;
      if (calls === 1) {
        return schema.parse({
          facts: [
            {
              entity: "new:user.hobby",
              text: "The user likes hiking",
              type: "semantic",
            },
          ],
        });
      }
      return schema.parse({ op: "ADD" });
    };

    const memory = new Memory("agent-a", {
      db,
      vectorStore,
      llm,
      embed: async () => [1, 0, 0],
      useEntityRegistry: true,
    });

    const { added } = await memory.add(
      [{ role: "user", content: "I love hiking" }],
      "conv-1",
    );

    expect(added[0]?.entity).toBe("user.hobby");

    const registry = await getSqliteDb(db).select().from(entities);
    expect(registry.some((row) => row.key === "user.hobby")).toBe(true);
    expect((await listClaims(db))[0]?.entity).toBe("user.hobby");
  });
});
