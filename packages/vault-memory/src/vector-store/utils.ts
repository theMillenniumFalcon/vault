import type { ClaimRow } from "../db/types";
import type { ClaimStatus } from "../types";
import type { VectorFilter, VectorMeta } from "./types";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function claimRowToVectorMeta(row: ClaimRow): VectorMeta {
  return {
    claimId: row.id,
    sourceAgent: row.sourceAgent,
    entity: row.entity,
    status: row.status,
    conversationId: row.conversationId,
  };
}

export function matchesVectorFilter(
  meta: VectorMeta,
  filter?: VectorFilter,
): boolean {
  if (!filter) return true;
  if (filter.sourceAgent && meta.sourceAgent !== filter.sourceAgent) {
    return false;
  }
  if (filter.excludeAgent && meta.sourceAgent === filter.excludeAgent) {
    return false;
  }
  if (filter.entity && meta.entity !== filter.entity) {
    return false;
  }
  if (filter.status && meta.status !== filter.status) {
    return false;
  }
  if (filter.conversationId && meta.conversationId !== filter.conversationId) {
    return false;
  }
  return true;
}

export function withActiveFilter(filter?: VectorFilter): VectorFilter {
  return { status: "active" as ClaimStatus, ...filter };
}
