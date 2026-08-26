import { CodeSnippet } from "@/components/ui/code-snippet";
import { Heading } from "@/components/ui/heading";

const steps = [
  {
    number: "01",
    title: "Extract facts",
    description:
      "Pass conversation messages to Vault. An LLM pulls structured facts from the latest turn — diet preferences, timezone, project context — validated with Zod before anything is stored.",
    snippet: 'await memory.add(messages, "conversation-1")',
  },
  {
    number: "02",
    title: "Resolve & classify",
    description:
      "Entity resolution aligns keys to existing claims (vector match, optional LLM). Then each fact is classified: ADD, UPDATE, REPLACE, or NOOP. Cross-agent conflicts use recency or authority per entity.",
    snippet: 'entityStrategies: { "user.*": "authority" }',
  },
  {
    number: "03",
    title: "Search semantically",
    description:
      "Retrieve memories by meaning, not keywords. Embeddings power vector search scoped to your agent, with filters for entity, conversation, and status.",
    snippet: 'await memory.search("what does the user eat?")',
  },
];

export const HowItWorks = () => (
  <div
    id="how-it-works"
    className="grid grid-cols-1 border-y border-dashed md:grid-cols-3 dark:border-neutral-700/50"
  >
    {steps.map((step, i) => {
      const isLastCol = i === steps.length - 1;
      return (
        <div
          key={step.number}
          className={[
            "flex flex-col gap-6 px-4 py-8",
            !isLastCol
              ? "border-b border-dashed md:border-r md:border-b-0 md:border-dashed dark:border-neutral-700/50"
              : "",
          ].join(" ")}
        >
          <span className="font-mono text-sm text-neutral-300 md:text-base dark:text-neutral-600">
            {step.number}
          </span>

          <div className="relative">
            <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <div className="flex flex-col gap-3">
            <Heading as="h3" size="h4">
              {step.title}
            </Heading>
            <p className="text-sm leading-relaxed text-neutral-500">
              {step.description}
            </p>
          </div>

          {step.snippet && <CodeSnippet code={step.snippet} />}
        </div>
      );
    })}
  </div>
);
