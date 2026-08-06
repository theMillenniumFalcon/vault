import { and, eq } from "drizzle-orm";
import type { MemoryConfig } from "./config";
import { claims } from "./db/schema";
import type { EmbedFn } from "./embed";
import { resolveEmbed } from "./embed";
import { classify } from "./classify";
import { extractFacts } from "./extract";
import { applyOp } from "./ops";
import { search as searchClaims, searchOwnClaims } from "./search";
import type { Claim, Message, ScoredClaim, SearchOpts } from "./types";

function agentClaimFilter(claimId: string, agentId: string) {
  return and(eq(claims.id, claimId), eq(claims.sourceAgent, agentId))!;
}

export class Memory {
  private readonly embed: EmbedFn;

  constructor(
    private readonly agentId: string,
    private readonly config: MemoryConfig,
  ) {
    this.embed = resolveEmbed(config);
  }

  async add(
    messages: Message[],
    conversationId: string,
  ): Promise<{ added: Claim[] }> {
    const facts = await extractFacts(messages, this.config);
    const results: Claim[] = [];

    for (const fact of facts) {
      const embedding = await this.embed(fact.text);
      const similar = await searchOwnClaims(
        this.config.db,
        this.agentId,
        embedding,
        5,
      );
      const { op, targetClaimId } = await classify(
        fact,
        similar,
        this.config,
      );

      if (op === "NOOP") continue;

      results.push(
        await applyOp(
          this.config.db,
          op,
          fact,
          embedding,
          targetClaimId,
          this.agentId,
          conversationId,
        ),
      );
    }

    return { added: results };
  }

  async search(query: string, opts?: SearchOpts): Promise<ScoredClaim[]> {
    return searchClaims(this.config.db, this.embed, query, {
      ...opts,
      sourceAgent: opts?.sourceAgent ?? this.agentId,
    });
  }

  async update(claimId: string, text: string): Promise<void> {
    const existing = await this.config.db
      .select()
      .from(claims)
      .where(agentClaimFilter(claimId, this.agentId));

    if (existing.length === 0) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    const embedding = await this.embed(text);
    await this.config.db
      .update(claims)
      .set({
        text,
        embedding: JSON.stringify(embedding),
        lastAccessedAt: new Date(),
      })
      .where(agentClaimFilter(claimId, this.agentId));
  }

  async delete(claimId: string): Promise<void> {
    await this.config.db
      .delete(claims)
      .where(agentClaimFilter(claimId, this.agentId));
  }
}
