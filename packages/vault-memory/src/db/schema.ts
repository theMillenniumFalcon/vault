import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(),
  text: text("text").notNull(),
  type: text("type", { enum: ["semantic", "episodic"] }).notNull(),
  sourceAgent: text("source_agent").notNull(),
  conversationId: text("conversation_id").notNull(),
  confidence: real("confidence").notNull().default(1.0),
  status: text("status", { enum: ["active", "superseded", "disputed"] })
    .notNull()
    .default("active"),
  supersedes: text("supersedes"),
  embedding: text("embedding"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
});

export const agentAuthority = sqliteTable("agent_authority", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(), // supports wildcard/prefix match, e.g. "user.schedule.*"
  agentId: text("agent_id").notNull(),
  weight: real("weight").notNull(), // 0-1
});

export const disputes = sqliteTable("disputes", {
  id: text("id").primaryKey(),
  claimAId: text("claim_a_id").notNull(),
  claimBId: text("claim_b_id").notNull(),
  entity: text("entity").notNull(),
  resolvedOp: text("resolved_op"), // null until resolved
  resolutionStrategy: text("resolution_strategy"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});

export const entities = sqliteTable("entities", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  aliases: text("aliases"), // JSON array of alternate labels
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
