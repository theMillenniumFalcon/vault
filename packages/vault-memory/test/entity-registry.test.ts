import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ENTITY_KEY_PATTERN,
  EXAMPLE_ENTITY_SEED,
  ensureEntityInRegistry,
  parseExtractedEntityKey,
  registerEntity,
  seedEntities,
  validateEntityKey,
} from "../src/entity-registry";
import { createTestDb } from "./helpers/db";
import { getSqliteDb } from "./helpers/db";
import { entities } from "../src/db/schema";

describe("entity registry", () => {
  test("validateEntityKey accepts user.* dotted paths", () => {
    expect(validateEntityKey("user.timezone")).toBe(true);
    expect(validateEntityKey("user.diet")).toBe(true);
    expect(validateEntityKey("user.schedule.prefs")).toBe(true);
    expect(validateEntityKey("User.timezone")).toBe(false);
    expect(validateEntityKey("timezone")).toBe(false);
  });

  test("parseExtractedEntityKey strips new: prefix", () => {
    expect(parseExtractedEntityKey("user.diet")).toEqual({
      key: "user.diet",
      isNew: false,
    });
    expect(parseExtractedEntityKey("new:user.hobby")).toEqual({
      key: "user.hobby",
      isNew: true,
    });
  });

  test("seedEntities registers canonical keys", async () => {
    const db = createTestDb();
    await seedEntities(db, EXAMPLE_ENTITY_SEED);

    const rows = await getSqliteDb(db).select().from(entities);
    expect(rows).toHaveLength(EXAMPLE_ENTITY_SEED.length);
    expect(rows.map((r) => r.key).sort()).toEqual(
      EXAMPLE_ENTITY_SEED.map((s) => s.key).sort(),
    );
  });

  test("registerEntity is idempotent", async () => {
    const db = createTestDb();
    await registerEntity(db, {
      key: "user.timezone",
      description: "Timezone",
    });
    await registerEntity(db, {
      key: "user.timezone",
      description: "Timezone again",
    });

    const rows = await getSqliteDb(db).select().from(entities);
    expect(rows).toHaveLength(1);
  });

  test("ensureEntityInRegistry auto-registers valid new keys", async () => {
    const db = createTestDb();
    await ensureEntityInRegistry(db, "user.hobby", {
      description: "User hobbies",
    });

    const rows = await getSqliteDb(db).select().from(entities);
    expect(rows[0]?.key).toBe("user.hobby");
  });

  test("ensureEntityInRegistry rejects unregistered keys when autoRegister is false", async () => {
    const db = createTestDb();
    await expect(
      ensureEntityInRegistry(db, "user.hobby", { autoRegister: false }),
    ).rejects.toThrow("not registered");
  });

  test("ensureEntityInRegistry rejects invalid key pattern", async () => {
    const db = createTestDb();
    await expect(
      ensureEntityInRegistry(db, "invalid-key", { autoRegister: true }),
    ).rejects.toThrow("Invalid entity key");
  });

  test("default pattern is exported", () => {
    expect(DEFAULT_ENTITY_KEY_PATTERN.test("user.mood")).toBe(true);
  });
});
