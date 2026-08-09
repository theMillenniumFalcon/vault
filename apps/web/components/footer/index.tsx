import { FooterNav } from "./footerNav";
import { FooterText } from "./footerText";

export const Footer = () => (
  <footer className="border-t border-dashed border-neutral-700/50 bg-black/80">
    <div className="dark:border-x-dark mx-auto box-border w-[1200px] border-x border-dashed max-2xl:w-[1100px] max-xl:w-[900px] max-lg:w-[700px] max-md:w-[500px] max-sm:w-[400px] dark:border-neutral-700/50">
      <FooterNav />
      <FooterText />
    </div>
  </footer>
);
