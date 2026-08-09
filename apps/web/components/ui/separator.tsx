import React from "react";

interface SeparatorProps {
  height?: number;
}

export const Separator: React.FC<SeparatorProps> = ({ height = 35 }) => {
  return (
    <div
      style={{
        width: "100%",
        height: `${height * 0.25}rem`,
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.25) 1.5px, transparent 1.5px)",
        backgroundSize: "20px 20px",
      }}
    />
  );
};