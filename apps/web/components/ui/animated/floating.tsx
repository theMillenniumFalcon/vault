"use client";

import * as React from "react";

import { motion } from "motion/react";

interface FloatingProps {
  children: React.ReactNode;
  amplitude?: number; // how far it moves
  duration?: number;
  className?: string;
}

export function Floating({
  children,
  amplitude = 8,
  duration = 2.2,
  className,
}: FloatingProps) {
  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude, amplitude] }}
      transition={{
        duration,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror",
      }}
    >
      {children}
    </motion.div>
  );
}
