import { z } from "zod";
import type { LLMConfig } from "./config";
import { resolveLLM } from "./config";
import type { ExtractedFact, Message } from "./types";

const extractedFactSchema = z.object({
  entity: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(["semantic", "episodic"]),
});

const extractionResponseSchema = z.object({
  facts: z.array(extractedFactSchema),
});

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

export async function extractFacts(
  messages: Message[],
  config: LLMConfig,
): Promise<ExtractedFact[]> {
  const turn = getLatestTurn(messages);
  if (turn.length === 0) return [];

  const llm = resolveLLM(config);
  const response = await llm({
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract facts from this turn only:\n\n${formatTurn(turn)}`,
      },
    ],
    schema: extractionResponseSchema,
  });

  const { facts } = extractionResponseSchema.parse(response);
  return facts;
}
