import type { LLMMessage } from "../../src/config";

type ScriptedSchema<T> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false; error: unknown };
  parse: (value: unknown) => T;
};

/**
 * Accept a pass-1 classify payload when it matches the schema.
 * Otherwise treat the prompt's claim ids as cross-agent contradictions,
 * which is what older tests assumed for any same-entity hit.
 */
export function scriptedMemoryResponse<T>(
  schema: ScriptedSchema<T>,
  messages: LLMMessage[],
  value: unknown,
): T {
  const direct = schema.safeParse(value);
  if (direct.success) return direct.data;

  const user = messages.find((message) => message.role === "user")?.content ?? "";
  const ids = [...user.matchAll(/^- id: (.+)$/gm)].map((match) => match[1]!.trim());
  return schema.parse({
    relations: ids.map((claimId) => ({ claimId, relation: "contradicts" })),
  });
}
