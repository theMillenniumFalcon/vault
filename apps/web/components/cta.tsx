"use client";

import Link from "next/link";

import { Dithering } from "@paper-design/shaders-react";
import { ArrowRight } from "lucide-react";

import { ExpandingButton } from "@/components/ui/animated/expanding-button";
import { Heading } from "@/components/ui/heading";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

export const CTA = () => (
  <div className="relative flex flex-col items-center justify-center overflow-hidden border-t border-dashed border-neutral-700/50 px-4 py-16 text-center">
    <div className="pointer-events-none absolute inset-0">
      <Dithering
        style={{ height: "100%", width: "100%" }}
        colorBack="#050505"
        colorFront="hsl(0, 0%, 20%)"
        shape="simplex"
        type="4x4"
        pxSize={3}
        offsetX={0}
        offsetY={0}
        scale={0.8}
        rotation={0}
        speed={0.2}
      />
    </div>

    <div className="relative z-10 flex flex-col items-center">
      <Heading as="h2" size="h1" className="mb-4">
        Give your agents memory today.
      </Heading>

      <p className="mb-10 max-w-md text-sm leading-relaxed text-neutral-500 md:text-base dark:text-neutral-400">
        Install vault-memory, wire it to your agent, and stop losing context
        across conversations.{" "}
        <span className="whitespace-nowrap text-neutral-100 underline underline-offset-4">
          MIT licensed.
        </span>
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          <ExpandingButton
            icon={<ArrowRight size={16} strokeWidth={2.2} />}
            className="px-10"
          >
            Star on GitHub
          </ExpandingButton>
        </Link>
      </div>
    </div>
  </div>
);