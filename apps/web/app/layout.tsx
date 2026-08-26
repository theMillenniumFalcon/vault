import type { Metadata } from "next";
import { JetBrains_Mono, Syne } from "next/font/google";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

import "./globals.css";

const syne = Syne({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Vault",
  description:
    "Agent-attributed memory for AI agents — extract structured facts, resolve entity keys, classify contradictions, and search semantically in your own database.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${syne.variable} ${jetbrainsMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <Header />
        <main className="flex-1 bg-black/80">
          <div className="mx-auto box-border w-[1200px] border-x border-dashed border-neutral-700/50 max-2xl:w-[1100px] max-xl:w-[900px] max-lg:w-[700px] max-md:w-[500px] max-sm:w-[400px]">
            {children}
          </div>
        </main>
        <Footer />
      </body>
    </html>
  );
}