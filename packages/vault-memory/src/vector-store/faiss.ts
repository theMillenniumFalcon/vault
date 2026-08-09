import type { IndexFlatIP, IndexIDMap2 } from "faiss-node";
import type { VaultDb } from "../db/types";
import { loadActiveClaimVectors } from "./rebuild";
import type { VectorFilter, VectorMeta, VectorStore } from "./types";
import { withActiveFilter } from "./utils";

export type FaissBindings = {
  IndexFlatIP: new (dimensions: number) => IndexFlatIP;
  IndexIDMap2: new (index: IndexFlatIP) => IndexIDMap2;
};

export type FaissVectorStoreOptions = {
  dimensions: number;
  /** Inject bindings (tests / pure-JS shims). Defaults to dynamic `faiss-node` import. */
  faiss?: FaissBindings;
};

export class FaissVectorStore implements VectorStore {
  private readonly dimensions: number;
  private readonly faiss: FaissBindings | undefined;
  private index: IndexIDMap2 | null = null;
  private readonly metaById = new Map<string, VectorMeta>();
  private readonly faissIdToClaimId = new Map<bigint, string>();

  constructor(options: FaissVectorStoreOptions) {
    this.dimensions = options.dimensions;
    this.faiss = options.faiss;
  }

  private async getIndex(): Promise<IndexIDMap2> {
    if (this.index) return this.index;

    let faiss = this.faiss;
    if (!faiss) {
      try {
        faiss = await import("faiss-node");
      } catch {
        throw new Error(
          "FaissVectorStore requires the optional peer dependency faiss-node. Install it with: npm install faiss-node",
        );
      }
    }

    const baseIndex = new faiss.IndexFlatIP(this.dimensions);
    this.index = new faiss.IndexIDMap2(baseIndex);
    return this.index;
  }

  private normalize(embedding: number[]): number[] {
    let norm = 0;
    for (const value of embedding) {
      norm += value * value;
    }
    const scale = norm === 0 ? 0 : 1 / Math.sqrt(norm);
    return embedding.map((value) => value * scale);
  }

  async upsert(id: string, embedding: number[], meta: VectorMeta): Promise<void> {
    if (embedding.length !== this.dimensions) {
      throw new Error(
        `FaissVectorStore expected ${this.dimensions} dimensions, got ${embedding.length}`,
      );
    }

    const index = await this.getIndex();
    const normalized = this.normalize(embedding);
    const numericId = claimIdToFaissId(id);

    if (this.metaById.has(id)) {
      index.removeIds([numericId]);
    }

    index.add(normalized, [numericId]);
    this.metaById.set(id, meta);
    this.faissIdToClaimId.set(numericId, id);
  }

  async remove(id: string): Promise<void> {
    if (!this.index || !this.metaById.has(id)) return;
    const numericId = claimIdToFaissId(id);
    this.index.removeIds([numericId]);
    this.metaById.delete(id);
    this.faissIdToClaimId.delete(numericId);
  }

  async search(
    embedding: number[],
    opts: { limit: number; filter?: VectorFilter },
  ): Promise<Array<{ claimId: string; score: number }>> {
    if (!this.index || this.metaById.size === 0) return [];

    const filter = withActiveFilter(opts.filter);
    const normalized = this.normalize(embedding);
    const { distances, labels } = this.index.search(
      normalized,
      Math.min(opts.limit * 4, this.metaById.size),
    );

    const hits: Array<{ claimId: string; score: number }> = [];
    for (let i = 0; i < labels.length; i++) {
      const claimId = this.faissIdToClaimId.get(labels[i]!);
      if (!claimId) continue;
      const meta = this.metaById.get(claimId);
      if (!meta) continue;
      if (filter.sourceAgent && meta.sourceAgent !== filter.sourceAgent) {
        continue;
      }
      if (filter.excludeAgent && meta.sourceAgent === filter.excludeAgent) {
        continue;
      }
      if (filter.entity && meta.entity !== filter.entity) continue;
      if (filter.status && meta.status !== filter.status) continue;
      if (
        filter.conversationId &&
        meta.conversationId !== filter.conversationId
      ) {
        continue;
      }
      hits.push({ claimId, score: distances[i] ?? 0 });
      if (hits.length >= opts.limit) break;
    }

    return hits;
  }

  async rebuild(db: VaultDb): Promise<void> {
    this.metaById.clear();
    this.faissIdToClaimId.clear();
    this.index = null;

    const loaded = await loadActiveClaimVectors(db);
    for (const item of loaded) {
      await this.upsert(item.id, item.embedding, item.meta);
    }
  }
}

function claimIdToFaissId(claimId: string): bigint {
  const hex = claimId.replace(/-/g, "").slice(0, 16);
  return BigInt(`0x${hex}`);
}
