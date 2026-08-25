import {
  resolveMemoryConfig,
  type MemoryConfig,
  type ResolvedMemoryConfig,
} from "./config";
import { resolveEmbed } from "./embed";
import { claims } from "./db/schema";
import {
  classifyAgainstOtherAgents,
  classifyAgainstOwnHistory,
} from "./classify";
import { extractFacts } from "./extract";
import { ensureEntityInRegistry, resolveEntityKeyPattern } from "./entity-registry";
import { applyCrossAgentResolution, applyOp } from "./ops";
import { resolveEntity as defaultResolveEntity } from "./resolve-entity";
import {
  agentClaimFilter,
  search as searchClaims,
} from "./search";
import type { Claim, Message, ScoredClaim, SearchOpts } from "./types";

export class Memory {
  private readonly embed: ReturnType<typeof resolveEmbed>;
  private readonly config: ResolvedMemoryConfig;

  constructor(
    private readonly agentId: string,
    config: MemoryConfig,
  ) {
    this.config = resolveMemoryConfig(config);
    this.embed = resolveEmbed(config);
  }

  async add(
    messages: Message[],
    conversationId: string,
  ): Promise<{ added: Claim[] }> {
    const facts = await extractFacts(messages, this.config);
    const results: Claim[] = [];

    const resolveEntityFn = this.config.resolveEntity ?? defaultResolveEntity;

    for (const fact of facts) {
      const embedding = await this.embed(fact.text);
      const resolvedFact = await resolveEntityFn(fact, embedding, this.config);

      if (this.config.useEntityRegistry) {
        await ensureEntityInRegistry(this.config.db, resolvedFact.entity, {
          autoRegister: this.config.entityRegistryAutoRegister ?? true,
          description: resolvedFact.text,
          pattern: resolveEntityKeyPattern(this.config.entityKeyPattern),
        });
      }

      const ownResult = await classifyAgainstOwnHistory(
        resolvedFact,
        this.agentId,
        embedding,
        this.config,
      );

      if (ownResult.op === "NOOP") continue;

      if (ownResult.op === "ADD") {
        const crossResult = await classifyAgainstOtherAgents(
          resolvedFact,
          this.agentId,
          embedding,
          this.config,
        );
        results.push(
          await applyCrossAgentResolution(
            this.config.db,
            this.config.vectorStore,
            crossResult,
            resolvedFact,
            embedding,
            this.agentId,
            conversationId,
          ),
        );
        continue;
      }

      results.push(
        await applyOp(
          this.config.db,
          this.config.vectorStore,
          ownResult.op,
          resolvedFact,
          embedding,
          ownResult.targetClaimId,
          this.agentId,
          conversationId,
        ),
      );
    }

    return { added: results };
  }

  async search(query: string, opts?: SearchOpts): Promise<ScoredClaim[]> {
    return searchClaims(
      this.config.db,
      this.config.vectorStore,
      this.embed,
      query,
      {
        ...opts,
        sourceAgent: opts?.sourceAgent ?? this.agentId,
      },
    );
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

    await this.config.vectorStore.upsert(claimId, embedding, {
      claimId,
      sourceAgent: this.agentId,
      entity: existing[0]!.entity,
      status: existing[0]!.status,
      conversationId: existing[0]!.conversationId,
    });
  }

  async delete(claimId: string): Promise<void> {
    await this.config.db
      .delete(claims)
      .where(agentClaimFilter(claimId, this.agentId));
    await this.config.vectorStore.remove(claimId);
  }
}
