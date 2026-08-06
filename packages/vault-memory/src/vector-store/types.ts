import type { ClaimStatus } from "../types";
import type { VaultDb } from "../db/types";

export type VectorFilter = {
  sourceAgent?: string;
  excludeAgent?: string;
  entity?: string;
  status?: ClaimStatus;
  conversationId?: string;
};

export type VectorMeta = VectorFilter & { claimId: string };

export interface VectorStore {
  upsert(id: string, embedding: number[], meta: VectorMeta): Promise<void>;
  remove(id: string): Promise<void>;
  search(
    embedding: number[],
    opts: { limit: number; filter?: VectorFilter },
  ): Promise<Array<{ claimId: string; score: number }>>;
  rebuild(db: VaultDb): Promise<void>;
}
