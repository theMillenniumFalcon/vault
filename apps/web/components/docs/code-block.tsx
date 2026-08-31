"use client";

import * as React from "react";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

function extractCode(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractCode).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return extractCode(children.props.children);
  }
  return "";
}

const iconVariants = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6 },
};

export function DocsCodeBlock({ children }: { children: React.ReactNode }) {
  const code = extractCode(children).replace(/\n$/, "");
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <pre className="overflow-x-auto p-4 pr-14 font-mono text-xs leading-6 text-neutral-300">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        className={cn(
          "absolute top-3 right-3 shrink-0 cursor-copy text-neutral-400",
          "hover:text-neutral-200",
        )}
      >
        <div className="flex h-[25px] w-[25px] items-center justify-center rounded-md bg-neutral-800/50">
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.div
                key="check"
                variants={iconVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
              >
                <Check className="h-3.5 w-3.5" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                variants={iconVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
              >
                <Copy className="h-3.5 w-3.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>
    </div>
  );
}
