"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getDocsNavigation } from "@/lib/docs/navigation";
import { cn } from "@/lib/utils";

export function DocsSidebar() {
  const pathname = usePathname();
  const groups = getDocsNavigation();

  return (
    <nav className="space-y-8">
      {groups.map((group) => (
        <div key={group.group}>
          <p className="mb-3 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
            {group.group}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    pathname === item.href
                      ? "bg-neutral-900 text-neutral-100"
                      : "text-neutral-500 hover:bg-neutral-900/60 hover:text-neutral-300",
                  )}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
