import type { ResolvedMemoryConfig } from "./config";
import { getClaimRow } from "./search";
import type { ExtractedFact } from "./types";
import { withActiveFilter } from "./vector-store/utils";

/** Minimum cosine similarity to align a new fact with an existing claim's entity. */
export const DEFAULT_ENTITY_MATCH_THRESHOLD = 0.85;

export type EntityResolverFn = (
  fact: ExtractedFact,
  embedding: number[],
  config: ResolvedMemoryConfig,
) => Promise<ExtractedFact>;

/**
 * Align extracted entity with an existing active claim when fact text is
 * semantically similar. Uses raw vector scores (no recency decay).
 */
export async function resolveEntity(
  fact: ExtractedFact,
  embedding: number[],
  config: ResolvedMemoryConfig,
): Promise<ExtractedFact> {
  const threshold =
    config.entityMatchThreshold ?? DEFAULT_ENTITY_MATCH_THRESHOLD;
  if (threshold <= 0) return fact;

  const hits = await config.vectorStore.search(embedding, {
    limit: 5,
    filter: withActiveFilter({ status: "active" }),
  });

  const topHit = hits[0];
  if (!topHit || topHit.score < threshold) return fact;

  const incumbent = await getClaimRow(config.db, topHit.claimId);
  if (incumbent.entity === fact.entity) return fact;

  return { ...fact, entity: incumbent.entity };
}

/** @deprecated Use resolveEntity — kept as alias for config hook naming. */
export const defaultResolveEntity = resolveEntity;
