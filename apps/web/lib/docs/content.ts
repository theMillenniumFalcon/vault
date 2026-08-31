import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { slugToPage } from "@/lib/docs/navigation";

const DOCS_ROOT = path.join(process.cwd(), "docs", "docs");

export type DocPage = {
  page: string;
  slug: string[];
  title: string;
  description?: string;
  content: string;
};

function pageToFilePath(page: string): string {
  const relative = page.replace(/^docs\//, "");
  const fileName = relative === "index" ? "index.mdx" : `${relative}.mdx`;
  return path.join(DOCS_ROOT, fileName);
}

export async function getDocPage(slug: string[] | undefined): Promise<DocPage | null> {
  const page = slugToPage(slug);
  const filePath = pageToFilePath(page);

  try {
    const source = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(source);

    return {
      page,
      slug: slug ?? [],
      title: (data.title as string) ?? "Documentation",
      description: data.description as string | undefined,
      content,
    };
  } catch {
    return null;
  }
}
