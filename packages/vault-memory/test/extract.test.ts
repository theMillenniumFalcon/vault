import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import { extractFacts, getLatestTurn } from "../src/extract";
import type { Message } from "../src/types";

describe("getLatestTurn", () => {
  test("returns only the latest user/assistant turn", () => {
    const messages: Message[] = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "I'm vegetarian" },
      { role: "assistant", content: "Got it" },
    ];

    expect(getLatestTurn(messages)).toEqual([
      { role: "user", content: "I'm vegetarian" },
      { role: "assistant", content: "Got it" },
    ]);
  });

  test("returns empty array when there is no user message", () => {
    expect(
      getLatestTurn([{ role: "assistant", content: "Hello" }]),
    ).toEqual([]);
  });
});

describe("extractFacts", () => {
  test("validates LLM output with Zod before returning facts", async () => {
    const llm: LLMFn = async ({ schema }) =>
      schema.parse({
        facts: [
          {
            entity: "user.diet",
            text: "The user is vegetarian",
            type: "semantic",
          },
        ],
      });

    const facts = await extractFacts(
      [
        { role: "user", content: "I'm vegetarian" },
        { role: "assistant", content: "Noted" },
      ],
      { llm },
    );

    expect(facts).toEqual([
      {
        entity: "user.diet",
        text: "The user is vegetarian",
        type: "semantic",
      },
    ]);
  });

  test("rejects invalid LLM output", async () => {
    const llm = (async () => ({
      facts: [{ entity: "user", text: "bad", type: "invalid" }],
    })) as LLMFn;

    await expect(
      extractFacts([{ role: "user", content: "test" }], { llm }),
    ).rejects.toThrow();
  });

  test("uses only the latest turn, not the full conversation", async () => {
    let capturedPrompt = "";
    const llm: LLMFn = async ({ messages, schema }) => {
      capturedPrompt = messages[1]?.content ?? "";
      return schema.parse({ facts: [] });
    };

    await extractFacts(
      [
        { role: "user", content: "I live in Paris" },
        { role: "assistant", content: "Nice" },
        { role: "user", content: "I moved to Berlin" },
      ],
      { llm },
    );

    expect(capturedPrompt).toContain("I moved to Berlin");
    expect(capturedPrompt).not.toContain("I live in Paris");
  });
});
