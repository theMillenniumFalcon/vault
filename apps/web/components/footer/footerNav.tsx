import { Icon } from "@iconify/react";

import { Heading } from "@/components/ui/heading";
import { NavLink } from "@/components/ui/nav-link";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

export const FooterNav = () => (
  <div className="flex flex-col justify-between gap-10 px-4 py-8 md:flex-row">
    <div className="flex flex-col gap-2">
      <NavLink href="/">
        <Heading
          as="h1"
          size="h3"
          className="mb-1 transition-opacity duration-200 hover:opacity-80"
        >
          Vault
        </Heading>
      </NavLink>
      <p className="text-sm text-neutral-500">
        Agent-attributed memory for AI agents. MIT licensed.
      </p>
      <p className="text-sm text-neutral-500">
        © {new Date().getFullYear()}{" "}
        <NavLink href={GITHUB_URL} tone="brand" external>
          @theMillenniumFalcon
        </NavLink>
      </p>
    </div>

    <div className="grid grid-cols-2 gap-8 md:flex md:flex-wrap md:gap-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Product</p>
        <div className="flex flex-col gap-2">
          <NavLink href="/#how-it-works">How it works</NavLink>
          <NavLink href="/#features">Features</NavLink>
          <NavLink href="/#get-started">Get started</NavLink>
          <NavLink href="/#faq">FAQ</NavLink>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Packages</p>
        <div className="flex flex-col gap-2">
          <NavLink
            href="https://www.npmjs.com/package/vault-memory"
            external
          >
            vault-memory
          </NavLink>
          <NavLink href={`${GITHUB_URL}/tree/main/apps/cli-agent`} external>
            CLI agent
          </NavLink>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Resources</p>
        <div className="flex flex-col gap-2">
          <NavLink href={`${GITHUB_URL}#readme`} external>
            Documentation
          </NavLink>
          <NavLink href={GITHUB_URL} external>
            GitHub Repository
          </NavLink>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Links</p>
        <div className="flex flex-col gap-2">
          <NavLink
            href={GITHUB_URL}
            external
            className="flex items-center gap-2"
          >
            <Icon icon="simple-icons:github" className="h-4 w-4" />
            GitHub
          </NavLink>
          <NavLink
            href="mailto:nishankpr435@gmail.com"
            className="flex items-center gap-2"
          >
            <Icon icon="material-symbols:mail" className="h-4 w-4" />
            Mail
          </NavLink>
        </div>
      </div>
    </div>
  </div>
);
