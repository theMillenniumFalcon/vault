import { Archive, GitMerge, Users } from "lucide-react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";

const useCases = [
  {
    icon: Users,
    title: "Multi-agent teams",
    description:
      "Scheduling, chat, and tool agents share one database. Compatible facts on the same subject stay. Real disagreements use recency or authority, with a dispute row when trust cannot pick a winner.",
  },
  {
    icon: GitMerge,
    title: "Facts that evolve",
    description:
      "Users correct themselves, preferences change, context shifts. REPLACE supersedes old claims instead of piling on contradictions or duplicate chunks.",
  },
  {
    icon: Archive,
    title: "Audit trails",
    description:
      "Every claim carries sourceAgent, conversationId, and status. Superseded and disputed facts stay in the record — nothing disappears without a trace.",
  },
];

export const UseCases = () => (
  <div id="use-cases" className="border-y border-dashed dark:border-neutral-700/50">
    <div className="border-b border-dashed px-4 py-16 dark:border-neutral-700/50">
      <Eyebrow>Use cases</Eyebrow>
      <Heading as="h2" size="h2" className="mb-3">
        Built for teams where
        <br />
        <span className="text-neutral-400">memory accuracy matters.</span>
      </Heading>
      <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
        Most agent memory is append-only. Vault fits when multiple writers,
        contradicting facts, and attribution all need to coexist in one store.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3">
      {useCases.map((useCase, i) => {
        const Icon = useCase.icon;
        const isLastCol = i === useCases.length - 1;

        return (
          <div
            key={useCase.title}
            className={[
              "flex flex-col gap-6 px-4 py-8",
              !isLastCol
                ? "border-b border-dashed md:border-r md:border-b-0 dark:border-neutral-700/50"
                : "",
            ].join(" ")}
          >
            <IconBox variant="static" className="w-fit">
              <Icon className="h-4 w-4" />
            </IconBox>

            <div className="flex flex-col gap-3">
              <Heading as="h3" size="h4">
                {useCase.title}
              </Heading>
              <p className="text-sm leading-relaxed text-neutral-500">
                {useCase.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
