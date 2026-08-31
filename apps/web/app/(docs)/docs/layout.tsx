import { DocsHeader } from "@/components/docs/header";
import { DocsSidebar } from "@/components/docs/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DocsHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 md:px-8">
        <aside className="hidden w-56 shrink-0 md:block lg:w-64">
          <div className="sticky top-24">
            <DocsSidebar />
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
