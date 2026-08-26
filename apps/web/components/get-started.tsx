import Link from "next/link";

import { Button } from "@/components/ui/button";
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

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";
const NPM_URL = "https://www.npmjs.com/package/vault-memory";
const CLI_URL = `${GITHUB_URL}/tree/main/apps/cli-agent`;

const steps = [
  {
    number: "01",
    title: "Install",
    description:
      "Add vault-memory and Drizzle. You bring the database driver — SQLite, Postgres, or bun:sqlite.",
    snippet: "npm install vault-memory drizzle-orm",
    cta: "View on npm",
    href: NPM_URL,
    highlight: false,
  },
  {
    number: "02",
    title: "Wire it to an agent",
    description:
      "Construct Memory with your Drizzle db. add() extracts and classifies facts; search() retrieves them by meaning.",
    snippet: 'await memory.add(messages, "conversation-1")',
    cta: "Read the docs",
    href: `${GITHUB_URL}#readme`,
    highlight: true,
  },
  {
    number: "03",
    title: "Try the CLI",
    description:
      "Chat locally, then inspect claims with /search and /claims. Run two agents on one SQLite file to see conflicts.",
    snippet: "bun run start:agent-a",
    cta: "Open CLI agent",
    href: CLI_URL,
    highlight: false,
  },
] as const;

export const GetStarted = () => (
  <div id="get-started">
    <div className="border-y border-dashed border-neutral-700/50 px-4 py-16">
      <Eyebrow>Get started</Eyebrow>
      <Heading as="h2" size="h2" className="mb-3">
        Install, wire, try it.
      </Heading>
      <p className="max-w-xl text-sm leading-relaxed text-neutral-500 md:text-base">
        MIT licensed. Runs in your process, on your database — no hosted
        service to sign up for.
      </p>
    </div>

    <div className="grid grid-cols-1 border-b border-dashed border-neutral-700/50 md:grid-cols-3">
      {steps.map((step) => (
        <Card
          key={step.number}
          highlight={step.highlight}
          className={
            step.highlight
              ? "border-y border-dashed border-neutral-700/50 md:border-x md:border-y-0"
              : undefined
          }
        >
          <CardContent>
            <CardHeader>
              <CardTitle>{step.number}</CardTitle>
            </CardHeader>
            <Heading
              as="h3"
              size="h4"
              className={`mb-3 ${step.highlight ? "text-white" : ""}`}
            >
              {step.title}
            </Heading>
            <CardDescription
              className={step.highlight ? "text-neutral-400" : ""}
            >
              {step.description}
            </CardDescription>
            <Button
              asChild
              variant={step.highlight ? "default" : "outline"}
              className="mb-8 w-full"
            >
              <Link
                href={step.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {step.cta}
              </Link>
            </Button>
            <CardFooter>
              <CodeSnippet code={step.snippet} />
            </CardFooter>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);
