import Link from "next/link";

import {
  BookOpen,
  Database,
  Download,
  GitBranch,
  Lightbulb,
  Rocket,
  Tags,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MDXComponents } from "mdx/types";

const icons: Record<string, LucideIcon> = {
  tags: Tags,
  "code-branch": GitBranch,
  users: Users,
  database: Database,
  rocket: Rocket,
  download: Download,
  book: BookOpen,
};

type CardProps = {
  title: string;
  icon?: string;
  href?: string;
  children: React.ReactNode;
};

export function Card({ title, icon, href, children }: CardProps) {
  const Icon = icon ? icons[icon] : undefined;
  const body = (
    <div className="flex h-full flex-col rounded-lg border border-neutral-800 bg-neutral-950 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80">
      <div className="mb-3 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-neutral-400" /> : null}
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-neutral-400">{children}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full no-underline">
        {body}
      </Link>
    );
  }

  return body;
}

export function CardGroup({
  cols = 2,
  children,
}: {
  cols?: number;
  children: React.ReactNode;
}) {
  const colClass =
    cols === 2
      ? "md:grid-cols-2"
      : cols === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-1";

  return <div className={`grid grid-cols-1 gap-4 ${colClass}`}>{children}</div>;
}

export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex gap-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100/90">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <div>{children}</div>
    </div>
  );
}

export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex gap-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div>{children}</div>
    </div>
  );
}

export const docsMdxComponents: MDXComponents = {
  Card,
  CardGroup,
  Tip,
  Warning,
  h1: (props) => (
    <h1 className="mb-6 text-3xl font-semibold tracking-tight text-neutral-50" {...props} />
  ),
  h2: (props) => (
    <h2
      className="mb-4 mt-10 border-b border-neutral-800 pb-2 text-xl font-semibold text-neutral-100"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mb-3 mt-8 text-lg font-medium text-neutral-100" {...props} />
  ),
  p: (props) => (
    <p className="mb-4 text-sm leading-7 text-neutral-400" {...props} />
  ),
  ul: (props) => (
    <ul className="mb-4 list-disc space-y-2 pl-5 text-sm text-neutral-400" {...props} />
  ),
  ol: (props) => (
    <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-neutral-400" {...props} />
  ),
  li: (props) => <li className="leading-7" {...props} />,
  a: (props) => (
    <a
      className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-200"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="mb-6 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs leading-6 text-neutral-300"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border border-neutral-800 bg-neutral-900 px-3 py-2 font-medium text-neutral-200"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-neutral-800 px-3 py-2 text-neutral-400" {...props} />
  ),
};
