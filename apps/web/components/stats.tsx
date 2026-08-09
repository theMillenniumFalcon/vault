import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";

const operations = [
  "ADD",
  "UPDATE",
  "REPLACE",
  "NOOP",
  "SEARCH",
  "EXTRACT",
  "CLASSIFY",
  "RESOLVE",
];

export const Stats = () => (
  <div className="grid grid-cols-1 border-b border-dashed py-12 md:grid-cols-[280px_1fr] dark:border-neutral-700/50">
    {/* Left — hero stat */}
    <div className="flex flex-col justify-center gap-2 px-4">
      <Heading as="h2" size="h2">
        4 ops
      </Heading>
      <p className="max-w-lg text-sm leading-relaxed text-neutral-500 md:text-base">
        ADD, UPDATE, REPLACE, and NOOP — every fact classified before it hits
        your database.
      </p>
    </div>

    {/* Right — logo strip */}
    <div className="relative flex items-center overflow-hidden px-4 pt-10 md:pt-0">
      {/* Fade masks */}
      <div className="pointer-events-none absolute left-0 z-10 h-full w-16 bg-gradient-to-r from-white dark:from-black" />
      <div className="pointer-events-none absolute right-0 z-10 h-full w-16 bg-gradient-to-l from-white dark:from-black" />

      {/* Scrolling track */}
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: "marquee 25s linear infinite" }}
      >
        {[...operations, ...operations].map((name, i) => (
          <span
            key={i}
            className="font-mono text-sm font-medium tracking-tight text-neutral-300 md:text-base dark:text-neutral-600"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  </div>
);
