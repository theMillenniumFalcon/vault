export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  role: MessageRole;
  content: string;
}

export type ClaimType = "semantic" | "episodic";
export type ClaimStatus = "active" | "superseded" | "disputed";
export type ClaimOp = "ADD" | "UPDATE" | "REPLACE" | "NOOP";

export interface ExtractedFact {
  entity: string;
  text: string;
  type: ClaimType;
}

export interface Claim {
  id: string;
  entity: string;
  text: string;
  type: ClaimType;
  sourceAgent: string;
  conversationId: string;
  confidence: number;
  status: ClaimStatus;
  supersedes: string | null;
  embedding: string | null;
  createdAt: Date;
  lastAccessedAt: Date | null;
}

export interface ClassifyResult {
  op: ClaimOp;
  targetClaimId?: string;
}

export interface ScoredClaim extends Claim {
  score: number;
}

export interface SearchOpts {
  conversationId?: string;
  limit?: number;
  sourceAgent?: string;
}
