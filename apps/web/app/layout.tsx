import type { Metadata } from "next";
import { JetBrains_Mono, Syne } from "next/font/google";

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
  title: {
    default: "Vault",
    template: "%s · Vault",
  },
  description:
    "Agent-attributed memory for AI agents — extract structured facts, resolve entity keys, classify contradictions, and search semantically in your own database.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body
        className={`${syne.variable} ${jetbrainsMono.variable} min-h-screen bg-[#0a0a0a] text-[#ededed] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
