"use client";

import * as React from "react";

import { type HTMLMotionProps, motion } from "motion/react";

import { cn } from "@/lib/utils";

interface ExpandingButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "children"
> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const ExpandingButton = React.forwardRef<
  HTMLButtonElement,
  ExpandingButtonProps
>(({ children, icon, className, ...props }, ref) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <motion.button
      ref={ref}
      layout
      className={cn(
        "inline-flex cursor-pointer items-center justify-center",
        "text-sm font-medium",
        "bg-neutral-900 text-white",
        "dark:bg-white dark:text-black",
        "disabled:pointer-events-none disabled:opacity-50",
        "px-4 py-2.5",
        className
      )}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      transition={{ layout: { duration: 0.2, ease: "easeInOut" } }}
      {...props}
    >
      <span className="flex items-center gap-2">
        <motion.span layout="position" className="whitespace-nowrap">
          {children}
        </motion.span>

        {icon && (
          <motion.span
            className="inline-flex items-center overflow-hidden"
            animate={{
              width: hovered ? 16 : 0,
              opacity: hovered ? 1 : 0,
            }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ flexShrink: 0 }}
          >
            {icon}
          </motion.span>
        )}
      </span>
    </motion.button>
  );
});

ExpandingButton.displayName = "ExpandingButton";

export { ExpandingButton };
export type { ExpandingButtonProps };
