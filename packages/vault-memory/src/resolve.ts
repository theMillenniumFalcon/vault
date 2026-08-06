import type { MemoryConfig } from "./config";
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
  _fact: ExtractedFact,
  _agentId: string,
  _conflicts: ScoredClaim[],
  _config: MemoryConfig,
): Promise<Resolution> {
  throw new Error("authority strategy not implemented yet");
}

export function toCrossAgentClassifyResult(
  resolution: Resolution,
): CrossAgentClassifyResult {
  return resolution;
}
