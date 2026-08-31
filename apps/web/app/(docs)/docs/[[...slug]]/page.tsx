import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { docsMdxComponents } from "@/components/docs/mdx";
import { getAllDocPages, pageToHref } from "@/lib/docs/navigation";
import { getDocPage } from "@/lib/docs/content";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  return getAllDocPages().map((page) => {
    const href = pageToHref(page);
    const slug = href === "/docs" ? undefined : href.replace(/^\/docs\//, "");
    return { slug: slug ? slug.split("/") : [] };
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocPage(slug);

  if (!doc) {
    return { title: "Not found" };
  }

  return {
    title: doc.title,
    description: doc.description,
  };
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocPage(slug);

  if (!doc) {
    notFound();
  }

  return (
    <article className="max-w-3xl pb-16">
      <header className="mb-8 border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">
          {doc.title}
        </h1>
        {doc.description ? (
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            {doc.description}
          </p>
        ) : null}
      </header>
      <MDXRemote source={doc.content} components={docsMdxComponents} />
    </article>
  );
}
