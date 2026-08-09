"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";

const faqs = [
  {
    id: "what-is-vault",
    question: "What is Vault?",
    answer:
      "Vault is an open-source memory layer for AI agents. It extracts structured facts from conversations, classifies them against existing memory (ADD, UPDATE, REPLACE, NOOP), and retrieves them via semantic search — all stored in your own database.",
  },
  {
    id: "free-to-use",
    question: "Is it free to use?",
    answer:
      "Yes. vault-memory is MIT licensed and free for personal and commercial use. You only pay for your own LLM and embedding API calls, plus whatever database hosting you choose.",
  },
  {
    id: "databases",
    question: "Which databases are supported?",
    answer:
      "Any database Drizzle supports. The CLI agent uses bun:sqlite out of the box. The library also includes optional Postgres and FAISS vector store backends for production deployments.",
  },
  {
    id: "llm-providers",
    question: "Can I use a provider other than OpenAI?",
    answer:
      "Yes. Pass custom embed and llm functions in the config to use OpenRouter, Anthropic, or a local model. The apiKey shortcut is just a convenience for OpenAI defaults.",
  },
  {
    id: "multi-agent",
    question: "How does multi-agent memory work?",
    answer:
      "Multiple agents can share one database. When agent B stores a fact that conflicts with agent A's claim on the same entity, Vault's cross-agent pass resolves it — recency wins by default, superseding the older claim.",
  },
  {
    id: "contradictions",
    question: "What happens when facts contradict?",
    answer:
      "Within the same agent, the classifier returns REPLACE and marks the old claim as superseded. Across agents, the recency strategy supersedes conflicting active claims. Restated facts return NOOP so nothing duplicates.",
  },
  {
    id: "cli-agent",
    question: "What is the CLI agent?",
    answer:
      "apps/cli-agent is an interactive demo. Run it with OPENAI_API_KEY set, chat naturally, and use /search and /claims to inspect memory. Set AGENT_ID and VAULT_DB_PATH to test multi-agent on a shared SQLite file.",
  },
  {
    id: "license",
    question: "What's the license?",
    answer:
      "MIT. Use vault-memory in personal and commercial projects without restriction.",
  },
];

export const FAQ = () => (
  <div
    id="faq"
    className="grid grid-cols-1 border-y border-dashed border-neutral-700/50 md:grid-cols-3"
  >
    <div className="mb-10 px-4 pt-16 pb-6 md:mb-0">
      <Eyebrow>FAQ</Eyebrow>
      <Heading as="h2" size="h2">
        Frequently Asked Questions
      </Heading>
    </div>

    <div className="border-t border-dashed px-4 pt-6 pb-16 md:col-span-2 md:border-t-0 md:border-l md:px-8 dark:border-neutral-700/50">
      <Accordion>
        {faqs.map((faq) => (
          <AccordionItem key={faq.id} id={faq.id}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </div>
);
