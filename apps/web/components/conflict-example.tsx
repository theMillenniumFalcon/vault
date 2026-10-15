"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

type ClaimStatus = "active" | "superseded" | "disputed";

type Claim = {
  id: string;
  status: ClaimStatus;
  entity: string;
  text: string;
  agent: string;
  meta: string;
};

type Message = {
  id: string;
  agent: string;
  role: string;
  text: string;
};

type Frame = {
  op: "ADD" | "REPLACE" | "DISPUTED" | "CLASSIFY" | "NOOP";
  caption: string;
  messages: Message[];
  claims: Claim[];
};

type Scenario = {
  id: "add" | "replace" | "disputed";
  label: string;
  op: string;
  frames: Frame[];
};

const scenarios: Scenario[] = [
  {
    id: "add",
    label: "New fact",
    op: "ADD",
    frames: [
      {
        op: "CLASSIFY",
        caption:
          "A new mention lands. Vault extracts a structured fact before anything is written.",
        messages: [
          {
            id: "m-veg",
            agent: "agent-a",
            role: "chat",
            text: "I'm vegetarian.",
          },
        ],
        claims: [],
      },
      {
        op: "ADD",
        caption: "No existing claim on user.diet — stored as active.",
        messages: [
          {
            id: "m-veg",
            agent: "agent-a",
            role: "chat",
            text: "I'm vegetarian.",
          },
        ],
        claims: [
          {
            id: "diet-1",
            status: "active",
            entity: "user.diet",
            text: "The user is vegetarian",
            agent: "agent-a",
            meta: "ADD",
          },
        ],
      },
      {
        op: "NOOP",
        caption:
          "The user restates the same fact. NOOP — memory is unchanged, no duplicate row.",
        messages: [
          {
            id: "m-veg",
            agent: "agent-a",
            role: "chat",
            text: "I'm vegetarian.",
          },
          {
            id: "m-veg-again",
            agent: "agent-a",
            role: "chat",
            text: "Yeah, still vegetarian.",
          },
        ],
        claims: [
          {
            id: "diet-1",
            status: "active",
            entity: "user.diet",
            text: "The user is vegetarian",
            agent: "agent-a",
            meta: "NOOP",
          },
        ],
      },
    ],
  },
  {
    id: "replace",
    label: "Same agent",
    op: "REPLACE",
    frames: [
      {
        op: "ADD",
        caption: "The diet claim is already in memory.",
        messages: [
          {
            id: "m-veg",
            agent: "agent-a",
            role: "chat",
            text: "I'm vegetarian.",
          },
        ],
        claims: [
          {
            id: "diet-1",
            status: "active",
            entity: "user.diet",
            text: "The user is vegetarian",
            agent: "agent-a",
            meta: "active",
          },
        ],
      },
      {
        op: "CLASSIFY",
        caption:
          "Same agent, same entity — the new mention contradicts the stored claim.",
        messages: [
          {
            id: "m-veg",
            agent: "agent-a",
            role: "chat",
            text: "I'm vegetarian.",
          },
          {
            id: "m-meat",
            agent: "agent-a",
            role: "chat",
            text: "Actually I eat meat now.",
          },
        ],
        claims: [
          {
            id: "diet-1",
            status: "active",
            entity: "user.diet",
            text: "The user is vegetarian",
            agent: "agent-a",
            meta: "active",
          },
        ],
      },
      {
        op: "REPLACE",
        caption:
          "The old claim is superseded and kept as history. The meat fact is now the active one.",
        messages: [
          {
            id: "m-veg",
            agent: "agent-a",
            role: "chat",
            text: "I'm vegetarian.",
          },
          {
            id: "m-meat",
            agent: "agent-a",
            role: "chat",
            text: "Actually I eat meat now.",
          },
        ],
        claims: [
          {
            id: "diet-1",
            status: "superseded",
            entity: "user.diet",
            text: "The user is vegetarian",
            agent: "agent-a",
            meta: "was active",
          },
          {
            id: "diet-2",
            status: "active",
            entity: "user.diet",
            text: "The user eats meat",
            agent: "agent-a",
            meta: "REPLACE",
          },
        ],
      },
    ],
  },
  {
    id: "disputed",
    label: "Cross-agent",
    op: "DISPUTED",
    frames: [
      {
        op: "ADD",
        caption: "Scheduling agent writes timezone with high authority.",
        messages: [
          {
            id: "m-pst",
            agent: "agent-a",
            role: "scheduling",
            text: "Calendar onboarding — user is in PST.",
          },
        ],
        claims: [
          {
            id: "tz-a",
            status: "active",
            entity: "user.timezone",
            text: "The user is in PST",
            agent: "agent-a",
            meta: "authority 0.9",
          },
        ],
      },
      {
        op: "CLASSIFY",
        caption:
          "Chat agent mentions EST. The model marks it a contradiction, then authority decides.",
        messages: [
          {
            id: "m-pst",
            agent: "agent-a",
            role: "scheduling",
            text: "Calendar onboarding — user is in PST.",
          },
          {
            id: "m-est",
            agent: "agent-b",
            role: "chat",
            text: "Daily check-in — user mentioned EST.",
          },
        ],
        claims: [
          {
            id: "tz-a",
            status: "active",
            entity: "user.timezone",
            text: "The user is in PST",
            agent: "agent-a",
            meta: "authority 0.9",
          },
        ],
      },
      {
        op: "DISPUTED",
        caption:
          "Lower authority is parked as disputed. PST stays active — not a silent overwrite.",
        messages: [
          {
            id: "m-pst",
            agent: "agent-a",
            role: "scheduling",
            text: "Calendar onboarding — user is in PST.",
          },
          {
            id: "m-est",
            agent: "agent-b",
            role: "chat",
            text: "Daily check-in — user mentioned EST.",
          },
        ],
        claims: [
          {
            id: "tz-a",
            status: "active",
            entity: "user.timezone",
            text: "The user is in PST",
            agent: "agent-a",
            meta: "authority 0.9",
          },
          {
            id: "tz-b",
            status: "disputed",
            entity: "user.timezone",
            text: "The user is in EST",
            agent: "agent-b",
            meta: "authority 0.2",
          },
        ],
      },
    ],
  },
];

