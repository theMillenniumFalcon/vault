"use client";

import * as React from "react";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

export interface CodeSnippetProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
}

const iconVariants = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6 },
};

const CodeSnippet = React.forwardRef<HTMLDivElement, CodeSnippetProps>(
  ({ className, code, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div
        ref={ref}
        onClick={handleCopy}
        className={cn(
          "flex cursor-copy items-center justify-between gap-4 border border-neutral-200 px-4 py-2.5 dark:border-neutral-700",
          className
        )}
        {...props}
      >
        <code className="truncate font-mono text-sm text-neutral-700 select-none dark:text-neutral-300">
          {code}
        </code>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          aria-label="Copy to clipboard"
          className="shrink-0 cursor-copy text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <div className="flex h-[25px] w-[25px] items-center justify-center rounded-md bg-neutral-200 dark:bg-neutral-800/50">
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
);

CodeSnippet.displayName = "CodeSnippet";

export { CodeSnippet };
