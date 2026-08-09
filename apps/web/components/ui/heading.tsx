import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const headingVariants = cva("font-bold tracking-tight", {
  variants: {
    size: {
      h1: "text-4xl leading-tight md:text-5xl",
      h2: "text-3xl leading-tight md:text-4xl",
      h3: "text-2xl leading-snug md:text-3xl",
      h4: "text-xl leading-snug md:text-2xl",
      h5: "text-lg leading-snug md:text-xl",
    },
    tone: {
      default: "text-neutral-900 dark:text-white",
      muted: "text-neutral-400",
    },
  },
  defaultVariants: {
    size: "h1",
    tone: "default",
  },
});

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5";

export interface HeadingProps
  extends
    React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: HeadingLevel;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, as: Tag = "h1", size, tone, ...props }, ref) => {
    return (
      <Tag
        className={cn(headingVariants({ size, tone, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Heading.displayName = "Heading";

export { Heading, headingVariants };
