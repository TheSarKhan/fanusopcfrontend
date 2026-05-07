"use client";

import type { CSSProperties } from "react";

const ASSETS = {
  "wave-top":    "/deco/deco-wave-top.png",
  "wave-top-2":  "/deco/deco-wave-top-2.png",
  "blob-1":      "/deco/deco-blob-1.png",
  "blob-2":      "/deco/deco-blob-2.png",
  "blob-3":      "/deco/deco-blob-3.png",
  "blob-cloud":  "/deco/deco-blob-cloud.png",
  "mesh-blob":   "/deco/deco-mesh-blob.png",
  "sphere":      "/deco/deco-sphere.png",
  "sphere-blue": "/deco/deco-sphere-blue.png",
  "cards":       "/deco/deco-cards.png",
  "circles-mix": "/deco/deco-circles-mix.png",
  "target":      "/deco/deco-target.png",
  "dot-small":   "/deco/deco-dot-small.png",
  "wave-line":   "/deco/deco-wave-line.png",
  "wavy-lines":  "/deco/deco-wavy-lines.png",
} as const;

export type DecoType = keyof typeof ASSETS;
type Anim = "float" | "drift" | "floatY" | "none";

export default function Deco({
  type,
  style,
  className = "",
  anim = "float",
}: {
  type: DecoType;
  style?: CSSProperties;
  className?: string;
  anim?: Anim;
}) {
  const animClass =
    anim === "drift"  ? "fanus-deco--drift" :
    anim === "floatY" ? "fanus-deco--floatY" :
    anim === "none"   ? "" : "fanus-deco--float";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ASSETS[type]}
      alt=""
      aria-hidden
      draggable={false}
      className={`fanus-deco fanus-deco--mobile-hide ${animClass} ${className}`}
      style={{ position: "absolute", pointerEvents: "none", userSelect: "none", zIndex: 0, ...style }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}
