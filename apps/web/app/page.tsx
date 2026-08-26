import { Separator } from "@/components/ui/separator";

import { CTA } from "@/components/cta";
import { FAQ } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { GetStarted } from "@/components/get-started";
import { Skills } from "@/components/skills";

export default function Home() {
  return (
    <>
      <Hero />
      <Separator />
      <HowItWorks />
      <Separator />
      <Skills />
      <Separator />
      <Features />
      <Separator />
      <GetStarted />
      <Separator />
      <FAQ />
      <Separator />
      <CTA />
    </>
  );
}