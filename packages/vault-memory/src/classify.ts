import { z } from "zod";
import type { LLMConfig, MemoryConfig } from "./config";
import { resolveLLM } from "./config";
import { resolveConflict, strategyForEntity, toCrossAgentClassifyResult } from "./resolve";
import { searchClaims, searchOwnClaims } from "./search";
import type {
  Claim,
  ClassifyResult,
  CrossAgentClassifyResult,
  ExtractedFact,
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
  config: MemoryConfig,
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

export async function classifyAgainstOtherAgents(
  fact: ExtractedFact,
  agentId: string,
  embedding: number[],
  config: MemoryConfig,
): Promise<CrossAgentClassifyResult> {
  const crossAgent = await searchClaims(
    config.db,
    config.vectorStore,
    embedding,
    {
      excludeAgent: agentId,
      entity: fact.entity,
      status: "active",
      limit: 5,
    },
  );

  if (crossAgent.length === 0) return { op: "ADD" };

  const strategy = strategyForEntity(fact.entity, config);
  const resolution = await resolveConflict(
    fact,
    agentId,
    crossAgent,
    strategy,
    config,
  );
  return toCrossAgentClassifyResult(resolution);
}
