import { Archive, GitMerge, Search, Tags, Users, Workflow } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";

type ClaimRow = {
  status: "active" | "superseded" | "disputed";
  entity: string;
  text: string;
  agent: string;
};

const beforeReplace: ClaimRow[] = [
  {
    status: "active",
    entity: "user.diet",
    text: "The user is vegetarian",
    agent: "agent-a",
  },
];

const afterReplace: ClaimRow[] = [
  {
    status: "superseded",
    entity: "user.diet",
    text: "The user is vegetarian",
    agent: "agent-a",
  },
  {
    status: "active",
    entity: "user.diet",
    text: "The user eats meat",
    agent: "agent-a",
  },
];

function ClaimTable({ rows }: { rows: ClaimRow[] }) {
  return (
    <div className="overflow-x-auto border border-neutral-800">
      <table className="w-full min-w-[280px] text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-neutral-800 text-neutral-500">
            <th className="px-3 py-2 font-normal">status</th>
            <th className="px-3 py-2 font-normal">entity</th>
            <th className="px-3 py-2 font-normal">claim</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.status}-${row.text}`}
              className="border-b border-neutral-800/80 last:border-b-0"
            >
              <td className="px-3 py-2.5">
                <span
                  className={
                    row.status === "active"
                      ? "text-neutral-100"
                      : row.status === "disputed"
                        ? "text-amber-500/90"
                        : "text-neutral-600 line-through"
                  }
                >
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-neutral-400">{row.entity}</td>
              <td className="px-3 py-2.5 text-neutral-300">{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemoryInspector() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
          User says: &quot;I&apos;m vegetarian&quot;
        </p>
        <ClaimTable rows={beforeReplace} />
      </div>
      <div>
        <p className="mb-2 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
          User says: &quot;Actually I eat meat now&quot;
        </p>
        <ClaimTable rows={afterReplace} />
      </div>
    </div>
  );
}

const structuredFeature = {
  icon: Tags,
  eyebrow: "Structured facts",
  title: "Facts, not chunks.",
  description:
    "Extraction returns entity + type (semantic or episodic). Optional registry seeds canonical keys — user.timezone, not a new label every turn.",
  snippet: 'seedEntities(db, [{ key: "user.timezone", ... }])',
};

const classifyFeature = {
  icon: Workflow,
  eyebrow: "Resolve & classify",
  title: "Align keys, then write.",
  description:
    "Entity resolution matches similar keys (vector + optional LLM) before classify runs ADD, UPDATE, REPLACE, or NOOP. Cross-agent conflicts use recency or authority per entity.",
  snippet: 'entityStrategies: { "user.*": "authority" }',
};

const retrievalFeature = {
  icon: Search,
  eyebrow: "Retrieval",
  title: "Search by meaning.",
  description:
    "Queries are embedded and matched with cosine similarity. Ask about food preferences and get the diet claim — even when the query never mentions vegetarian.",
  snippet: 'memory.search("what does the user eat?")',
};

const attributionFeature = {
  icon: Archive,
  eyebrow: "Lifecycle",
  title: "Every claim has a trail.",
  description:
    "Claims carry sourceAgent, conversationId, and status (active, superseded, or disputed). Superseded facts stay for audit; search returns active memory for your agent.",
};

export const Features = () => (
  <div id="features" className="border-y border-dashed dark:border-neutral-700/50">
    <div className="grid grid-cols-1 md:grid-cols-3">
      {/* Header */}
      <div className="border-b border-dashed px-4 py-16 md:col-span-2 md:border-r dark:border-neutral-700/50">
        <Eyebrow>Features</Eyebrow>
        <Heading as="h2" size="h2" className="mb-3">
          Memory that stays accurate.
          <br />
          <span className="text-neutral-400">Not another chunk store.</span>
        </Heading>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
          Most agent memory is append-only. Vault resolves entity keys, classifies
          every fact before it lands, and applies per-entity conflict policy — so
          contradictions resolve and restatements don&apos;t bloat your database.
        </p>
      </div>

      {/* Showcase: contradiction handling */}
      <Card className="flex h-full flex-col justify-between border-b border-dashed md:row-span-2 dark:border-neutral-700/50">
        <CardContent className="flex-1">
          <IconBox variant="static" className="mb-8 w-fit">
            <GitMerge className="h-4 w-4" />
          </IconBox>
          <CardHeader>
            <CardTitle>Contradiction handling</CardTitle>
          </CardHeader>
          <Heading as="h3" size="h3" className="mb-4">
            Old facts get superseded,
            <br />
            <span className="text-neutral-400">not duplicated.</span>
          </Heading>
          <CardDescription className="text-sm">
            When a user corrects themselves, REPLACE marks the prior claim as
            superseded and stores the new one as active. One entity, one truth.
          </CardDescription>
        </CardContent>
        <CardFooter className="mt-auto">
          <MemoryInspector />
        </CardFooter>
      </Card>

      {/* Structured extraction + classification */}
      {[structuredFeature, classifyFeature].map((feature) => {
        const Icon = feature.icon;
        return (
          <Card
            key={feature.eyebrow}
            className="gap-4 border-b border-dashed md:border-r dark:border-neutral-700/50"
          >
            <CardContent>
              <IconBox variant="static" className="mb-4 w-fit">
                <Icon className="h-4 w-4" />
              </IconBox>
              <CardHeader>
                <CardTitle>{feature.eyebrow}</CardTitle>
              </CardHeader>
              <Heading as="h3" size="h4" className="mb-2">
                {feature.title}
              </Heading>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
            <CardFooter>
              <CodeSnippet code={feature.snippet} />
            </CardFooter>
          </Card>
        );
      })}

      {/* Multi-agent — the main differentiator, earns the large card */}
      <Card className="gap-4 border-b border-dashed md:col-span-2 md:row-span-2 md:border-r md:border-b-0 dark:border-neutral-700/50">
        <CardContent>
          <IconBox variant="static" className="mb-4 w-fit">
            <Users className="h-4 w-4" />
          </IconBox>
          <CardHeader>
            <CardTitle>Multi-agent</CardTitle>
          </CardHeader>
          <Heading as="h3" size="h3" className="mb-4">
            Shared store.
            <br />
            <span className="text-neutral-400">Resolved conflicts.</span>
          </Heading>
          <CardDescription className="mb-8 text-sm">
            Multiple agents share one database. When agent B contradicts agent A on
            the same entity, Vault resolves via recency or authority — higher-trust
            agents win; equal authority produces a disputed claim and audit row,
            not a silent overwrite.
          </CardDescription>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-dashed border-neutral-800 p-4">
              <p className="mb-3 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
                agent-a (scheduling)
              </p>
              <p className="font-mono text-xs text-neutral-300">
                user.timezone → &quot;The user is in PST&quot;
              </p>
              <p className="mt-2 font-mono text-[11px] text-neutral-500">
                status: active · authority 0.9
              </p>
            </div>
            <div className="border border-dashed border-neutral-800 p-4">
              <p className="mb-3 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
                agent-b (chat)
              </p>
              <p className="font-mono text-xs text-neutral-300">
                user.timezone → &quot;The user is in EST&quot;
              </p>
              <p className="mt-2 font-mono text-[11px] text-amber-500/80">
                status: disputed · authority 0.2
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retrieval + lifecycle */}
      <Card className="gap-4 border-b border-dashed dark:border-neutral-700/50">
        <CardContent>
          <IconBox variant="static" className="mb-4 w-fit">
            <Search className="h-4 w-4" />
          </IconBox>
          <CardHeader>
            <CardTitle>{retrievalFeature.eyebrow}</CardTitle>
          </CardHeader>
          <Heading as="h3" size="h4" className="mb-2">
            {retrievalFeature.title}
          </Heading>
          <CardDescription>{retrievalFeature.description}</CardDescription>
        </CardContent>
        <CardFooter>
          <CodeSnippet code={retrievalFeature.snippet} />
        </CardFooter>
      </Card>

      <Card className="gap-4">
        <CardContent>
          <IconBox variant="static" className="mb-4 w-fit">
            <Archive className="h-4 w-4" />
          </IconBox>
          <CardHeader>
            <CardTitle>{attributionFeature.eyebrow}</CardTitle>
          </CardHeader>
          <Heading as="h3" size="h4" className="mb-2">
            {attributionFeature.title}
          </Heading>
          <CardDescription>{attributionFeature.description}</CardDescription>
        </CardContent>
      </Card>
    </div>
  </div>
);
