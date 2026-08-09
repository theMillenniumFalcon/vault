"use client";

import * as React from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// --- Context ---

interface AccordionContextValue {
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItem: null,
  setOpenItem: () => {},
});

// --- Root ---

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: string;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, defaultOpen = null, children, ...props }, ref) => {
    const [openItem, setOpenItem] = React.useState<string | null>(defaultOpen);

    return (
      <AccordionContext.Provider value={{ openItem, setOpenItem }}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = "Accordion";

// --- Item ---

interface AccordionItemContextValue {
  id: string;
  isOpen: boolean;
  toggle: () => void;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue>({
  id: "",
  isOpen: false,
  toggle: () => {},
});

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, id, children, ...props }, ref) => {
    const { openItem, setOpenItem } = React.useContext(AccordionContext);
    const isOpen = openItem === id;
    const toggle = () => setOpenItem(isOpen ? null : id);

    return (
      <AccordionItemContext.Provider value={{ id, isOpen, toggle }}>
        <div
          ref={ref}
          className={cn(
            "border-b border-dashed dark:border-neutral-700/50",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = "AccordionItem";

// --- Trigger ---

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, toggle } = React.useContext(AccordionItemContext);

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center justify-between py-5 text-left text-sm font-medium",
        "text-neutral-900 dark:text-white",
        "transition-colors duration-150 hover:text-neutral-600 dark:hover:text-neutral-300",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

// --- Content ---

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen } = React.useContext(AccordionItemContext);

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 pb-5" : "max-h-0"
      )}
      {...props}
    >
      <p
        className={cn(
          "text-sm leading-relaxed text-neutral-500 dark:text-neutral-400",
          className
        )}
      >
        {children}
      </p>
    </div>
  );
});
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
