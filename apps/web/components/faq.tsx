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
      "Any database Drizzle supports — SQLite, Postgres, bun:sqlite, and more. The library includes optional FAISS vector store backends for production deployments.",
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
      "Multiple agents share one database. Vault aligns subject labels, then loads every other agent's active claim on that subject. A model labels each one equivalent, compatible, or contradicting. Only contradictions use recency or authority. Equal or lower authority stores the new claim as disputed.",
  },
  {
    id: "contradictions",
    question: "What happens when facts contradict?",
    answer:
      "The same agent gets REPLACE: the old claim is superseded and the new one is active. Across agents, a restatement writes nothing, a compatible fact is stored beside the old one, and a contradiction uses recency or authority. Wildcards like user.schedule.* are supported. Equal authority leaves an open dispute.",
  },
  {
    id: "entities",
    question: "How does entity resolution work?",
    answer:
      "Extractors can drift labels (user.xyz vs user.timezone). Before classify, Vault embeds the fact text and compares it with existing active claims. A score of 0.85 or higher adopts the existing subject. Between 0.70 and 0.85, an optional model call decides. Below that, the extracted label stays. useEntityRegistry can also limit extraction to keys you seed.",
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
