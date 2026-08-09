import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const navLinkVariants = cva("text-sm transition-colors duration-200", {
  variants: {
    tone: {
      default:
        "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300",
      brand: "font-bold text-neutral-300 hover:text-neutral-100",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export interface NavLinkProps
  extends
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof navLinkVariants> {
  href: string;
  external?: boolean;
}

const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  (
    { className, tone, external, href, children, ...props }: NavLinkProps,
    ref: React.ForwardedRef<HTMLAnchorElement>
  ): React.ReactElement => {
    const externalProps = external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    return (
      <a
        ref={ref}
        href={href}
        className={cn(navLinkVariants({ tone, className }))}
        {...externalProps}
        {...props}
      >
        {children}
      </a>
    );
  }
);

NavLink.displayName = "NavLink";

export { NavLink, navLinkVariants };
