import type { SQL } from "drizzle-orm";
import { claims } from "./schema";

export type ClaimRow = typeof claims.$inferSelect;
export type ClaimInsert = typeof claims.$inferInsert;

export type VaultDb = {
  select(): {
    from(table: typeof claims): {
      where(condition: SQL): Promise<ClaimRow[]>;
    };
  };
  insert(table: typeof claims): {
    values(values: ClaimInsert): Promise<unknown>;
  };
  update(table: typeof claims): {
    set(values: Partial<ClaimInsert>): {
      where(condition: SQL): Promise<unknown>;
    };
  };
  delete(table: typeof claims): {
    where(condition: SQL): Promise<unknown>;
  };
};
