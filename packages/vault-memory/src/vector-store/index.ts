export type {
  VectorFilter,
  VectorMeta,
  VectorStore,
} from "./types";
export { MemoryVectorStore } from "./memory";
export {
  cosineSimilarity,
  claimRowToVectorMeta,
  matchesVectorFilter,
  parseEmbedding,
  withActiveFilter,
} from "./utils";
export { loadActiveClaimVectors } from "./rebuild";
