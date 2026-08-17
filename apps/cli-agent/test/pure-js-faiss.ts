import type { FaissBindings } from "vault-memory";

/** Pure-JS FAISS shim for tests (no native faiss-node build required). */
export function createPureJsFaiss(): FaissBindings {
  class IndexFlatIPImpl {
    ntotal = 0;
    readonly dimensions: number;
    constructor(dimensions: number) {
      this.dimensions = dimensions;
    }
  }

  class IndexIDMap2Impl {
    private readonly vectors = new Map<bigint, number[]>();
    private readonly dimensions: number;

    constructor(base: IndexFlatIPImpl) {
      this.dimensions = base.dimensions;
    }

    add(vectors: number[], ids: bigint[]): void {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!;
        const start = i * this.dimensions;
        const vector = vectors.slice(start, start + this.dimensions);
        this.vectors.set(id, vector);
      }
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
