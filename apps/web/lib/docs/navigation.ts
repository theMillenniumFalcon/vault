import docsConfig from "@/docs/docs.json";

export type DocsNavItem = {
  title: string;
  href: string;
  page: string;
};

export type DocsNavGroup = {
  group: string;
  items: DocsNavItem[];
};

const PAGE_TITLES: Record<string, string> = {
  "docs/index": "Introduction",
  "docs/quickstart": "Quickstart",
  "docs/installation": "Installation",
  "docs/concepts/how-it-works": "How it works",
  "docs/concepts/claims-and-entities": "Claims and entities",
  "docs/concepts/classification": "Classification",
  "docs/concepts/multi-agent": "Multi-agent conflict",
  "docs/concepts/vector-store": "Vector store",
  "docs/guides/single-agent": "Single-agent setup",
  "docs/guides/multi-agent-setup": "Multi-agent setup",
  "docs/guides/cli-demo": "CLI demo",
  "docs/guides/dispute-resolution": "Dispute resolution",
  "docs/api/memory": "Memory class",
  "docs/api/configuration": "Configuration",
  "docs/api/schema": "Schema",
  "docs/api/disputes": "Disputes API",
};

export function pageToHref(page: string): string {
  const withoutPrefix = page.replace(/^docs\//, "");
  if (withoutPrefix === "index") return "/docs";
  return `/docs/${withoutPrefix}`;
}

export function slugToPage(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return "docs/index";
  return `docs/${slug.join("/")}`;
}

export function getDocsNavigation(): DocsNavGroup[] {
  const tab = docsConfig.navigation.tabs[0];
  if (!tab) return [];

  return tab.groups.map((group) => ({
    group: group.group,
    items: group.pages.map((page) => ({
      page,
      title: PAGE_TITLES[page] ?? page.split("/").pop() ?? page,
      href: pageToHref(page),
    })),
  }));
}

export function getAllDocPages(): string[] {
  return getDocsNavigation().flatMap((group) =>
    group.items.map((item) => item.page),
  );
}
