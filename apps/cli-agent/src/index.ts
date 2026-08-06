import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { claims } from "vault-memory/schema";
import { eq } from "drizzle-orm";
import type { Message } from "vault-memory";
import { createAgentMemory, syncVectorIndex } from "./memory-setup";
import { createDb, getDrizzleDb } from "./db";

const AGENT_ID = process.env.AGENT_ID ?? "agent-a";
const CONVERSATION_ID = process.env.VAULT_CONVERSATION_ID ?? "cli-session";
const DB_PATH = process.env.VAULT_DB_PATH ?? "vault.db";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Set OPENAI_API_KEY to run the CLI agent.");
    process.exit(1);
  }

  const db = createDb(DB_PATH);
  const { memory, vectorStore } = createAgentMemory(AGENT_ID, db, { apiKey });
  await syncVectorIndex(vectorStore, db);

  const messages: Message[] = [];

  console.log(`Vault CLI agent (${AGENT_ID})`);
  console.log(`Database: ${DB_PATH}`);
  console.log("Commands: /search <query>, /claims, /quit");
  console.log(
    "Multi-agent: run a second terminal with AGENT_ID=agent-b and the same VAULT_DB_PATH.",
  );
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
        const results = await memory.search(query);
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

      messages.push({ role: "user", content: line });
      await syncVectorIndex(vectorStore, db);
      const { added } = await memory.add(messages, CONVERSATION_ID);

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
