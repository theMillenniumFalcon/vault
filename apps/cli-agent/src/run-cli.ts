import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { claims, disputes } from "vault-memory/schema";
import type { Message } from "vault-memory";
import {
  bootstrapSharedStore,
  createAgentMemory,
  searchSharedStore,
  syncVectorIndex,
} from "./memory-setup";
import { createDb, getDrizzleDb } from "./db";

export type RunCliOptions = {
  agentId: string;
  dbPath: string;
  conversationId?: string;
  apiKey?: string;
};

export async function runCli(options: RunCliOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Set OPENAI_API_KEY to run the CLI agent.");
    process.exit(1);
  }

  const conversationId =
    options.conversationId ?? process.env.VAULT_CONVERSATION_ID ?? "cli-session";
  const db = createDb(options.dbPath);
  await bootstrapSharedStore(db);

  const { memory, vectorStore, embed } = createAgentMemory(
    options.agentId,
    db,
    { apiKey },
  );
  await syncVectorIndex(vectorStore, db);

  const messages: Message[] = [];

  console.log(`Vault CLI agent (${options.agentId})`);
  console.log(`Database: ${options.dbPath}`);
  console.log("Commands: /search <query>, /claims, /disputes, /quit");
  console.log(
    "Multi-agent: run agent-b in another terminal against the same database file.",
  );
  console.log("  bun run start:agent-b   (or AGENT_ID=agent-b VAULT_DB_PATH=...)");
  console.log("");

  const rl = createInterface({ input, output });

  try {
    while (true) {
      const line = (await rl.question("You: ")).trim();
      if (!line) continue;

      if (line === "/quit" || line === "/exit") {
        break;
      }

      if (line.startsWith("/search ")) {
        const query = line.slice("/search ".length).trim();
        if (!query) {
          console.log("Usage: /search <query>");
          continue;
        }

        await syncVectorIndex(vectorStore, db);
        const results = await searchSharedStore(db, vectorStore, embed, query);
        if (results.length === 0) {
          console.log("No matching memories.");
        } else {
          for (const result of results) {
            console.log(
              `- [${result.score.toFixed(3)}] ${result.text} (${result.entity}, ${result.sourceAgent}, ${result.status})`,
            );
          }
        }
        continue;
      }

      if (line === "/claims") {
        await syncVectorIndex(vectorStore, db);
        const rows = await getDrizzleDb(db).select().from(claims);
        if (rows.length === 0) {
          console.log("No claims in store.");
        } else {
          for (const row of rows) {
            console.log(
              `- [${row.status}] ${row.sourceAgent}: ${row.text} (${row.entity})`,
            );
          }
        }
        continue;
      }

      if (line === "/disputes") {
        const disputeRows = await getDrizzleDb(db).select().from(disputes);
        if (disputeRows.length === 0) {
          console.log("No disputes in store.");
        } else {
          const allClaims = await getDrizzleDb(db).select().from(claims);
          const claimById = new Map(allClaims.map((c) => [c.id, c]));
          for (const row of disputeRows) {
            const incoming = claimById.get(row.claimAId);
            const incumbent = claimById.get(row.claimBId);
            console.log(
              `- [${row.resolutionStrategy ?? "unknown"}] ${row.entity}: ` +
                `${incoming?.sourceAgent ?? "?"} disputed "${incoming?.text ?? row.claimAId}" ` +
                `vs ${incumbent?.sourceAgent ?? "?"} "${incumbent?.text ?? row.claimBId}" ` +
                `(resolved: ${row.resolvedAt ? "yes" : "open"})`,
            );
          }
        }
        continue;
      }

      messages.push({ role: "user", content: line });
      await syncVectorIndex(vectorStore, db);
      const { added } = await memory.add(messages, conversationId);

      if (added.length === 0) {
        console.log("Assistant: Noted. (no new memories)");
      } else {
        console.log("Assistant: Noted. Stored:");
        for (const claim of added) {
          console.log(
            `  - [${claim.status}] ${claim.text} (${claim.entity})`,
          );
        }
      }

      messages.push({
        role: "assistant",
        content:
          added.length === 0
            ? "Noted."
            : `Stored ${added.length} memory update(s).`,
      });
    }
  } finally {
    rl.close();
  }
}
