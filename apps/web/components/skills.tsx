"use client";

import { Icon } from "@iconify/react";

import { CodeSnippet } from "@/components/ui/code-snippet";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";
import { Tooltip } from "@/components/ui/tooltip";

const integrations = [
  { icon: "simple-icons:openai", label: "OpenAI" },
  { icon: "simple-icons:anthropic", label: "Anthropic" },
  { icon: "simple-icons:sqlite", label: "SQLite" },
  { icon: "simple-icons:postgresql", label: "Postgres" },
  { icon: "lucide:cpu", label: "Any LLM provider" },
];

export const Skills = () => (
  <div className="border-y border-dashed px-4 py-16 dark:border-neutral-700/50">
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-24">
      <div className="flex flex-col justify-center">
        <Eyebrow>Bring your own stack</Eyebrow>
        <Heading as="h2" size="h2">
          Plugs into the agents and databases you already use.
        </Heading>
      </div>

      <div className="flex flex-col justify-center gap-6">
        <div className="flex items-center gap-3">
          {integrations.map(({ icon, label }) => (
            <Tooltip key={label} content={label}>
              <IconBox variant="static" aria-label={label}>
                <Icon icon={icon} className="h-4 w-4" />
              </IconBox>
            </Tooltip>
          ))}
        </div>

        <p className="max-w-md text-sm leading-relaxed text-neutral-400 md:text-base">
          Override the default OpenAI embed and LLM functions to use OpenRouter,
          Anthropic, or a local model. Connect any Drizzle-supported database —
          SQLite, Postgres, or bun:sqlite.
        </p>

        <CodeSnippet code='import { Memory } from "vault-memory"' />
      </div>
    </div>
  </div>
);
