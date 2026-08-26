"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { MeshGradient } from "@paper-design/shaders-react"

const APP_BACKGROUND = "#0a0a0a"
const SHADER_COLORS = {
  base: ["#0a0a0a", "#1e1b4b", "#4c1d95", "#7c3aed", "#171717"],
  overlay: ["#0a0a0a", "#8b5cf6", "#4c1d95", "#262626"],
} as const

interface ShaderBackgroundProps {
  children: React.ReactNode
  className?: string
}

export default function ShaderBackground({ children, className }: ShaderBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true)
    const handleMouseLeave = () => setIsActive(false)

    const container = containerRef.current
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }

    return () => {
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-[#0a0a0a] ${className ?? ""}`}
    >
      {/* SVG Filters */}
      <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Background Shaders */}
      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={[...SHADER_COLORS.base]}
        speed={0.3}
        grainMixer={0.25}
        grainOverlay={0.35}
        backgroundColor={APP_BACKGROUND}
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-50"
        colors={[...SHADER_COLORS.overlay]}
        speed={0.2}
        wireframe="true"
        backgroundColor="transparent"
      />

      {children}
    </div>
  )
}
