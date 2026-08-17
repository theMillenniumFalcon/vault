export type {
  VectorFilter,
  VectorMeta,
  VectorStore,
} from "./types";
export {
  createDefaultVectorStore,
  DEFAULT_EMBEDDING_DIMENSIONS,
  type CreateVectorStoreOptions,
} from "./create";
export { FaissVectorStore, type FaissBindings, type FaissVectorStoreOptions } from "./faiss";
export { MemoryVectorStore } from "./memory";
export {
  cosineSimilarity,
  claimRowToVectorMeta,
  matchesVectorFilter,
  parseEmbedding,
  withActiveFilter,
} from "./utils";
export { loadActiveClaimVectors } from "./rebuild";
