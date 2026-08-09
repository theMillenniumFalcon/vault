import { describe, expect, test } from "bun:test";
import type { MemoryConfig } from "../src/config";
import {
  EXAMPLE_AUTHORITY_SEED,
  entityMatchesPattern,
  getAuthority,
  resolveConflict,
  seedAuthority,
  strategyForEntity,
} from "../src/resolve";
import type { ExtractedFact, ScoredClaim } from "../src/types";
import { createTestDb, createTestVectorStore, insertAuthority } from "./helpers/db";

const fact: ExtractedFact = {
  entity: "user.timezone",
  text: "The user is in EST",
  type: "semantic",
};

function scoredClaim(
  overrides: Partial<ScoredClaim> & Pick<ScoredClaim, "id" | "sourceAgent">,
): ScoredClaim {
  return {
    entity: "user.timezone",
    text: "The user is in PST",
    type: "semantic",
    conversationId: "conv-1",
    confidence: 1,
    status: "active",
    supersedes: null,
    embedding: null,
    createdAt: new Date(),
    lastAccessedAt: null,
    score: 0.9,
    ...overrides,
  };
}

function createConfig(overrides: Partial<MemoryConfig> = {}): MemoryConfig {
  return {
    db: createTestDb(),
    vectorStore: createTestVectorStore(),
    llm: async ({ schema }) => schema.parse({}),
    ...overrides,
  };
}

describe("strategyForEntity", () => {
  test("defaults to recency", () => {
    expect(strategyForEntity("user.timezone", createConfig())).toBe("recency");
  });

  test("uses entityStrategies config", () => {
    const config = createConfig({
      entityStrategies: { "user.timezone": "authority" },
    });
    expect(strategyForEntity("user.timezone", config)).toBe("authority");
    expect(strategyForEntity("user.mood", config)).toBe("recency");
  });
});

describe("entityMatchesPattern", () => {
  test("matches exact and wildcard prefixes", () => {
    expect(entityMatchesPattern("user.timezone", "user.timezone")).toBe(true);
    expect(entityMatchesPattern("user.schedule.monday", "user.schedule.*")).toBe(
      true,
    );
    expect(entityMatchesPattern("user.mood", "user.schedule.*")).toBe(false);
    expect(entityMatchesPattern("user.time", "user.timezone")).toBe(false);
  });
});

describe("getAuthority + seedAuthority", () => {
  test("returns 0 when no authority is seeded", async () => {
    const db = createTestDb();
    expect(await getAuthority(db, "agent-a", "user.timezone")).toBe(0);
  });

  test("reads seeded weights and prefers most specific pattern", async () => {
    const db = createTestDb();
    await seedAuthority(db, [
      { entity: "user.schedule.*", agentId: "agent-a", weight: 0.5 },
      { entity: "user.schedule.monday", agentId: "agent-a", weight: 0.9 },
      { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
    ]);

    expect(await getAuthority(db, "agent-a", "user.schedule.monday")).toBe(0.9);
    expect(await getAuthority(db, "agent-a", "user.schedule.friday")).toBe(0.5);
    expect(await getAuthority(db, "agent-b", "user.timezone")).toBe(0.2);
  });
});

describe("resolveConflict", () => {
  test("recency always REPLACE-supersedes conflicts", async () => {
    const config = createConfig();
    const conflicts = [
      scoredClaim({ id: "c1", sourceAgent: "agent-a" }),
      scoredClaim({ id: "c2", sourceAgent: "agent-c" }),
    ];

    const result = await resolveConflict(
      fact,
      "agent-b",
      conflicts,
      "recency",
      config,
    );

    expect(result).toEqual({ op: "REPLACE", supersedes: ["c1", "c2"] });
  });

  test("authority: higher-weighted agent wins", async () => {
    const db = createTestDb();
    await insertAuthority(db, EXAMPLE_AUTHORITY_SEED);
    const config = createConfig({ db });

    const result = await resolveConflict(
      fact,
      "agent-a",
      [scoredClaim({ id: "b-claim", sourceAgent: "agent-b" })],
      "authority",
      config,
    );

    expect(result).toEqual({ op: "REPLACE", supersedes: ["b-claim"] });
  });

  test("authority: lower-weighted agent disputes", async () => {
    const db = createTestDb();
    await insertAuthority(db, EXAMPLE_AUTHORITY_SEED);
    const config = createConfig({ db });

    const result = await resolveConflict(
      fact,
      "agent-b",
      [scoredClaim({ id: "a-claim", sourceAgent: "agent-a" })],
      "authority",
      config,
    );

    expect(result).toEqual({ op: "DISPUTE", conflictingClaimId: "a-claim" });
  });

  test("authority: equal/missing weights dispute", async () => {
    const config = createConfig();
    const result = await resolveConflict(
      fact,
      "agent-b",
      [scoredClaim({ id: "a-claim", sourceAgent: "agent-a" })],
      "authority",
      config,
    );

    expect(result).toEqual({ op: "DISPUTE", conflictingClaimId: "a-claim" });
  });

  test("consensus and llm-judge are not implemented yet", async () => {
    const config = createConfig();
    await expect(
      resolveConflict(fact, "agent-a", [], "consensus", config),
    ).rejects.toThrow(/not implemented/);
    await expect(
      resolveConflict(fact, "agent-a", [], "llm-judge", config),
    ).rejects.toThrow(/not implemented/);
  });
});
