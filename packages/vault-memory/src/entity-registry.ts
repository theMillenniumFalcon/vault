import { entities } from "./db/schema";
import type { EntityInsert, EntityRow, VaultDb } from "./db/types";

/** Default pattern for new entity keys when registry is enabled. */
export const DEFAULT_ENTITY_KEY_PATTERN = /^user\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export type EntitySeed = {
  key: string;
  description: string;
  aliases?: string[];
};

/** Example registry for demos — mirrors common harness entities. */
export const EXAMPLE_ENTITY_SEED: EntitySeed[] = [
  { key: "user.timezone", description: "User timezone or geographic location" },
  { key: "user.diet", description: "Dietary preferences and restrictions" },
  { key: "user.mood", description: "User mood or emotional state" },
];

export function validateEntityKey(
  key: string,
  pattern: RegExp = DEFAULT_ENTITY_KEY_PATTERN,
): boolean {
  return pattern.test(key);
}

export function parseExtractedEntityKey(raw: string): {
  key: string;
  isNew: boolean;
} {
  const trimmed = raw.trim();
  if (trimmed.startsWith("new:")) {
    return { key: trimmed.slice(4).trim(), isNew: true };
  }
  return { key: trimmed, isNew: false };
}

export async function listRegistryEntities(db: VaultDb): Promise<EntityRow[]> {
  return db.select().from(entities);
}

export async function getRegistryEntity(
  db: VaultDb,
  key: string,
): Promise<EntityRow | null> {
  const rows = await listRegistryEntities(db);
  return rows.find((row) => row.key === key) ?? null;
}

export async function registerEntity(
  db: VaultDb,
  seed: EntitySeed,
): Promise<void> {
  const existing = await getRegistryEntity(db, seed.key);
  if (existing) return;

  await db.insert(entities).values({
    id: crypto.randomUUID(),
    key: seed.key,
    description: seed.description,
    aliases: seed.aliases ? JSON.stringify(seed.aliases) : null,
    createdAt: new Date(),
  });
}

export async function seedEntities(
  db: VaultDb,
  seeds: EntitySeed[],
): Promise<void> {
  for (const seed of seeds) {
    await registerEntity(db, seed);
  }
}

export function formatRegistryForPrompt(
  registry: Array<{ key: string; description: string }>,
): string {
  if (registry.length === 0) {
    return "None yet — use new:<dotted.path> for every entity.";
  }
  return registry
    .map((row) => `- ${row.key}: ${row.description}`)
    .join("\n");
}

export type EnsureEntityOptions = {
  autoRegister?: boolean;
  description?: string;
  pattern?: RegExp;
};

/**
 * Ensure entity key exists in registry when {@link useEntityRegistry} is on.
 * Auto-registers new keys when allowed and pattern-valid.
 */
export async function ensureEntityInRegistry(
  db: VaultDb,
  key: string,
  opts: EnsureEntityOptions = {},
): Promise<void> {
  const existing = await getRegistryEntity(db, key);
  if (existing) return;

  const autoRegister = opts.autoRegister ?? true;
  const pattern = opts.pattern ?? DEFAULT_ENTITY_KEY_PATTERN;

  if (!autoRegister) {
    throw new Error(
      `Entity "${key}" is not registered. Seed the registry or enable entityRegistryAutoRegister.`,
    );
  }

  if (!validateEntityKey(key, pattern)) {
    throw new Error(
      `Invalid entity key "${key}". Must match pattern: ${pattern.source}`,
    );
  }

  await registerEntity(db, {
    key,
    description: opts.description ?? key,
  });
}

export function resolveEntityKeyPattern(pattern?: string): RegExp {
  if (!pattern) return DEFAULT_ENTITY_KEY_PATTERN;
  return new RegExp(pattern);
}
