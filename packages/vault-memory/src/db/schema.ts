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
