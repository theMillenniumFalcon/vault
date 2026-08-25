export { agentAuthority, claims, disputes, entities } from "./db/schema";
export {
  createDefaultOpenAILLM,
  resolveLLM,
  resolveMemoryConfig,
  resolveVectorStore,
  type LLMConfig,
  type LLMFn,
  type LLMMessage,
  type MemoryConfig,
  type ResolvedMemoryConfig,
} from "./config";
export {
  createDefaultOpenAIEmbed,
  resolveEmbed,
  type EmbedConfig,
  type EmbedFn,
} from "./embed";
export {
  classify,
  classifyAgainstOtherAgents,
  classifyAgainstOwnHistory,
} from "./classify";
export { extractFacts, getLatestTurn, type ExtractFactsConfig } from "./extract";
export {
  DEFAULT_ENTITY_KEY_PATTERN,
  EXAMPLE_ENTITY_SEED,
  ensureEntityInRegistry,
  formatRegistryForPrompt,
  getRegistryEntity,
  listRegistryEntities,
  parseExtractedEntityKey,
  registerEntity,
  resolveEntityKeyPattern,
  seedEntities,
  validateEntityKey,
  type EntitySeed,
} from "./entity-registry";
export { Memory } from "./memory";
export { applyCrossAgentResolution, applyOp, syncClaimVectorFromRow } from "./ops";
export {
  DEFAULT_ENTITY_DISAMBIGUATION_THRESHOLD,
  DEFAULT_ENTITY_MATCH_THRESHOLD,
  defaultResolveEntity,
  disambiguateEntityWithLlm,
  resolveEntity,
  type EntityResolverFn,
} from "./resolve-entity";
export {
  EXAMPLE_AUTHORITY_SEED,
  entityMatchesPattern,
  getAuthority,
  resolveConflict,
  seedAuthority,
  strategyForEntity,
  type AuthoritySeed,
  type Resolution,
  type ResolutionStrategy,
} from "./resolve";
export { recencyWeightedScore } from "./decay";
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
  createDefaultVectorStore,
  DEFAULT_EMBEDDING_DIMENSIONS,
  FaissVectorStore,
  MemoryVectorStore,
  claimRowToVectorMeta,
  loadActiveClaimVectors,
  matchesVectorFilter,
  withActiveFilter,
  type CreateVectorStoreOptions,
  type FaissBindings,
  type FaissVectorStoreOptions,
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
  CrossAgentClassifyResult,
  ExtractedFact,
  Message,
  MessageRole,
  ScoredClaim,
  SearchOpts,
} from "./types";
