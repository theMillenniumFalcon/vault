import { Icon } from "@iconify/react";

import { NavLink } from "@/components/ui/nav-link";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

const linkClass =
  "text-sm text-neutral-500 transition-colors hover:text-neutral-300";

const columnHeaderClass =
  "font-mono text-[10px] tracking-widest text-neutral-500 uppercase";

const socialLinks = [
  {
    href: GITHUB_URL,
    label: "GitHub",
    icon: "simple-icons:github",
  },
  {
    href: "https://www.npmjs.com/package/vault-memory",
    label: "npm",
    icon: "simple-icons:npm",
  },
  {
    href: "mailto:nishankpr435@gmail.com",
    label: "Email",
    icon: "material-symbols:mail",
  },
];

export const FooterNav = () => (
  <div className="grid grid-cols-2 gap-x-8 gap-y-10 px-4 pt-16 pb-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.55fr))_auto] lg:gap-10">
    <div className="col-span-2 flex max-w-md flex-col gap-4 lg:col-span-1">
      <p className="text-2xl leading-tight font-bold tracking-tight text-white md:text-3xl">
        Agent-attributed memory for AI agents.
      </p>
      <p className="text-sm leading-relaxed text-neutral-500 md:text-base">
        Open source. Your database. Built for teams where memory accuracy
        matters.
      </p>
    </div>

    <div className="flex flex-col gap-4">
      <p className={columnHeaderClass}>Product</p>
      <div className="flex flex-col gap-2.5">
        <NavLink href="/#how-it-works" className={linkClass}>
          How it works
        </NavLink>
        <NavLink href="/#use-cases" className={linkClass}>
          Use cases
        </NavLink>
        <NavLink href="/#features" className={linkClass}>
          Features
        </NavLink>
        <NavLink href="/#comparison" className={linkClass}>
          Compare
        </NavLink>
        <NavLink href="/#faq" className={linkClass}>
          FAQ
        </NavLink>
      </div>
    </div>

    <div className="flex flex-col gap-4">
      <p className={columnHeaderClass}>Resources</p>
      <div className="flex flex-col gap-2.5">
        <NavLink href="/docs" className={linkClass}>
          Documentation
        </NavLink>
        <NavLink
          href="https://www.npmjs.com/package/vault-memory"
          external
          className={linkClass}
        >
          vault-memory
        </NavLink>
        <NavLink href={GITHUB_URL} external className={linkClass}>
          GitHub
        </NavLink>
      </div>
    </div>

    <div className="flex flex-col gap-4">
      <p className={columnHeaderClass}>Project</p>
      <div className="flex flex-col gap-2.5">
        <NavLink href={GITHUB_URL} external className={linkClass}>
          Repository
        </NavLink>
        <NavLink href={`${GITHUB_URL}#readme`} external className={linkClass}>
          README
        </NavLink>
        <NavLink href="mailto:nishankpr435@gmail.com" className={linkClass}>
          Contact
        </NavLink>
      </div>
    </div>

    <div className="flex flex-col gap-4">
      <p className={columnHeaderClass}>Connect</p>
      <div className="flex items-center gap-4">
        {socialLinks.map(({ href, label, icon }) => (
          <NavLink
            key={label}
            href={href}
            external={href.startsWith("http")}
            aria-label={label}
            className="text-neutral-500 transition-colors hover:text-neutral-300"
          >
            <Icon icon={icon} className="h-4 w-4" />
          </NavLink>
        ))}
      </div>
    </div>
  </div>
);
