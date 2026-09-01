import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-black/80">
        <div className="mx-auto box-border w-full max-w-[1200px] min-w-0 border-x border-dashed border-neutral-700/50 max-2xl:max-w-[1100px] max-xl:max-w-[900px] max-lg:max-w-[700px] max-md:max-w-[500px] max-sm:max-w-[400px]">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
