"use client";

import { useState } from "react";

import Link from "next/link";

import { Menu, X } from "lucide-react";

import { Heading } from "@/components/ui/heading";
import { NavLink } from "@/components/ui/nav-link";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

export const Header = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-dashed bg-white/80 backdrop-blur-sm dark:border-neutral-700/50 dark:bg-black/80 dark:backdrop-blur-lg">
      <div className="dark:border-x-dark mx-auto box-border w-[1200px] border-x border-dashed px-4 max-2xl:w-[1100px] max-xl:w-[900px] max-lg:w-[700px] max-md:w-[500px] max-sm:w-[400px] dark:border-neutral-700/50">
        <nav className="flex items-center justify-between py-4">
          <Link href="/">
            <Heading
              as="h1"
              size="h5"
              className="transition-opacity duration-200 hover:opacity-80"
            >
              Vault
            </Heading>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map(({ href, label, external }) => (
              <NavLink key={href} href={href} external={external}>
                {label}
              </NavLink>
            ))}
          </div>

          <button
            className="p-1 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </nav>

        {open && (
          <div className="-mx-[calc(50vw-50%)] flex flex-col gap-4 border-t border-dashed px-[calc(50vw-50%)] py-4 md:hidden dark:border-neutral-700/50">
            {navLinks.map(({ href, label, external }) => (
              <NavLink
                key={href}
                href={href}
                external={external}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
