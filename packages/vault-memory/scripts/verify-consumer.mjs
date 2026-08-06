import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packOutput = execSync("npm pack --pack-destination .", {
  cwd: packageRoot,
  encoding: "utf8",
}).trim();
const tarball = join(packageRoot, packOutput);
const consumerDir = mkdtempSync(join(tmpdir(), "vault-consumer-test-"));

try {
  execSync("npm init -y", { cwd: consumerDir, stdio: "inherit" });
  execSync(`npm install "${tarball}" better-sqlite3 drizzle-orm`, {
    cwd: consumerDir,
    stdio: "inherit",
  });

  writeFileSync(
    join(consumerDir, "test.mjs"),
    `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Memory } from "vault-memory";
import { claims } from "vault-memory/schema";

const sqlite = new Database(":memory:");
sqlite.exec(\`
  CREATE TABLE claims (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    source_agent TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'active',
    supersedes TEXT,
    embedding TEXT,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER
  )
\`);

const db = drizzle(sqlite);
let llmCalls = 0;
const llm = async ({ schema }) => {
  llmCalls += 1;
  if (llmCalls === 1) {
    return schema.parse({
      facts: [
        {
          entity: "user.diet",
          text: "The user is vegetarian",
          type: "semantic",
        },
      ],
    });
  }
  return schema.parse({ op: "ADD" });
};
const embed = async () => [1, 0, 0];

const memory = new Memory("agent-a", { db, llm, embed });
const { added } = await memory.add(
  [{ role: "user", content: "I'm vegetarian" }],
  "consumer-test",
);

if (added.length !== 1) {
  throw new Error(\`Expected 1 added claim, got \${added.length}\`);
}

const results = await memory.search("food preferences");
if (results.length !== 1 || results[0].text !== "The user is vegetarian") {
  throw new Error("Search did not return the stored claim");
}

if (!claims) {
  throw new Error("Schema export failed");
}

console.log("Consumer verification passed.");
`,
  );

  execSync("node test.mjs", { cwd: consumerDir, stdio: "inherit" });
  console.log(`Verified packed tarball: ${packOutput}`);
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
