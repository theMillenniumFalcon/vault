import { FaissVectorStore } from "./faiss";
import type { VectorStore } from "./types";

/** Default for OpenAI `text-embedding-3-small`. */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

export type CreateVectorStoreOptions = {
  dimensions?: number;
};

/** Default vector index — FAISS-backed approximate nearest-neighbor search. */
export function createDefaultVectorStore(
  options: CreateVectorStoreOptions = {},
): VectorStore {
  return new FaissVectorStore({
    dimensions: options.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
  });
}
