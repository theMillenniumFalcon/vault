import Link from "next/link";

import ShaderBackground from "@/components/shader-background";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

export const Hero = () => (
  <ShaderBackground className="border-b border-dashed px-4 py-24 md:py-32 dark:border-neutral-700/50">
    <div className="relative z-10 max-w-2xl">
        <Eyebrow className="mb-6">Open Source Agent Memory</Eyebrow>

        <Heading as="h1" size="h1" className="mb-6">
          Memory that agents
          <br />
          <span className="font-bold text-neutral-400">can trust.</span>
        </Heading>

        <p className="mb-8 max-w-lg text-sm leading-relaxed text-neutral-400 md:text-base">
          Vault extracts structured facts, resolves entity keys across agents,
          and retrieves memory semantically —{" "}
          <span className="whitespace-nowrap text-neutral-100 underline underline-offset-4">
            with your own database.
          </span>
        </p>

        <div className="mb-10 max-w-md">
          <CodeSnippet code="npm install vault-memory drizzle-orm" />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild className="px-8">
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              View on GitHub
            </Link>
          </Button>
          <Button asChild variant="inverted" className="px-8">
            <Link href="#how-it-works">How it works</Link>
          </Button>
        </div>
    </div>
  </ShaderBackground>
);