const statusClass: Record<ClaimStatus, string> = {
  active: "text-neutral-100",
  superseded: "text-neutral-600 line-through",
  disputed: "text-amber-500/90",
};

const opClass: Record<Frame["op"], string> = {
  ADD: "border-neutral-600 text-neutral-200",
  REPLACE: "border-neutral-400 text-neutral-100",
  DISPUTED: "border-amber-700/80 text-amber-400",
  CLASSIFY: "border-neutral-700 text-neutral-400",
  NOOP: "border-neutral-600 text-neutral-300",
};

const ease = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 3600;
const LAST_STEP_MS = 4800;
const enterTransition = { duration: 0.55, ease };
const stagger = 0.1;

function getStepDuration(step: number, lastIndex: number) {
  return step === lastIndex ? LAST_STEP_MS : STEP_MS;
}

function getBarFill(step: number, progress: number, index: number) {
  if (index < step) return 1;
  if (index === step) return progress;
  return 0;
}

type StepProgressProps = {
  scenarioId: Scenario["id"];
  frames: Frame[];
  step: number;
  paused: boolean;
  reduceMotion: boolean | null;
  onStepChange: (index: number) => void;
  onReplay: () => void;
};

function StepProgress({
  scenarioId,
  frames,
  step,
  paused,
  reduceMotion,
  onStepChange,
  onReplay,
}: StepProgressProps) {
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(paused);
  const lastIndex = frames.length - 1;

  pausedRef.current = paused;

  useLayoutEffect(() => {
    setProgress(reduceMotion ? 1 : 0);
  }, [reduceMotion, scenarioId, step]);

  useEffect(() => {
    if (reduceMotion) return;

    let raf = 0;
    let elapsed = 0;
    let last = performance.now();
    const duration = getStepDuration(step, lastIndex);

    const tick = (now: number) => {
      const delta = now - last;
      last = now;

      if (!pausedRef.current) {
        elapsed += delta;
        const nextProgress = Math.min(1, elapsed / duration);
        setProgress(nextProgress);

        if (nextProgress >= 1) {
          onStepChange((step + 1) % frames.length);
          return;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames.length, lastIndex, onStepChange, reduceMotion, scenarioId, step]);

  return (
    <div className="flex items-center gap-3">
      {frames.map((item, index) => {
        const fill = getBarFill(step, progress, index);
        const isActive = index === step;

        return (
          <button
            key={`${scenarioId}-${index}`}
            type="button"
            onClick={() => onStepChange(index)}
            aria-label={`Step ${index + 1}: ${item.op}`}
            aria-current={isActive ? "step" : undefined}
            className="relative h-1.5 w-10 overflow-hidden bg-neutral-800 hover:bg-neutral-700 sm:w-12"
          >
            <span
              className={cn(
                "absolute inset-0 origin-left bg-neutral-200 will-change-transform",
                !isActive &&
                  "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              )}
              style={{ transform: `scaleX(${fill})` }}
            />
          </button>
        );
      })}
      <button
        type="button"
        onClick={onReplay}
        aria-label="Replay conflict example"
        className="ml-1 text-neutral-500 transition-colors hover:text-neutral-200"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const ConflictExample = () => {
  const reduceMotion = useReducedMotion();
  const [scenarioId, setScenarioId] = useState<Scenario["id"]>("add");
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const lastIndex = scenario.frames.length - 1;
  const frame = scenario.frames[step] ?? scenario.frames[0];

  const selectScenario = (id: Scenario["id"]) => {
    const next = scenarios.find((item) => item.id === id) ?? scenarios[0];
    const nextStep = reduceMotion ? next.frames.length - 1 : 0;
    setScenarioId(id);
    setStep(nextStep);
  };

  const replay = () => {
    setStep(0);
  };

  useEffect(() => {
    if (reduceMotion) {
      setStep(lastIndex);
    }
  }, [lastIndex, reduceMotion, scenarioId]);

  return (
    <div
      id="conflict"
      className="border-y border-dashed dark:border-neutral-700/50"
    >
      <div className="border-b border-dashed px-4 py-16 dark:border-neutral-700/50">
        <Eyebrow>Conflict</Eyebrow>
        <Heading as="h2" size="h2" className="mb-3">
          Two writers.
          <br />
          <span className="text-neutral-400">One decision.</span>
        </Heading>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
          New facts ADD. Same-agent corrections REPLACE. Restatements NOOP.
          Compatible facts from another agent stay. A real clash uses authority
          or recency, and a weaker claim is disputed rather than overwritten.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Conflict scenarios"
        className="grid grid-cols-1 border-b border-dashed sm:grid-cols-3 dark:border-neutral-700/50"
      >
        {scenarios.map((item, index) => {
          const active = item.id === scenarioId;
          const isLast = index === scenarios.length - 1;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectScenario(item.id)}
              className={cn(
                "relative flex min-h-[52px] w-full flex-col justify-center gap-1.5 px-4 py-3.5 text-left sm:min-h-[64px] sm:gap-2 sm:px-5 sm:py-4",
                "border-b border-dashed sm:border-r sm:border-b-0",
                isLast && "border-b-0 sm:border-r-0",
                "dark:border-neutral-700/50",
                active
                  ? "bg-neutral-950/60 text-neutral-100"
                  : "text-neutral-500 hover:bg-neutral-950/30 hover:text-neutral-300",
              )}
            >
              <span className="font-mono text-[10px] leading-none tracking-widest uppercase">
                {item.label}
              </span>
              <span
                className={cn(
                  "w-fit border border-dashed px-1.5 py-0.5 font-mono text-[9px] leading-none tracking-widest uppercase sm:text-[10px]",
                  active
                    ? "border-neutral-600 text-neutral-200"
                    : "border-neutral-800 text-neutral-600",
                )}
              >
                {item.op}
              </span>
              {active && (
                <>
                  <span
                    aria-hidden
                    className="absolute inset-y-3 left-0 w-px bg-neutral-200 sm:hidden"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 hidden h-px bg-neutral-200 sm:block"
                  />
                </>
              )}
            </button>
          );
        })}
      </div>

      <div
        key={scenarioId}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex flex-col border-b border-dashed md:border-r md:border-b-0 dark:border-neutral-700/50">
            <div className="flex items-center justify-between border-b border-dashed px-4 py-3 dark:border-neutral-700/50">
              <p className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
                Conversation
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${scenarioId}-${step}-${frame.op}`}
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: 6, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, y: -6, filter: "blur(3px)" }
                  }
                  transition={enterTransition}
                  className={cn(
                    "border border-dashed px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase",
                    opClass[frame.op],
                  )}
                >
                  {frame.op}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="relative flex min-h-[280px] flex-1 flex-col gap-3 overflow-hidden px-4 py-6">
              <AnimatePresence initial={false}>
                {frame.messages.map((message, index) => (
                  <motion.div
                    key={`${scenarioId}-${message.id}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                    transition={{
                      opacity: {
                        ...enterTransition,
                        delay: reduceMotion ? 0 : index * stagger,
                      },
                      y: {
                        duration: 0.65,
                        ease,
                        delay: reduceMotion ? 0 : index * stagger,
                      },
                    }}
                    className="border border-dashed border-neutral-800 p-4"
                  >
                    <p className="mb-2 font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
                      {message.agent}
                      <span className="text-neutral-700"> · {message.role}</span>
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-200">
                      &ldquo;{message.text}&rdquo;
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="border-b border-dashed px-4 py-3 dark:border-neutral-700/50">
              <p className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">
                Memory
              </p>
            </div>

            <div className="min-h-[280px] flex-1 overflow-x-auto px-4 py-6">
              <table className="w-full min-w-[320px] text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-dashed text-neutral-500 dark:border-neutral-700/50">
                    <th className="pb-2 pr-3 font-normal">status</th>
                    <th className="pb-2 pr-3 font-normal">entity</th>
                    <th className="pb-2 pr-3 font-normal">claim</th>
                    <th className="pb-2 font-normal">agent</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {frame.claims.length === 0 ? (
                      <motion.tr
                        key={`${scenarioId}-empty`}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                      >
                        <td
                          colSpan={4}
                          className="py-6 text-neutral-600"
                        >
                          no claims yet
                        </td>
                      </motion.tr>
                    ) : (
                      frame.claims.map((claim) => (
                        <motion.tr
                          key={`${scenarioId}-${claim.id}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          transition={{
                            opacity: enterTransition,
                            y: { duration: 0.6, ease },
                          }}
                          className="border-b border-dashed last:border-b-0 dark:border-neutral-800"
                        >
                          <td className="py-3 pr-3">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={claim.status}
                                initial={
                                  reduceMotion ? false : { opacity: 0, y: 3 }
                                }
                                animate={{ opacity: 1, y: 0 }}
                                exit={
                                  reduceMotion
                                    ? undefined
                                    : { opacity: 0, y: -3 }
                                }
                                transition={enterTransition}
                                className={cn(
                                  "inline-block",
                                  statusClass[claim.status],
                                )}
                              >
                                {claim.status}
                              </motion.span>
                            </AnimatePresence>
                          </td>
                          <td className="py-3 pr-3 text-neutral-400">
                            {claim.entity}
                          </td>
                          <td className="py-3 pr-3 text-neutral-300">
                            {claim.text}
                          </td>
                          <td className="py-3 text-neutral-500">
                            {claim.agent}
                            <span className="mt-0.5 block text-[10px] tracking-widest uppercase">
                              {claim.meta}
                            </span>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-dashed px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-700/50">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${scenarioId}-${step}-${frame.op}`}
              initial={reduceMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
              transition={enterTransition}
              className="max-w-xl text-sm leading-relaxed text-neutral-500"
            >
              {frame.caption}
            </motion.p>
          </AnimatePresence>

          <StepProgress
            scenarioId={scenarioId}
            frames={scenario.frames}
            step={step}
            paused={paused}
            reduceMotion={reduceMotion}
            onStepChange={setStep}
            onReplay={replay}
          />
        </div>
      </div>
    </div>
  );
};
