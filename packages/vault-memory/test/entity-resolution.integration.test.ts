import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import { Memory } from "../src/memory";
import { EXAMPLE_AUTHORITY_SEED } from "../src/resolve";
import {
  createTestDb,
  createTestVectorStore,
  insertAuthority,
  listDisputes,
} from "./helpers/db";

/** Same vector for timezone facts so entity resolution can align labels. */
const timezoneEmbed = async (text: string) => {
  const lower = text.toLowerCase();
  if (
    lower.includes("pst") ||
    lower.includes("est") ||
    lower.includes("timezone") ||
    lower.includes("pacific") ||
    lower.includes("eastern")
  ) {
    return [1, 0.05, 0];
  }
  return [0.5, 0.5, 0.5];
};

describe("entity resolution in Memory.add", () => {
  test("cross-agent conflict triggers after entity alignment", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
    await insertAuthority(db, EXAMPLE_AUTHORITY_SEED);

    const entityStrategies = { "user.timezone": "authority" as const };

    let agentACalls = 0;
    const agentALLM: LLMFn = async ({ schema }) => {
      agentACalls += 1;
      if (agentACalls === 1) {
        return schema.parse({
          facts: [
            {
              entity: "user.timezone",
              text: "The user is in PST",
              type: "semantic",
            },
          ],
        });
      }
      return schema.parse({ op: "ADD" });
    };

    const memoryA = new Memory("agent-a", {
      db,
      vectorStore,
      llm: agentALLM,
      embed: timezoneEmbed,
      entityStrategies,
    });

    await memoryA.add([{ role: "user", content: "I'm in PST" }], "conv1");

    let agentBCalls = 0;
    const agentBLLM: LLMFn = async ({ schema }) => {
      agentBCalls += 1;
      if (agentBCalls === 1) {
        return schema.parse({
          facts: [
            {
              entity: "user.wrong_label",
              text: "The user is in EST",
              type: "semantic",
            },
          ],
        });
      }
      return schema.parse({ op: "ADD" });
    };

    const memoryB = new Memory("agent-b", {
      db,
      vectorStore,
      llm: agentBLLM,
      embed: timezoneEmbed,
      entityStrategies,
    });

    const { added } = await memoryB.add(
      [{ role: "user", content: "I'm in EST" }],
      "conv1",
    );

    expect(added[0]?.entity).toBe("user.timezone");
    expect(added[0]?.status).toBe("disputed");
    expect(await listDisputes(db)).toHaveLength(1);
  });
});
