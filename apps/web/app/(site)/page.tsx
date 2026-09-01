import { Separator } from "@/components/ui/separator";

import { Comparison } from "@/components/comparison";
import { CTA } from "@/components/cta";
import { FAQ } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { UseCases } from "@/components/use-cases";

export default function Home() {
  return (
    <>
      <Hero />
      <Separator />
      <HowItWorks />
      <Separator />
      <UseCases />
      <Separator />
      <Features />
      <Separator />
      <Comparison />
      <Separator />
      <FAQ />
      <Separator />
      <CTA />
    </>
  );
}
