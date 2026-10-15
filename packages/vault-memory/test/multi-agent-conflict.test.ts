import { describe, expect, test } from "bun:test";
import type { LLMFn } from "../src/config";
import { disputes } from "../src/db/schema";
import { Memory } from "../src/memory";
import { EXAMPLE_AUTHORITY_SEED, seedAuthority } from "../src/resolve";
import { search } from "../src/search";
import {
  createAgentMemory,
  createHarnessEmbed,
} from "./helpers/conflict-harness";
import {
  createTestDb,
  createTestVectorStore,
  getSqliteDb,
  insertAuthority,
  listClaims,
  listDisputes,
} from "./helpers/db";

describe("multi-agent conflict harness", () => {
  test("authority strategy: higher-weighted agent wins on timezone conflict", async () => {
    const db = createTestDb();
    const vectorStore = createTestVectorStore();
      await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);

      const agentA = createAgentMemory(
        "agent-a",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );
      const agentB = createAgentMemory(
        "agent-b",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in EST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );

      await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
      const { added: bAdded } = await agentB.add(
        [{ role: "user", content: "I'm in EST" }],
        "conv1",
      );

      expect(bAdded[0]?.status).toBe("disputed");

      const result = await search(
        db,
        vectorStore,
        createHarnessEmbed(),
        "what timezone is the user in?",
        { status: "active", limit: 5 },
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.sourceAgent).toBe("agent-a");
      expect(result[0]?.text).toContain("PST");

      const disputeRows = await listDisputes(db);
      expect(disputeRows).toHaveLength(1);
      expect(disputeRows[0]?.resolutionStrategy).toBe("authority");
    });

    test("authority strategy: lower-weighted agent loses → DISPUTE", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();
      await insertAuthority(db, EXAMPLE_AUTHORITY_SEED);

      const agentA = createAgentMemory(
        "agent-a",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );
      const agentB = createAgentMemory(
        "agent-b",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in EST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );

      await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
      const { added } = await agentB.add(
        [{ role: "user", content: "I'm in EST" }],
        "conv1",
      );

      expect(added).toHaveLength(1);
      expect(added[0]?.status).toBe("disputed");
      expect(added[0]?.text).toContain("EST");

      const rows = await listClaims(db);
      const aClaim = rows.find((row) => row.sourceAgent === "agent-a");
      const bClaim = rows.find((row) => row.id === added[0]?.id);
      expect(aClaim?.status).toBe("active");
      expect(bClaim?.status).toBe("disputed");

      const disputeRows = await getSqliteDb(db).select().from(disputes);
      expect(disputeRows).toHaveLength(1);
      expect(disputeRows[0]?.claimAId).toBe(added[0]?.id);
      expect(disputeRows[0]?.claimBId).toBe(aClaim?.id ?? "");
    });

    test("no authority config for entity → falls back to recency", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();
      // Authority seeded for timezone/mood only — diet has none, and no entityStrategies.

      const agentA = createAgentMemory("agent-a", db, vectorStore, [
        {
          entity: "user.diet",
          text: "The user is vegetarian",
          type: "semantic",
        },
      ]);
      const agentB = createAgentMemory("agent-b", db, vectorStore, [
        {
          entity: "user.diet",
          text: "The user eats meat",
          type: "semantic",
        },
      ]);

      await agentA.add([{ role: "user", content: "I'm vegetarian" }], "conv1");
      const { added } = await agentB.add(
        [{ role: "user", content: "I eat meat" }],
        "conv1",
      );

      expect(added[0]?.status).toBe("active");
      expect(added[0]?.sourceAgent).toBe("agent-b");

      const rows = await listClaims(db);
      expect(rows.find((row) => row.sourceAgent === "agent-a")?.status).toBe(
        "superseded",
      );
      expect(await listDisputes(db)).toHaveLength(0);

      const result = await search(
        db,
        vectorStore,
        createHarnessEmbed(),
        "what does the user eat?",
        { status: "active", limit: 5 },
      );
      expect(result[0]?.text).toContain("meat");
      expect(result[0]?.sourceAgent).toBe("agent-b");
    });

    test("same-entity different wording still conflicts via entity filter", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();
      await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);

      const agentA = createAgentMemory(
        "agent-a",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user lives in the Pacific Time zone (PST)",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );
      const agentB = createAgentMemory(
        "agent-b",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "User is currently on Eastern Standard Time",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );

      await agentA.add(
        [{ role: "user", content: "I live in Pacific Time" }],
        "conv1",
      );
      const { added } = await agentB.add(
        [{ role: "user", content: "I'm on Eastern Standard Time" }],
        "conv1",
      );

      // The scripted cross-agent label is "contradicts", so different wording
      // still disputes when the model says the facts cannot both be true.
      expect(added[0]?.status).toBe("disputed");

      const result = await search(
        db,
        vectorStore,
        createHarnessEmbed(),
        "timezone pacific",
        { entity: "user.timezone", status: "active", limit: 5 },
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.sourceAgent).toBe("agent-a");
      expect(result[0]?.text.toLowerCase()).toContain("pacific");
    });

    test("deliberately ambiguous: equal authority → DISPUTE", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();
      await insertAuthority(db, [
        { entity: "user.timezone", agentId: "agent-a", weight: 0.5 },
        { entity: "user.timezone", agentId: "agent-b", weight: 0.5 },
      ]);

      const agentA = createAgentMemory(
        "agent-a",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );
      const agentB = createAgentMemory(
        "agent-b",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in EST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );

      await agentA.add([{ role: "user", content: "I'm in PST" }], "conv1");
      const { added } = await agentB.add(
        [{ role: "user", content: "I'm in EST" }],
        "conv1",
      );

      // Equal weights cannot beatAll (strict >), so we dispute.
      // App layer resolves via listOpenDisputes + resolveDispute.
      expect(added[0]?.status).toBe("disputed");
      expect(await listDisputes(db)).toHaveLength(1);

      const active = await search(
        db,
        vectorStore,
        createHarnessEmbed(),
        "what timezone is the user in?",
        { status: "active", limit: 5 },
      );
      expect(active[0]?.sourceAgent).toBe("agent-a");
      expect(active[0]?.text).toContain("PST");
    });

    test("agreeing agents do not store a duplicate", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();

      const agentA = createAgentMemory("agent-a", db, vectorStore, [
        {
          entity: "user.mood",
          text: "The user is happy",
          type: "semantic",
        },
      ]);
      const agentBLlm: LLMFn = async ({ messages, schema }) => {
        const facts = schema.safeParse({
          facts: [
            {
              entity: "user.mood",
              text: "The user is happy",
              type: "semantic",
            },
          ],
        });
        if (facts.success) return facts.data;

        const own = schema.safeParse({ op: "ADD" });
        if (own.success) return own.data;

        const user = messages.find((message) => message.role === "user")?.content ?? "";
        const ids = [...user.matchAll(/^- id: (.+)$/gm)].map((match) => match[1]!.trim());
        return schema.parse({
          relations: ids.map((claimId) => ({ claimId, relation: "equivalent" })),
        });
      };
      const agentB = new Memory("agent-b", {
        db,
        vectorStore,
        llm: agentBLlm,
        embed: createHarnessEmbed(),
      });

      await agentA.add([{ role: "user", content: "I'm happy" }], "conv1");
      const { added } = await agentB.add(
        [{ role: "user", content: "feeling happy today" }],
        "conv1",
      );

      expect(added).toHaveLength(0);
      const rows = await listClaims(db);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("active");
      expect(rows[0]?.sourceAgent).toBe("agent-a");
      expect(await listDisputes(db)).toHaveLength(0);
    });

    test("compatible facts on the same entity both stay active", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();

      const agentA = createAgentMemory("agent-a", db, vectorStore, [
        {
          entity: "user.diet",
          text: "The user is vegetarian",
          type: "semantic",
        },
      ]);
      const agentBLlm: LLMFn = async ({ messages, schema }) => {
        const facts = schema.safeParse({
          facts: [
            {
              entity: "user.diet",
              text: "The user likes Italian food",
              type: "semantic",
            },
          ],
        });
        if (facts.success) return facts.data;

        const own = schema.safeParse({ op: "ADD" });
        if (own.success) return own.data;

        const user = messages.find((message) => message.role === "user")?.content ?? "";
        const ids = [...user.matchAll(/^- id: (.+)$/gm)].map((match) => match[1]!.trim());
        return schema.parse({
          relations: ids.map((claimId) => ({ claimId, relation: "compatible" })),
        });
      };
      const agentB = new Memory("agent-b", {
        db,
        vectorStore,
        llm: agentBLlm,
        embed: createHarnessEmbed(),
      });

      await agentA.add([{ role: "user", content: "I'm vegetarian" }], "conv1");
      const { added } = await agentB.add(
        [{ role: "user", content: "I like Italian food" }],
        "conv1",
      );

      expect(added).toHaveLength(1);
      expect(added[0]?.status).toBe("active");
      expect(added[0]?.text).toContain("Italian");

      const rows = await listClaims(db);
      expect(rows.every((row) => row.status === "active")).toBe(true);
      expect(rows).toHaveLength(2);
      expect(await listDisputes(db)).toHaveLength(0);
    });

    test("authority win via REPLACE when higher-weighted agent writes second", async () => {
      const db = createTestDb();
      const vectorStore = createTestVectorStore();
      await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);

      const agentB = createAgentMemory(
        "agent-b",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in EST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );
      const agentA = createAgentMemory(
        "agent-a",
        db,
        vectorStore,
        [
          {
            entity: "user.timezone",
            text: "The user is in PST",
            type: "semantic",
          },
        ],
        { entityStrategies: { "user.timezone": "authority" } },
      );

      await agentB.add([{ role: "user", content: "I'm in EST" }], "conv1");
      const { added } = await agentA.add(
        [{ role: "user", content: "I'm in PST" }],
        "conv1",
      );

      expect(added[0]?.status).toBe("active");
      expect(added[0]?.sourceAgent).toBe("agent-a");
      expect(added[0]?.text).toContain("PST");

      const rows = await listClaims(db);
      expect(rows.find((row) => row.sourceAgent === "agent-b")?.status).toBe(
        "superseded",
      );

      const result = await search(
        db,
        vectorStore,
        createHarnessEmbed(),
        "what timezone is the user in?",
        { status: "active", limit: 5 },
      );
      expect(result[0]?.sourceAgent).toBe("agent-a");
      expect(result[0]?.text).toContain("PST");
    });
});
