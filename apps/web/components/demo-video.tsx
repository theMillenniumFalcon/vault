"use client";

import Image from "next/image";
import { useRef } from "react";

import { SimplexNoise } from "@paper-design/shaders-react";
import { Play } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

const SIMPLEX_NOISE_COLORS = [
  "#0a0a0a",
  "#171717",
  "#1e1b4b",
  "#4c1d95",
  "#7c3aed",
  "#8b5cf6",
] as const;
const VIDEO_SRC = "/videos/demo.mp4";
const THUMBNAIL_SRC = "/pictures/thumbnail.jpg";

export const DemoVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleOpenChange = (open: boolean) => {
    const video = videoRef.current;
    if (!video) return;

    if (open) {
      video.currentTime = 0;
      void video.play();
      return;
    }

    video.pause();
    video.currentTime = 0;
  };

  return (
    <div id="demo" className="border-y border-dashed dark:border-neutral-700/50">
      <div className="border-b border-dashed px-4 py-16 dark:border-neutral-700/50">
        <Eyebrow>Demo</Eyebrow>
        <Heading as="h2" size="h2" className="mb-3">
          See Vault in action.
          <br />
          <span className="text-neutral-400">From install to memory.</span>
        </Heading>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
          Watch how Vault extracts facts, resolves conflicts, and retrieves
          memory across agent conversations.
        </p>
      </div>

      <div className="relative overflow-hidden p-10 md:p-16">
        <div className="pointer-events-none absolute inset-0">
          <SimplexNoise
            style={{ height: "100%", width: "100%" }}
            colors={[...SIMPLEX_NOISE_COLORS]}
            stepsPerColor={2}
            softness={0}
            speed={0.5}
            scale={0.6}
            rotation={0}
          />
        </div>

        <div className="relative z-10">
        <Dialog onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="group relative block aspect-video w-full cursor-pointer overflow-hidden"
              aria-label="Play demo video"
            >
              <Image
                src={THUMBNAIL_SRC}
                alt="Vault demo video thumbnail"
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 1200px) 100vw, 1200px"
                priority
              />
              <span className="absolute inset-0 bg-black/30 transition-colors duration-300 group-hover:bg-black/40" />
              <span
                className={cn(
                  "absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center",
                  "rounded-full bg-black/60 backdrop-blur-sm",
                  "transition-transform duration-300 group-hover:scale-110"
                )}
              >
                <Play className="ml-1 h-6 w-6 fill-white text-white" />
              </span>
            </button>
          </DialogTrigger>

          <DialogContent className="w-[calc(100%-2rem)] max-w-5xl overflow-hidden border-0 p-0 sm:w-[90vw] sm:max-w-6xl">
            <DialogTitle className="sr-only">Vault demo video</DialogTitle>
            <video
              ref={videoRef}
              className="aspect-video w-full bg-black"
              controls
              playsInline
            >
              <source src={VIDEO_SRC} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
};
