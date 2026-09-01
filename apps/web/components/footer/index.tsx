import { NavLink } from "@/components/ui/nav-link";

import { FooterNav } from "./footerNav";
import { FooterText } from "./footerText";

const GITHUB_URL = "https://github.com/theMillenniumFalcon/vault";

export const Footer = () => (
  <footer className="border-t border-dashed border-neutral-700/50 bg-black/80">
    <div className="mx-auto box-border w-[1200px] max-2xl:w-[1100px] max-xl:w-[900px] max-lg:w-[700px] max-md:w-[500px] max-sm:w-[400px]">
      <FooterNav />

      <div className="flex flex-col gap-2 px-4 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
          Built by{" "}
          <NavLink
            href={GITHUB_URL}
            external
            tone="brand"
            className="font-mono text-[10px] tracking-widest uppercase"
          >
            @theMillenniumFalcon
          </NavLink>
        </p>
        <p className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase sm:text-right">
          © {new Date().getFullYear()} · Vault · MIT licensed
        </p>
      </div>
    </div>

    <FooterText />
  </footer>
);
