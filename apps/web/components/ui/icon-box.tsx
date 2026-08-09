import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconBoxVariants = cva(
  "border border-neutral-200 p-2.5 text-neutral-400 transition-colors duration-200 dark:border-neutral-700",
  {
    variants: {
      variant: {
        // Reacts to a parent `group` — used in interactive cards/links
        interactive:
          "group-hover:border-neutral-400 group-hover:text-neutral-900 dark:group-hover:border-neutral-500 dark:group-hover:text-neutral-200",
        // No hover behaviour — used for static icon rows
        static: "",
      },
    },
    defaultVariants: {
      variant: "interactive",
    },
  }
);

export interface IconBoxProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconBoxVariants> {
  children: React.ReactNode;
}

const IconBox = React.forwardRef<HTMLDivElement, IconBoxProps>(
  ({ className, variant, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(iconBoxVariants({ variant, className }))}
      {...props}
    >
      {children}
    </div>
  )
);
IconBox.displayName = "IconBox";

export { IconBox };
