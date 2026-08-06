export { claims } from "./db/schema";
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
export { applyOp } from "./ops";
export {
  bruteForceSearch,
  cosineSimilarity,
  parseEmbedding,
  rowToClaim,
  search,
  searchOwnClaims,
  type ClaimRow,
  type VaultDb,
} from "./search";
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
