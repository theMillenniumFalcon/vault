import * as React from "react";

import { cn } from "@/lib/utils";

const Eyebrow = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "mb-4 text-xs tracking-widest text-neutral-400 uppercase",
      className
    )}
    {...props}
  />
));
Eyebrow.displayName = "Eyebrow";

export { Eyebrow };
