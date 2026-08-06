import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import { classify } from "../src/classify";
import type { Claim, ExtractedFact } from "../src/types";

const fact: ExtractedFact = {
  entity: "user.diet",
  text: "The user eats meat",
  type: "semantic",
};

const existingClaim: Claim = {
  id: "claim-1",
  entity: "user.diet",
  text: "The user is vegetarian",
  type: "semantic",
  sourceAgent: "agent-a",
  conversationId: "conv-1",
  confidence: 1,
  status: "active",
  supersedes: null,
  embedding: null,
  createdAt: new Date("2026-01-01"),
  lastAccessedAt: null,
};

describe("classify", () => {
  test("returns REPLACE for contradicting facts", async () => {
    const llm: LLMFn = async ({ schema }) =>
      schema.parse({ op: "REPLACE", targetClaimId: "claim-1" });

    const result = await classify(fact, [existingClaim], { llm });
    expect(result).toEqual({ op: "REPLACE", targetClaimId: "claim-1" });
  });

  test("returns ADD when there are no similar claims", async () => {
    const llm: LLMFn = async ({ schema }) => schema.parse({ op: "ADD" });

    const result = await classify(fact, [], { llm });
    expect(result).toEqual({ op: "ADD" });
  });

  test("requires targetClaimId for UPDATE and REPLACE", async () => {
    const llm: LLMFn = async ({ schema }) => schema.parse({ op: "REPLACE" });

    await expect(classify(fact, [existingClaim], { llm })).rejects.toThrow(
      "targetClaimId is required",
    );
  });

  test("rejects targetClaimId not in similarOwnClaims", async () => {
    const llm: LLMFn = async ({ schema }) =>
      schema.parse({ op: "REPLACE", targetClaimId: "missing-claim" });

    await expect(classify(fact, [existingClaim], { llm })).rejects.toThrow(
      "invalid targetClaimId",
    );
  });
});
