declare module "faiss-node" {
  export class IndexFlatIP {
    constructor(dimensions: number);
    ntotal: number;
  }

  export class IndexIDMap2 {
    constructor(index: IndexFlatIP);
    add(vectors: number[], ids: bigint[]): void;
    removeIds(ids: bigint[]): void;
    search(
      query: number[],
      k: number,
    ): { distances: number[]; labels: bigint[] };
  }
}
