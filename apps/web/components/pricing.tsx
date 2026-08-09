import Link from "next/link";

import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardBadge,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPrice,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

const tiers = [
  {
    name: "vault-memory",
    price: { monthly: 0, annual: 0 },
    description: "The core npm package. MIT licensed, self-hosted.",
    cta: "View on npm",
    ctaHref: "https://www.npmjs.com/package/vault-memory",
    highlight: false,
    features: [
      { label: "Extract & classify facts", included: true },
      { label: "Semantic search", included: true },
      { label: "ADD / UPDATE / REPLACE / NOOP", included: true },
      { label: "Bring your own Drizzle DB", included: true },
      { label: "Custom LLM & embed functions", included: true },
      { label: "Multi-agent conflict resolution", included: true },
      { label: "FAISS vector store", included: false },
      { label: "Postgres vector store", included: false },
      { label: "Authority / LLM-judge strategies", included: false },
      { label: "Hosted managed service", included: false },
    ],
  },
  {
    name: "CLI agent",
    price: { monthly: 0, annual: 0 },
    description: "Interactive demo in the monorepo. Try it locally.",
    cta: "Clone repo",
    ctaHref: GITHUB_URL,
    highlight: true,
    badge: "Try it now",
    features: [
      { label: "Extract & classify facts", included: true },
      { label: "Semantic search", included: true },
      { label: "ADD / UPDATE / REPLACE / NOOP", included: true },
      { label: "Bring your own Drizzle DB", included: true },
      { label: "Custom LLM & embed functions", included: true },
      { label: "Multi-agent conflict resolution", included: true },
      { label: "FAISS vector store", included: true },
      { label: "Postgres vector store", included: true },
      { label: "Authority / LLM-judge strategies", included: false },
      { label: "Hosted managed service", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: { monthly: null, annual: null },
    description: "Custom deployments, strategies, and support.",
    cta: "Contact us",
    ctaHref: "mailto:nishankpr435@gmail.com",
    highlight: false,
    features: [
      { label: "Extract & classify facts", included: true },
      { label: "Semantic search", included: true },
      { label: "ADD / UPDATE / REPLACE / NOOP", included: true },
      { label: "Bring your own Drizzle DB", included: true },
      { label: "Custom LLM & embed functions", included: true },
      { label: "Multi-agent conflict resolution", included: true },
      { label: "FAISS vector store", included: true },
      { label: "Postgres vector store", included: true },
      { label: "Authority / LLM-judge strategies", included: true },
      { label: "Hosted managed service", included: true },
    ],
  },
];

export const Pricing = () => {
  return (
    <div id="pricing">
      <div className="border-y border-dashed border-neutral-700/50 px-4 py-16">
        <Eyebrow>Deployment</Eyebrow>
        <Heading as="h2" size="h2" className="mb-3">
          Open source at the core.
        </Heading>
        <p className="max-w-xl text-sm leading-relaxed text-neutral-500 md:text-base">
          Install the library, run the CLI demo, or talk to us about a custom
          deployment. No hosted lock-in.
        </p>
      </div>

      <div className="grid grid-cols-1 border-b border-dashed border-neutral-700/50 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            highlight={tier.highlight}
            className={
              tier.highlight
                ? "border-y border-dashed border-neutral-700/50 md:border-x md:border-y-0"
                : undefined
            }
          >
            <CardContent>
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                {"badge" in tier && tier.badge && (
                  <CardBadge>{tier.badge}</CardBadge>
                )}
              </CardHeader>

              <CardPrice>
                {tier.price.monthly === null ? (
                  <span
                    className={`text-3xl font-bold tracking-tight ${tier.highlight ? "text-white" : ""}`}
                  >
                    Custom
                  </span>
                ) : (
                  <span
                    className={`text-3xl font-bold tracking-tight ${tier.highlight ? "text-white" : ""}`}
                  >
                    Free
                  </span>
                )}
              </CardPrice>

              <CardDescription
                className={tier.highlight ? "text-neutral-400" : ""}
              >
                {tier.description}
              </CardDescription>

              <Button
                asChild
                variant={tier.highlight ? "default" : "outline"}
                className="mb-8 w-full"
              >
                <Link
                  href={tier.ctaHref}
                  {...(tier.ctaHref.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {tier.cta}
                </Link>
              </Button>

              <CardFooter>
                {tier.features.map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    {f.included ? (
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${tier.highlight ? "text-white" : "text-neutral-200"}`}
                      />
                    ) : (
                      <Minus className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    )}
                    <span
                      className={`text-sm leading-relaxed ${
                        f.included
                          ? tier.highlight
                            ? "text-neutral-200"
                            : "text-neutral-300"
                          : "text-neutral-500"
                      }`}
                    >
                      {f.label}
                    </span>
                  </div>
                ))}
              </CardFooter>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
