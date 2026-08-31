import type { SQL } from "drizzle-orm";
import { agentAuthority, claims, disputes, entities } from "./schema";

export type ClaimRow = typeof claims.$inferSelect;
export type ClaimInsert = typeof claims.$inferInsert;
export type DisputeRow = typeof disputes.$inferSelect;
export type DisputeInsert = typeof disputes.$inferInsert;
export type AgentAuthorityRow = typeof agentAuthority.$inferSelect;
export type AgentAuthorityInsert = typeof agentAuthority.$inferInsert;
export type EntityRow = typeof entities.$inferSelect;
export type EntityInsert = typeof entities.$inferInsert;

export type VaultDb = {
  select(): {
    from(table: typeof claims): {
      where(condition: SQL): Promise<ClaimRow[]>;
    };
    from(table: typeof agentAuthority): {
      where(condition: SQL): Promise<AgentAuthorityRow[]>;
    };
    from(table: typeof disputes): {
      where(condition: SQL): Promise<DisputeRow[]>;
    };
    from(table: typeof entities): Promise<EntityRow[]>;
  };
  insert(table: typeof claims): {
    values(values: ClaimInsert): Promise<unknown>;
  };
  insert(table: typeof disputes): {
    values(values: DisputeInsert): Promise<unknown>;
  };
  insert(table: typeof agentAuthority): {
    values(values: AgentAuthorityInsert): Promise<unknown>;
  };
  insert(table: typeof entities): {
    values(values: EntityInsert): Promise<unknown>;
  };
  update(table: typeof claims): {
    set(values: Partial<ClaimInsert>): {
      where(condition: SQL): Promise<unknown>;
    };
  };
  update(table: typeof disputes): {
    set(values: Partial<DisputeInsert>): {
      where(condition: SQL): Promise<unknown>;
    };
  };
  delete(table: typeof claims): {
    where(condition: SQL): Promise<unknown>;
  };
};
