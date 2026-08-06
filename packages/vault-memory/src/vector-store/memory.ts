import type { VaultDb } from "../db/types";
import { loadActiveClaimVectors } from "./rebuild";
import type { VectorMeta, VectorStore } from "./types";
import {
  cosineSimilarity,
  matchesVectorFilter,
  withActiveFilter,
} from "./utils";

type StoredVector = {
  embedding: number[];
  meta: VectorMeta;
};

export class MemoryVectorStore implements VectorStore {
  private readonly vectors = new Map<string, StoredVector>();

  async upsert(id: string, embedding: number[], meta: VectorMeta): Promise<void> {
    this.vectors.set(id, { embedding, meta });
  }

  async remove(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async search(
    embedding: number[],
    opts: { limit: number; filter?: import("./types").VectorFilter },
  ): Promise<Array<{ claimId: string; score: number }>> {
    const filter = withActiveFilter(opts.filter);
    const hits: Array<{ claimId: string; score: number }> = [];

    for (const [id, stored] of this.vectors) {
      if (!matchesVectorFilter(stored.meta, filter)) continue;
      hits.push({
        claimId: id,
        score: cosineSimilarity(embedding, stored.embedding),
      });
    }

    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit);
  }

  async rebuild(db: VaultDb): Promise<void> {
    this.vectors.clear();
    const loaded = await loadActiveClaimVectors(db);
    for (const item of loaded) {
      this.vectors.set(item.id, {
        embedding: item.embedding,
        meta: item.meta,
      });
    }
  }
}
