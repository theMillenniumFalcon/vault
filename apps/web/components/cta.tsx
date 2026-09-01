"use client";

import Link from "next/link";

import { Dithering } from "@paper-design/shaders-react";
import { ArrowRight } from "lucide-react";

import { ExpandingButton } from "@/components/ui/animated/expanding-button";
import { Floating } from "@/components/ui/animated/floating";
import { Heading } from "@/components/ui/heading";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

// Simple V notch: straight line from each top corner down to a center point.
const V_CLIP_PATH = "polygon(0% 0%, 50% 100%, 100% 0%, 100% 100%, 0% 100%)";

export const CTA = () => (
  <div className="relative flex flex-col items-center justify-center overflow-hidden border-y border-dashed border-neutral-700/50 px-4 py-16 text-center">
    <div
      className="pointer-events-none absolute inset-0"
      style={{ clipPath: V_CLIP_PATH }}
    >
      <Dithering
        style={{ height: "100%", width: "100%" }}
        colorBack="rgba(0, 0, 0, 0)"
        colorFront="hsl(0, 0%, 30%)"
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
      <Floating className="mb-2">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 font-mono text-2xl font-bold text-white sm:h-32 sm:w-32">
          V
        </div>
      </Floating>

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