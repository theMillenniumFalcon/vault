import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// --- Card Root ---

const cardVariants = cva("relative flex flex-col overflow-hidden p-8", {
  variants: {
    highlight: {
      true: "bg-neutral-950",
      false: "",
    },
  },
  defaultVariants: {
    highlight: false,
  },
});

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, highlight, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(cardVariants({ highlight, className }))}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

// --- Card Header ---

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mb-1 flex items-center justify-between", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// --- Card Badge ---

const CardBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "bg-white px-2 py-0.5 font-mono text-[10px] text-black",
      className
    )}
    {...props}
  />
));
CardBadge.displayName = "CardBadge";

// --- Card Title ---

const CardTitle = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "font-mono text-sm tracking-widest text-neutral-400 uppercase",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// --- Card Price ---

const CardPrice = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-4 mb-3", className)} {...props} />
));
CardPrice.displayName = "CardPrice";

// --- Card Description ---

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("mb-8 text-sm leading-relaxed text-neutral-500", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// --- Card Content (feature list area) ---

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative z-10 flex h-full flex-col", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

// --- Card Footer (feature list) ---

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto flex flex-col gap-3", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardBadge,
  CardPrice,
  CardDescription,
  CardContent,
  CardFooter,
};
