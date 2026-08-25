# Entities

How Vault decides what `entity` string goes on a claim (e.g. `user.timezone`, `user.diet`).

## Short answer

**Entities are not a hardcoded enum.** At runtime, the **extraction LLM** picks a dotted-path string guided by a prompt. Demo configs and tests hardcode specific entities for predictability.

## Where entities come from

When you call `memory.add(messages, ...)`, `extractFacts()` in `src/extract.ts` runs first:

```json
{ "facts": [{ "entity": "user.timezone", "text": "The user is in PST", "type": "semantic" }] }
```

The system prompt suggests a naming style but does **not** restrict to a fixed list:

```
- entity: a short dotted path for the subject, e.g. "user", "user.diet", "user.location", "user.job"
```

Validation is only `z.string().min(1)` — any non-empty string is accepted.

**Decision maker:** the extraction LLM, guided by that prompt — then **entity resolution** (below) may align it with an existing claim.

## Entity resolution

After extraction, before classify, `resolveEntity()` runs on each fact:

1. Embed the fact text (same vector used for classify).
2. Search **all active claims** globally (no entity filter) via vector similarity.
3. Apply a **three-band** decision:

| Similarity score | Behavior |
|------------------|----------|
| **≥ 0.85** (`entityMatchThreshold`) | Auto-align to incumbent entity |
| **0.70 – 0.85** (borderline) | LLM disambiguation — align or keep extracted |
| **< 0.70** (`entityDisambiguationThreshold`) | Keep extracted entity |

This fixes drift like `user.abc` vs `user.timezone` when facts are semantically similar. Cross-agent conflict and authority then work on the aligned entity.

**Also:** on `UPDATE`, the stored entity is **preserved** from the target claim (extractor labels cannot rename via merge).

**Not fixed yet:** brand-new facts with no similar existing claims still get whatever entity the LLM invents. A canonical entity registry (P2) would address that.

```typescript
const memory = new Memory("agent-a", {
  db,
  apiKey: process.env.OPENAI_API_KEY,
  entityMatchThreshold: 0.85,           // auto-align (default)
  entityDisambiguationThreshold: 0.70,  // LLM band floor (default)
  entityResolutionUseLlm: true,         // set false to skip borderline LLM
});
```

Borderline LLM sees the new fact plus top similar claims and must pick from allowed entity keys (extracted + candidates). Invalid keys are rejected by Zod.

Key code: `src/resolve-entity.ts` (`resolveEntity`, `disambiguateEntityWithLlm`), wired in `src/memory.ts`.

## What is hardcoded (and what isn't)

| Location | Hardcoded? | Purpose |
|----------|------------|---------|
| `extract.ts` prompt | Examples only (`user.diet`, etc.) | Style guidance for LLM |
| `resolve.ts` → `EXAMPLE_AUTHORITY_SEED` | Yes — `user.timezone`, `user.mood` | Demo seed data |
| `apps/cli-agent` → `SHARED_ENTITY_STRATEGIES` | Yes — same entities | CLI demo config |
| Tests / `verify-consumer.mjs` | Yes — scripted fake LLM | Deterministic tests |
| Core library runtime | **No fixed taxonomy** | Accepts any entity string; resolution aligns when similar claims exist |

### Config knobs

| Option | Purpose |
|--------|---------|
| `entityMatchThreshold` | Auto-align when similarity ≥ this (default 0.85; 0 = disable) |
| `entityDisambiguationThreshold` | LLM band floor (default 0.70) |
| `entityResolutionUseLlm` | Skip borderline LLM when false |
| `resolveEntity` | Full override hook |

## How entity is used after extraction

Once chosen, the entity string flows through the pipeline as an opaque key:

### Same-agent classify

Vector search finds similar claims from **this agent** (not strictly filtered by entity first). The classify LLM decides ADD/UPDATE/REPLACE/NOOP using entity + text context.

### Cross-agent classify

Only compares claims with the **exact same entity**:

```typescript
searchClaims(db, vectorStore, embedding, {
  excludeAgent: agentId,
  entity: fact.entity,   // exact match
  status: "active",
  limit: 5,
});
```

**Implication:** agent-a storing `user.timezone` and agent-b storing `user.location` for the same real-world fact **will not conflict** — different entity strings = no cross-agent match.

### Conflict strategy lookup

Exact key in config:

```typescript
config.entityStrategies?.[entity] ?? "recency"
```

No config for that entity → defaults to **recency**.

### Authority weights

Pattern matching with wildcards (e.g. `user.schedule.*`):

```typescript
getAuthority(db, agentId, entity)
```

Uses `entityMatchesPattern()` — exact match beats wildcard; most specific pattern wins.

If you seed authority for `user.timezone` but the LLM extracts `user.location`, authority rules for timezone won't apply.

## Full decision chain

1. User says: `"I'm in PST"`
2. Extraction LLM returns: `{ entity: "user.timezone", text: "The user is in PST" }`
3. Entity stored on the claim row in SQL
4. Another agent writes conflicting fact on the **same entity string** → cross-agent conflict triggers
5. `entityStrategies["user.timezone"]` picks recency vs authority (if configured)
6. `agent_authority` rows for that entity decide who wins (if strategy is authority)

## Consistency risk

Entity naming from extraction alone is still **LLM-dependent**. Resolution reduces drift when similar claims already exist, but does not enforce a fixed taxonomy:

- No ontology or enum of allowed entities (without custom `resolveEntity` / registry)
- No normalization (`timezone` vs `time_zone`) unless vectors happen to align
- Conflict detection still requires **exact entity match** after resolution

Production apps may want:

- A fixed entity taxonomy the LLM must pick from (custom extraction prompt)
- Post-extraction normalization
- Wildcard `entityStrategies` (authority DB already supports wildcards; strategy config is exact-key only today)

## Recommendations

1. **Document your entity convention** for your app (e.g. always `user.<domain>`)
2. **Seed authority** for entities where domain trust matters
3. **Set `entityStrategies`** explicitly for those entities — otherwise everything falls back to recency
4. **Monitor extraction** — log entities the LLM returns and fix prompt drift early

## Related

- [Multi-agent conflict](./multi-agent-conflict.md) — how entity-scoped conflicts resolve
- [API reference](./api.md) — `entityStrategies` config
- Extraction prompt: `packages/vault-memory/src/extract.ts`
