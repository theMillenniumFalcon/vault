import { runCli } from "./run-cli";

const AGENT_ID = process.env.AGENT_ID ?? "agent-a";
const DB_PATH = process.env.VAULT_DB_PATH ?? "vault.db";

runCli({ agentId: AGENT_ID, dbPath: DB_PATH }).catch((error) => {
  console.error(error);
  process.exit(1);
});
