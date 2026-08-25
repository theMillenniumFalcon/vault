import { z } from "zod";
import type { LLMConfig } from "./config";
import { resolveLLM } from "./config";
import type { VaultDb } from "./db/types";
import {
  formatRegistryForPrompt,
  listRegistryEntities,
  parseExtractedEntityKey,
  resolveEntityKeyPattern,
  validateEntityKey,
} from "./entity-registry";
import type { ExtractedFact, Message } from "./types";

const extractedFactSchema = z.object({
  entity: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(["semantic", "episodic"]),
});

const extractionResponseSchema = z.object({
  facts: z.array(extractedFactSchema),
});

export type ExtractFactsConfig = LLMConfig & {
  db?: VaultDb;
  useEntityRegistry?: boolean;
  entityKeyPattern?: string;
};

const EXTRACTION_SYSTEM_PROMPT = `You extract durable facts from a single conversation turn.

Return JSON: { "facts": [{ "entity": string, "text": string, "type": "semantic" | "episodic" }] }

Rules:
- entity: a short dotted path for the subject, e.g. "user", "user.diet", "user.location", "user.job"
- text: a concise standalone fact statement
- type:
  - "semantic": stable preferences, traits, relationships, or general knowledge
  - "episodic": a specific event or time-bound occurrence
- Extract only facts explicitly stated or clearly implied in this turn
- Do not duplicate the same fact with different wording
- If there are no facts, return { "facts": [] }`;

function buildRegistryExtractionPrompt(
  registry: Array<{ key: string; description: string }>,
  keyPattern: RegExp,
): string {
  return `You extract durable facts from a single conversation turn.

Return JSON: { "facts": [{ "entity": string, "text": string, "type": "semantic" | "episodic" }] }

Known entity keys (use these exact keys when the fact matches):
${formatRegistryForPrompt(registry)}

Rules:
- entity: prefer an exact key from the known list above when the fact fits that subject
- if no known key fits, use "new:<dotted.path>" where dotted.path matches ${keyPattern.source}
- new keys must be lowercase dotted paths (e.g. new:user.schedule)
- text: a concise standalone fact statement
- type:
  - "semantic": stable preferences, traits, relationships, or general knowledge
  - "episodic": a specific event or time-bound occurrence
- Extract only facts explicitly stated or clearly implied in this turn
- Do not duplicate the same fact with different wording
- If there are no facts, return { "facts": [] }`;
}

export function getLatestTurn(messages: Message[]): Message[] {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return [];

  return messages
    .slice(lastUserIdx)
    .filter((m) => m.role === "user" || m.role === "assistant");
}

function formatTurn(messages: Message[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

async function normalizeRegistryFacts(
  facts: ExtractedFact[],
  config: ExtractFactsConfig,
): Promise<ExtractedFact[]> {
  if (!config.useEntityRegistry || !config.db) return facts;

  const pattern = resolveEntityKeyPattern(config.entityKeyPattern);
  const knownKeys = new Set(
    (await listRegistryEntities(config.db)).map((row) => row.key),
  );

  return facts.map((fact) => {
    const { key, isNew } = parseExtractedEntityKey(fact.entity);

    if (!validateEntityKey(key, pattern)) {
      throw new Error(
        `Invalid entity key "${key}". Must match pattern: ${pattern.source}`,
      );
    }

    if (!isNew && !knownKeys.has(key)) {
      throw new Error(
        `Entity "${key}" is not in the registry. Use an existing key or "new:${key}".`,
      );
    }

    return { ...fact, entity: key };
  });
}

export async function extractFacts(
  messages: Message[],
  config: ExtractFactsConfig,
): Promise<ExtractedFact[]> {
  const turn = getLatestTurn(messages);
  if (turn.length === 0) return [];

  const llm = resolveLLM(config);
  let systemPrompt = EXTRACTION_SYSTEM_PROMPT;

  if (config.useEntityRegistry) {
    if (!config.db) {
      throw new Error(
        "vault-memory: useEntityRegistry requires db on Memory config",
      );
    }
    const registry = await listRegistryEntities(config.db);
    const pattern = resolveEntityKeyPattern(config.entityKeyPattern);
    systemPrompt = buildRegistryExtractionPrompt(registry, pattern);
  }

  const response = await llm({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Extract facts from this turn only:\n\n${formatTurn(turn)}`,
      },
    ],
    schema: extractionResponseSchema,
  });

  const { facts } = extractionResponseSchema.parse(response);
  return normalizeRegistryFacts(facts, config);
}
