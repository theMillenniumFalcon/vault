export { claims } from "./db/schema";
export {
  createDefaultOpenAILLM,
  resolveLLM,
  type LLMConfig,
  type LLMFn,
  type LLMMessage,
} from "./config";
export { classify } from "./classify";
export { extractFacts, getLatestTurn } from "./extract";
export type {
  Claim,
  ClaimOp,
  ClaimStatus,
  ClaimType,
  ClassifyResult,
  ExtractedFact,
  Message,
  MessageRole,
} from "./types";
