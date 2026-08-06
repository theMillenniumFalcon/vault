export { agentAuthority, claims, disputes } from "./db/schema";
export {
  createDefaultOpenAILLM,
  resolveLLM,
  type LLMConfig,
  type LLMFn,
  type LLMMessage,
  type MemoryConfig,
} from "./config";
export {
  createDefaultOpenAIEmbed,
  resolveEmbed,
  type EmbedConfig,
  type EmbedFn,
} from "./embed";
export { classify } from "./classify";
export { extractFacts, getLatestTurn } from "./extract";
export { Memory } from "./memory";
export { applyOp, syncClaimVectorFromRow } from "./ops";
export {
  agentClaimFilter,
  cosineSimilarity,
  getClaimRow,
  parseEmbedding,
  rowToClaim,
  search,
  searchClaims,
  searchOwnClaims,
  type ClaimRow,
  type VaultDb,
} from "./search";
export {
  MemoryVectorStore,
  claimRowToVectorMeta,
  loadActiveClaimVectors,
  matchesVectorFilter,
  withActiveFilter,
  type VectorFilter,
  type VectorMeta,
  type VectorStore,
} from "./vector-store";
export type {
  Claim,
  ClaimOp,
  ClaimStatus,
  ClaimType,
  ClassifyResult,
  ExtractedFact,
  Message,
  MessageRole,
  ScoredClaim,
  SearchOpts,
} from "./types";
