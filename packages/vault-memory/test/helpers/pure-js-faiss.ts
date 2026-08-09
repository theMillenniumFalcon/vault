import type { FaissBindings } from "../../src/vector-store/faiss";
import type { IndexFlatIP, IndexIDMap2 } from "faiss-node";

/**
 * Pure-JS stand-in for the faiss-node surface used by FaissVectorStore.
 * Lets the conflict harness exercise the Faiss path without a native build.
 */
export function createPureJsFaiss(): FaissBindings {
  class IndexFlatIPImpl implements IndexFlatIP {
    ntotal = 0;
    readonly dimensions: number;
    constructor(dimensions: number) {
      this.dimensions = dimensions;
    }
  }

  class IndexIDMap2Impl implements IndexIDMap2 {
    private readonly vectors = new Map<bigint, number[]>();
    private readonly dimensions: number;

    constructor(base: IndexFlatIP) {
      this.dimensions = (base as IndexFlatIPImpl).dimensions;
    }

    add(vectors: number[], ids: bigint[]): void {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!;
        const start = i * this.dimensions;
        const vector = vectors.slice(start, start + this.dimensions);
        this.vectors.set(id, vector);
      }
      (this as { ntotal?: number }).ntotal = this.vectors.size;
    }

    removeIds(ids: bigint[]): void {
      for (const id of ids) this.vectors.delete(id);
    }

    search(
      query: number[],
      k: number,
    ): { distances: number[]; labels: bigint[] } {
      const scored = [...this.vectors.entries()]
        .map(([id, vector]) => ({
          id,
          score: dot(query, vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      return {
        distances: scored.map((row) => row.score),
        labels: scored.map((row) => row.id),
      };
    }
  }

  return {
    IndexFlatIP: IndexFlatIPImpl as unknown as FaissBindings["IndexFlatIP"],
    IndexIDMap2: IndexIDMap2Impl as unknown as FaissBindings["IndexIDMap2"],
  };
}

function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}
