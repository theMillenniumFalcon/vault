import { z } from "zod";
import type { LLMConfig, ResolvedMemoryConfig } from "./config";
import { resolveLLM } from "./config";
import { getClaimRow } from "./search";
import type { ExtractedFact } from "./types";
import { withActiveFilter } from "./vector-store/utils";

/** Auto-align when similarity is at or above this score (no LLM). */
export const DEFAULT_ENTITY_MATCH_THRESHOLD = 0.85;

/** Minimum similarity to consider LLM disambiguation in the borderline band. */
export const DEFAULT_ENTITY_DISAMBIGUATION_THRESHOLD = 0.70;

export type EntityResolverFn = (
  fact: ExtractedFact,
  embedding: number[],
  config: ResolvedMemoryConfig,
) => Promise<ExtractedFact>;

type EntityCandidate = {
  claimId: string;
  entity: string;
  text: string;
  score: number;
};

const ENTITY_DISAMBIGUATION_SYSTEM_PROMPT = `You decide whether a newly extracted fact belongs to an existing entity key or should keep its extracted entity label.

Return JSON: { "entity": string }

Rules:
- "entity" must be exactly one of the allowed entity keys provided (extracted entity or a candidate entity)
- Align to a candidate entity when the new fact is about the same real-world subject as that candidate
- Keep the extracted entity when the new fact is genuinely a different subject, even if wording is similar
- Prefer an existing candidate entity over inventing a new label when subjects match`;

function canUseEntityLlm(config: ResolvedMemoryConfig): boolean {
  if (config.entityResolutionUseLlm === false) return false;
  return Boolean(config.llm || config.apiKey);
}

function formatCandidates(candidates: EntityCandidate[]): string {
  if (candidates.length === 0) return "None";
  return candidates
    .map(
      (c) =>
        `- entity: ${c.entity}\n  text: ${c.text}\n  similarity: ${c.score.toFixed(3)}`,
    )
    .join("\n");
}

async function loadCandidates(
  config: ResolvedMemoryConfig,
  hits: Array<{ claimId: string; score: number }>,
  minScore: number,
): Promise<EntityCandidate[]> {
  const candidates: EntityCandidate[] = [];
  for (const hit of hits) {
    if (hit.score < minScore) continue;
    const row = await getClaimRow(config.db, hit.claimId);
    candidates.push({
      claimId: hit.claimId,
      entity: row.entity,
      text: row.text,
      score: hit.score,
    });
  }
  return candidates;
}

function buildDisambiguationSchema(
  fact: ExtractedFact,
  candidates: EntityCandidate[],
) {
  const allowed = new Set([
    fact.entity,
    ...candidates.map((candidate) => candidate.entity),
  ]);

  return z
    .object({
      entity: z.string().min(1),
    })
    .superRefine((value, ctx) => {
      if (!allowed.has(value.entity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `entity must be one of: ${[...allowed].join(", ")}`,
          path: ["entity"],
        });
      }
    });
}

export async function disambiguateEntityWithLlm(
  fact: ExtractedFact,
  candidates: EntityCandidate[],
  config: LLMConfig,
): Promise<ExtractedFact> {
  if (candidates.length === 0) return fact;

  const llm = resolveLLM(config);
  const schema = buildDisambiguationSchema(fact, candidates);
  const response = await llm({
    messages: [
      { role: "system", content: ENTITY_DISAMBIGUATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          "New fact:",
          `entity: ${fact.entity}`,
          `text: ${fact.text}`,
          `type: ${fact.type}`,
          "",
          "Candidate existing claims (similarity search):",
          formatCandidates(candidates),
          "",
          `Allowed entity keys: ${[fact.entity, ...new Set(candidates.map((c) => c.entity))].join(", ")}`,
        ].join("\n"),
      },
    ],
    schema,
  });

  const { entity } = schema.parse(response);
  return { ...fact, entity };
}

/**
 * Align extracted entity with an existing active claim when fact text is
 * semantically similar. High confidence: auto-align. Borderline: optional LLM.
 */
export async function resolveEntity(
  fact: ExtractedFact,
  embedding: number[],
  config: ResolvedMemoryConfig,
): Promise<ExtractedFact> {
  const highThreshold =
    config.entityMatchThreshold ?? DEFAULT_ENTITY_MATCH_THRESHOLD;
  if (highThreshold <= 0) return fact;

  const lowThreshold =
    config.entityDisambiguationThreshold ??
    DEFAULT_ENTITY_DISAMBIGUATION_THRESHOLD;

  const hits = await config.vectorStore.search(embedding, {
    limit: 5,
    filter: withActiveFilter({ status: "active" }),
  });

  const topHit = hits[0];
  if (!topHit) return fact;

  const incumbent = await getClaimRow(config.db, topHit.claimId);
  if (incumbent.entity === fact.entity) return fact;

  if (topHit.score >= highThreshold) {
    return { ...fact, entity: incumbent.entity };
  }

  if (topHit.score < lowThreshold) return fact;

  if (!canUseEntityLlm(config)) return fact;

  const candidates = await loadCandidates(config, hits, lowThreshold);
  return disambiguateEntityWithLlm(fact, candidates, config);
}

/** @deprecated Use resolveEntity — kept as alias for config hook naming. */
export const defaultResolveEntity = resolveEntity;
