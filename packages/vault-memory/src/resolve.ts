import { eq } from "drizzle-orm";
import type { MemoryConfig } from "./config";
import { agentAuthority } from "./db/schema";
import type { VaultDb } from "./db/types";
import type { CrossAgentClassifyResult, ExtractedFact, ScoredClaim } from "./types";

export type ResolutionStrategy =
  | "recency"
  | "authority"
  | "consensus"
  | "llm-judge";

export type Resolution =
  | { op: "ADD" }
  | { op: "REPLACE"; supersedes: string[] }
  | { op: "DISPUTE"; conflictingClaimId: string };

export type AuthoritySeed = {
  entity: string;
  agentId: string;
  weight: number;
};

/** Example seed from plan §4 — scheduling vs casual-chat domains. */
export const EXAMPLE_AUTHORITY_SEED: AuthoritySeed[] = [
  { entity: "user.timezone", agentId: "agent-a", weight: 0.9 },
  { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
  { entity: "user.mood", agentId: "agent-b", weight: 0.8 },
  { entity: "user.mood", agentId: "agent-a", weight: 0.3 },
];

export function strategyForEntity(
  entity: string,
  config: MemoryConfig,
): ResolutionStrategy {
  return config.entityStrategies?.[entity] ?? "recency";
}

export async function resolveConflict(
  fact: ExtractedFact,
  agentId: string,
  conflicts: ScoredClaim[],
  strategy: ResolutionStrategy,
  config: MemoryConfig,
): Promise<Resolution> {
  switch (strategy) {
    case "recency":
      return resolveRecency(fact, conflicts);
    case "authority":
      return resolveAuthority(fact, agentId, conflicts, config);
    default:
      throw new Error(`Resolution strategy not implemented: ${strategy}`);
  }
}

function resolveRecency(
  _fact: ExtractedFact,
  conflicts: ScoredClaim[],
): Resolution {
  return { op: "REPLACE", supersedes: conflicts.map((claim) => claim.id) };
}

async function resolveAuthority(
  fact: ExtractedFact,
  agentId: string,
  conflicts: ScoredClaim[],
  config: MemoryConfig,
): Promise<Resolution> {
  if (conflicts.length === 0) {
    return { op: "ADD" };
  }

  const myWeight = await getAuthority(config.db, agentId, fact.entity);
  const beatsAll = (
    await Promise.all(
      conflicts.map(async (conflict) => {
        const theirWeight = await getAuthority(
          config.db,
          conflict.sourceAgent,
          fact.entity,
        );
        return myWeight > theirWeight;
      }),
    )
  ).every(Boolean);

  return beatsAll
    ? { op: "REPLACE", supersedes: conflicts.map((claim) => claim.id) }
    : { op: "DISPUTE", conflictingClaimId: conflicts[0]!.id };
}

/**
 * Look up authority weight for an agent on an entity.
 * Supports exact matches and prefix wildcards (`user.schedule.*`).
 * When multiple patterns match, the most specific wins. Default: 0.
 */
export async function getAuthority(
  db: VaultDb,
  agentId: string,
  entity: string,
): Promise<number> {
  const rows = await db
    .select()
    .from(agentAuthority)
    .where(eq(agentAuthority.agentId, agentId));

  let bestWeight = 0;
  let bestSpecificity = -1;

  for (const row of rows) {
    if (!entityMatchesPattern(entity, row.entity)) continue;
    const specificity = patternSpecificity(row.entity);
    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      bestWeight = row.weight;
    }
  }

  return bestWeight;
}

export function entityMatchesPattern(entity: string, pattern: string): boolean {
  if (pattern === entity) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1); // keep trailing "."
    return entity.startsWith(prefix);
  }
  return false;
}

function patternSpecificity(pattern: string): number {
  // Exact patterns outrank wildcards of similar length.
  if (pattern.endsWith(".*")) return pattern.length;
  return pattern.length + 1_000;
}

export async function seedAuthority(
  db: VaultDb,
  seeds: AuthoritySeed[],
): Promise<void> {
  for (const seed of seeds) {
    await db.insert(agentAuthority).values({
      id: crypto.randomUUID(),
      entity: seed.entity,
      agentId: seed.agentId,
      weight: seed.weight,
    });
  }
}

export function toCrossAgentClassifyResult(
  resolution: Resolution,
): CrossAgentClassifyResult {
  return resolution;
}
