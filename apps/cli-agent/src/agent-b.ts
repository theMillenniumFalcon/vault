import { runCli } from "./run-cli";

runCli({
  agentId: "agent-b",
  dbPath: process.env.VAULT_DB_PATH ?? "vault-shared.db",
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
