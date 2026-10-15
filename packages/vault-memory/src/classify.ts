import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { LLMConfig, ResolvedMemoryConfig } from "./config";
import { resolveLLM } from "./config";
import { claims } from "./db/schema";
import type { VaultDb } from "./db/types";
import { resolveConflict, strategyForEntity, toCrossAgentClassifyResult } from "./resolve";
import { rowToClaim, searchOwnClaims } from "./search";
import type {
  Claim,
  ClassifyResult,
  CrossAgentClassifyResult,
  CrossAgentRelation,
  ExtractedFact,
  ScoredClaim,
} from "./types";

const classifyResponseSchema = z
  .object({
    op: z.enum(["ADD", "UPDATE", "REPLACE", "NOOP"]),
    targetClaimId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.op === "UPDATE" || value.op === "REPLACE") &&
      !value.targetClaimId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `targetClaimId is required for ${value.op}`,
        path: ["targetClaimId"],
      });
    }
  });

const CLASSIFY_SYSTEM_PROMPT = `You classify how a new fact relates to existing claims from the same agent.

Return JSON: { "op": "ADD" | "UPDATE" | "REPLACE" | "NOOP", "targetClaimId"?: string }

Operations:
- ADD: genuinely new information with no close match among existing claims
- UPDATE: elaborates or refines an existing claim without contradicting it
- REPLACE: contradicts or supersedes an existing claim (e.g. "vegetarian" -> "eats meat")
- NOOP: restates something already stored; no change needed

Rules:
- targetClaimId is required for UPDATE and REPLACE
- targetClaimId must be one of the provided existing claim ids
- Prefer NOOP when the new fact is semantically equivalent to an existing claim
- Prefer REPLACE over ADD when the new fact conflicts with an existing claim`;

function formatExistingClaims(claims: Claim[]): string {
  if (claims.length === 0) return "None";
  return claims
    .map(
      (c) =>
        `- id: ${c.id}\n  entity: ${c.entity}\n  text: ${c.text}\n  type: ${c.type}`,
    )
    .join("\n");
}

export async function classify(
  fact: ExtractedFact,
  similarOwnClaims: Claim[],
  config: LLMConfig,
): Promise<ClassifyResult> {
  const llm = resolveLLM(config);
  const response = await llm({
    messages: [
      { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          "New fact:",
          `entity: ${fact.entity}`,
          `text: ${fact.text}`,
          `type: ${fact.type}`,
          "",
          "Existing claims from this agent:",
          formatExistingClaims(similarOwnClaims),
        ].join("\n"),
      },
    ],
    schema: classifyResponseSchema,
  });

  const result = classifyResponseSchema.parse(response);

  if (result.targetClaimId) {
    const validIds = new Set(similarOwnClaims.map((c) => c.id));
    if (!validIds.has(result.targetClaimId)) {
      throw new Error(
        `classify returned invalid targetClaimId: ${result.targetClaimId}`,
      );
    }
  }

  return result;
}

export async function classifyAgainstOwnHistory(
  fact: ExtractedFact,
  agentId: string,
  embedding: number[],
  config: ResolvedMemoryConfig,
): Promise<ClassifyResult> {
  const similarOwnClaims = await searchOwnClaims(
    config.db,
    config.vectorStore,
    agentId,
    embedding,
    5,
  );
  return classify(fact, similarOwnClaims, config);
}

const CROSS_AGENT_RELATION_PROMPT = `You compare a new fact with existing claims from other agents about the same entity.

Return JSON: { "relations": [{ "claimId": string, "relation": "equivalent" | "compatible" | "contradicts" }] }

Relations:
- equivalent: the new fact states the same thing as this claim
- compatible: both can be true at the same time (different details about the same subject)
- contradicts: they cannot both be true

Rules:
- Include exactly one relation for every provided claim id
- claimId must be one of the provided ids
- Use contradicts only when the facts conflict, not merely because they share a subject
- Prefer compatible when both facts can be true
- Prefer equivalent when the new fact restates a claim`;

function relationResponseSchema(claimIds: string[]) {
  const allowed = new Set(claimIds);
  return z
    .object({
      relations: z.array(
        z.object({
          claimId: z.string(),
          relation: z.enum(["equivalent", "compatible", "contradicts"]),
        }),
      ),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>();
      for (const relation of value.relations) {
        if (!allowed.has(relation.claimId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `unknown claimId: ${relation.claimId}`,
            path: ["relations"],
          });
        }
        if (seen.has(relation.claimId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate claimId: ${relation.claimId}`,
            path: ["relations"],
          });
        }
        seen.add(relation.claimId);
      }
      for (const claimId of claimIds) {
        if (!seen.has(claimId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `missing claimId: ${claimId}`,
            path: ["relations"],
          });
        }
      }
    });
}

/** Active claims on this entity written by agents other than `agentId`. */
export async function listOtherAgentEntityClaims(
  db: VaultDb,
  entity: string,
  agentId: string,
): Promise<Claim[]> {
  const rows = await db
    .select()
    .from(claims)
    .where(
      and(
        eq(claims.entity, entity),
        eq(claims.status, "active"),
        ne(claims.sourceAgent, agentId),
      )!,
    );

  return rows
    .map(rowToClaim)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function labelCrossAgentClaims(
  fact: ExtractedFact,
  otherClaims: Claim[],
  config: LLMConfig,
): Promise<Array<{ claimId: string; relation: CrossAgentRelation }>> {
  if (otherClaims.length === 0) return [];

  const llm = resolveLLM(config);
  const schema = relationResponseSchema(otherClaims.map((claim) => claim.id));
  const response = await llm({
    messages: [
      { role: "system", content: CROSS_AGENT_RELATION_PROMPT },
      {
        role: "user",
        content: [
          "New fact:",
          `entity: ${fact.entity}`,
          `text: ${fact.text}`,
          `type: ${fact.type}`,
          "",
          "Existing claims from other agents:",
          formatExistingClaims(otherClaims),
        ].join("\n"),
      },
    ],
    schema,
  });

  return schema.parse(response).relations;
}

export async function classifyAgainstOtherAgents(
  fact: ExtractedFact,
  agentId: string,
  _embedding: number[],
  config: ResolvedMemoryConfig,
): Promise<CrossAgentClassifyResult> {
  const otherClaims = await listOtherAgentEntityClaims(
    config.db,
    fact.entity,
    agentId,
  );
  if (otherClaims.length === 0) return { op: "ADD" };

  const relations = await labelCrossAgentClaims(fact, otherClaims, config);
  const relationById = new Map(
    relations.map((relation) => [relation.claimId, relation.relation]),
  );
  const contradicting = otherClaims.filter(
    (claim) => relationById.get(claim.id) === "contradicts",
  );

  if (contradicting.length > 0) {
    const conflicts: ScoredClaim[] = contradicting.map((claim) => ({
      ...claim,
      score: 1,
    }));
    const strategy = strategyForEntity(fact.entity, config);
    const resolution = await resolveConflict(
      fact,
      agentId,
      conflicts,
      strategy,
      config,
    );
    return toCrossAgentClassifyResult(resolution);
  }

  const equivalent = otherClaims.some(
    (claim) => relationById.get(claim.id) === "equivalent",
  );
  return equivalent ? { op: "NOOP" } : { op: "ADD" };
}
