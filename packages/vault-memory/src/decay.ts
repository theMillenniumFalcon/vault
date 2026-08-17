import type { Claim } from "./types";

const MS_PER_DAY = 86_400_000;
/** ~30-day half-life; tune later. */
const DECAY_HALF_LIFE_DAYS = 30;

/**
 * Apply recency decay to a vector similarity score at search time.
 * Does not mutate stored confidence — only affects ranking for this query.
 */
export function recencyWeightedScore(
  claim: Claim,
  baseScore: number,
  now: number = Date.now(),
): number {
  const accessedAt = claim.lastAccessedAt ?? claim.createdAt;
  const daysSinceAccess = (now - accessedAt.getTime()) / MS_PER_DAY;
  const decayFactor = Math.exp(-daysSinceAccess / DECAY_HALF_LIFE_DAYS);
  return baseScore * decayFactor;
}
