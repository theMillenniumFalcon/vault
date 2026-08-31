import Link from "next/link";

import { Heading } from "@/components/ui/heading";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-dashed border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80"
          >
            <Heading as="h1" size="h5">
              Vault
            </Heading>
            <span className="rounded-sm border border-dashed border-neutral-700/50 px-1.5 py-px font-mono text-[10px] tracking-widest text-neutral-400 uppercase">
              beta
            </span>
          </Link>
          <span className="hidden text-sm text-neutral-600 md:inline">/</span>
          <Link
            href="/docs"
            className="hidden text-sm text-neutral-400 transition-colors hover:text-neutral-200 md:inline"
          >
            Documentation
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Home
          </Link>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 transition-colors hover:text-neutral-300"
          >
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}
