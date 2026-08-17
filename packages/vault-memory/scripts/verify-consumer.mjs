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
const dbPath = join(consumerDir, "shared.db");

const SCHEMA_SQL = `
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
  );

  CREATE TABLE agent_authority (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    weight REAL NOT NULL
  );

  CREATE TABLE disputes (
    id TEXT PRIMARY KEY,
    claim_a_id TEXT NOT NULL,
    claim_b_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    resolved_op TEXT,
    resolution_strategy TEXT,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
`;

const HARNESS_EMBED = `
function createHarnessEmbed() {
  return async (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("pst") || lower.includes("pacific")) return [1, 0.05, 0];
    if (lower.includes("est") || lower.includes("eastern")) return [0.05, 1, 0];
    if (lower.includes("timezone") || lower.includes("time zone")) return [0.7, 0.7, 0];
    return [0.5, 0.5, 0.5];
  };
}
`;

try {
  execSync("npm init -y", { cwd: consumerDir, stdio: "inherit" });
  execSync(`npm install "${tarball}" better-sqlite3 drizzle-orm`, {
    cwd: consumerDir,
    stdio: "inherit",
  });

  // Phase 1 smoke: single-agent add + search against packed tarball
  writeFileSync(
    join(consumerDir, "single-agent.mjs"),
    `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Memory, MemoryVectorStore } from "vault-memory";
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
      facts: [{ entity: "user.diet", text: "The user is vegetarian", type: "semantic" }],
    });
  }
  return schema.parse({ op: "ADD" });
};
const embed = async () => [1, 0, 0];

const memory = new Memory("agent-a", {
  db,
  llm,
  embed,
  vectorStore: new MemoryVectorStore(),
  vectorDimensions: 3,
});
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

console.log("Single-agent consumer verification passed.");
`,
  );

  execSync("node single-agent.mjs", { cwd: consumerDir, stdio: "inherit" });

  // Phase 2: two separate scripts, one shared SQLite file, authority conflict
  writeFileSync(
    join(consumerDir, "agent-a.mjs"),
    `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  Memory,
  MemoryVectorStore,
  seedAuthority,
  EXAMPLE_AUTHORITY_SEED,
} from "vault-memory";

${HARNESS_EMBED}

const dbPath = process.argv[2];
const sqlite = new Database(dbPath);
sqlite.exec(\`${SCHEMA_SQL.replace(/`/g, "\\`")}\`);

const db = drizzle(sqlite);
await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);

const vectorStore = new MemoryVectorStore();
let llmCalls = 0;
const llm = async ({ schema }) => {
  llmCalls += 1;
  if (llmCalls === 1) {
    return schema.parse({
      facts: [
        { entity: "user.timezone", text: "The user is in PST", type: "semantic" },
      ],
    });
  }
  return schema.parse({ op: "ADD" });
};

const memory = new Memory("agent-a", {
  db,
  vectorStore,
  llm,
  embed: createHarnessEmbed(),
  entityStrategies: { "user.timezone": "authority" },
});

const { added } = await memory.add(
  [{ role: "user", content: "I'm in PST" }],
  "conv1",
);

if (added.length !== 1 || !added[0].text.includes("PST")) {
  throw new Error("agent-a did not store PST claim");
}

console.log("agent-a wrote PST claim.");
`,
  );

  writeFileSync(
    join(consumerDir, "agent-b.mjs"),
    `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Memory, MemoryVectorStore } from "vault-memory";

${HARNESS_EMBED}

const dbPath = process.argv[2];
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);
const vectorStore = new MemoryVectorStore();
await vectorStore.rebuild(db);

let llmCalls = 0;
const llm = async ({ schema }) => {
  llmCalls += 1;
  if (llmCalls === 1) {
    return schema.parse({
      facts: [
        { entity: "user.timezone", text: "The user is in EST", type: "semantic" },
      ],
    });
  }
  return schema.parse({ op: "ADD" });
};

const memory = new Memory("agent-b", {
  db,
  vectorStore,
  llm,
  embed: createHarnessEmbed(),
  entityStrategies: { "user.timezone": "authority" },
});

const { added } = await memory.add(
  [{ role: "user", content: "I'm in EST" }],
  "conv1",
);

if (added.length !== 1) {
  throw new Error(\`agent-b expected 1 claim, got \${added.length}\`);
}
if (added[0].status !== "disputed") {
  throw new Error(\`Expected disputed status, got \${added[0].status}\`);
}
if (!added[0].text.includes("EST")) {
  throw new Error("agent-b claim text missing EST");
}

console.log("agent-b wrote disputed EST claim.");
`,
  );

  writeFileSync(
    join(consumerDir, "verify-conflict.mjs"),
    `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { MemoryVectorStore, search } from "vault-memory";

${HARNESS_EMBED}

const dbPath = process.argv[2];
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);
const vectorStore = new MemoryVectorStore();
await vectorStore.rebuild(db);

const results = await search(
  db,
  vectorStore,
  createHarnessEmbed(),
  "what timezone is the user in?",
  { status: "active", limit: 5 },
);

if (results.length === 0) {
  throw new Error("Search returned no results");
}
if (results[0].sourceAgent !== "agent-a") {
  throw new Error(\`Expected agent-a to win, got \${results[0].sourceAgent}\`);
}
if (!results[0].text.includes("PST")) {
  throw new Error(\`Expected PST in top result, got: \${results[0].text}\`);
}

console.log("Two-agent conflict verification passed.");
`,
  );

  execSync(`node agent-a.mjs "${dbPath}"`, { cwd: consumerDir, stdio: "inherit" });
  execSync(`node agent-b.mjs "${dbPath}"`, { cwd: consumerDir, stdio: "inherit" });
  execSync(`node verify-conflict.mjs "${dbPath}"`, {
    cwd: consumerDir,
    stdio: "inherit",
  });

  console.log(`Verified packed tarball: ${packOutput}`);
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
