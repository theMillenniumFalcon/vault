import { Check, Minus, X } from "lucide-react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

type CellValue = "yes" | "partial" | "no" | string;

type ComparisonRow = {
  feature: string;
  vault: CellValue;
  supermemory: CellValue;
  mem0: CellValue;
};

const rows: ComparisonRow[] = [
  {
    feature: "Open source",
    vault: "yes",
    supermemory: "partial",
    mem0: "yes",
  },
  {
    feature: "Bring your own database",
    vault: "yes",
    supermemory: "no",
    mem0: "no",
  },
  {
    feature: "Structured facts (entity + type)",
    vault: "yes",
    supermemory: "yes",
    mem0: "partial",
  },
  {
    feature: "Contradiction handling",
    vault: "REPLACE + supersede",
    supermemory: "Graph auto-update",
    mem0: "ADD-only accumulation",
  },
  {
    feature: "Multi-agent conflict resolution",
    vault: "Authority / recency / disputed",
    supermemory: "Container isolation",
    mem0: "Shared by user ID",
  },
  {
    feature: "Entity key resolution",
    vault: "yes",
    supermemory: "yes",
    mem0: "Entity linking",
  },
  {
    feature: "ADD / UPDATE / REPLACE / NOOP",
    vault: "yes",
    supermemory: "Automatic",
    mem0: "ADD-only",
  },
  {
    feature: "Semantic search",
    vault: "yes",
    supermemory: "yes",
    mem0: "yes",
  },
  {
    feature: "Claim audit trail",
    vault: "Active, superseded, disputed",
    supermemory: "Graph history",
    mem0: "partial",
  },
  {
    feature: "Managed cloud",
    vault: "no",
    supermemory: "yes",
    mem0: "yes",
  },
  {
    feature: "RAG & connectors",
    vault: "no",
    supermemory: "yes",
    mem0: "partial",
  },
  {
    feature: "User profiles API",
    vault: "no",
    supermemory: "yes",
    mem0: "yes",
  },
  {
    feature: "Multimodal ingest",
    vault: "no",
    supermemory: "yes",
    mem0: "partial",
  },
];

function CellIcon({ value }: { value: CellValue }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-100">
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    );
  }

  if (value === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-400">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-xs">Partial</span>
      </span>
    );
  }

  if (value === "no") {
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-600">
        <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="sr-only">No</span>
      </span>
    );
  }

  return (
    <span className="block max-w-[9rem] text-xs leading-relaxed break-words text-neutral-400 sm:max-w-none">
      {value}
    </span>
  );
}

const columns = [
  { key: "vault" as const, label: "Vault", highlight: true },
  { key: "supermemory" as const, label: "Supermemory", highlight: false },
  { key: "mem0" as const, label: "Mem0", highlight: false },
];

export const Comparison = () => (
  <div
    id="comparison"
    className="min-w-0 max-w-full overflow-hidden border-y border-dashed pt-16 dark:border-neutral-700/50"
  >
    <div className="mb-10 px-4">
      <Eyebrow>Compare</Eyebrow>
      <Heading as="h2" size="h2" className="mb-3">
        How Vault
        <br />
        <span className="text-neutral-400">stacks up.</span>
      </Heading>
      <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
        Vault is built for teams that want structured, agent-attributed memory
        in their own database — with real conflict resolution when multiple
        agents write to the same store.
      </p>
    </div>

    <div className="w-full max-w-full overflow-x-auto overscroll-x-contain border-y border-dashed dark:border-neutral-700/50">
      <table className="w-full min-w-[32rem] text-left">
        <thead>
            <tr className="border-b border-dashed dark:border-neutral-700/50">
              <th className="px-3 py-4 font-mono text-[10px] tracking-widest whitespace-nowrap text-neutral-500 uppercase sm:px-4">
                Feature
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-4 font-mono text-[10px] tracking-widest whitespace-nowrap uppercase sm:px-4",
                    col.highlight
                      ? "text-neutral-100"
                      : "text-neutral-500",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.feature}
                className="border-b border-dashed last:border-b-0 dark:border-neutral-700/50"
              >
                <td className="px-3 py-3.5 text-sm text-neutral-300 sm:px-4">
                  {row.feature}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-3.5 sm:px-4",
                      col.highlight && "bg-neutral-900/40",
                    )}
                  >
                    <CellIcon value={row[col.key]} />
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </div>
);
