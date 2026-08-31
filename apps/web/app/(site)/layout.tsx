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
        <div className="mx-auto box-border w-[1200px] border-x border-dashed border-neutral-700/50 max-2xl:w-[1100px] max-xl:w-[900px] max-lg:w-[700px] max-md:w-[500px] max-sm:w-[400px]">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
