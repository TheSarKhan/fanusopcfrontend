"use client";

import type { HomeworkLabelColor } from "@/lib/api";

const PALETTE: Record<HomeworkLabelColor, { bg: string; fg: string; border: string }> = {
  blue:   { bg: "#DBEAFE", fg: "#1E40AF", border: "#BFDBFE" },
  red:    { bg: "#FEE2E2", fg: "#991B1B", border: "#FECACA" },
  green:  { bg: "#D1FAE5", fg: "#065F46", border: "#A7F3D0" },
  yellow: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },
  purple: { bg: "#EDE9FE", fg: "#5B21B6", border: "#DDD6FE" },
  orange: { bg: "#FFEDD5", fg: "#9A3412", border: "#FED7AA" },
  pink:   { bg: "#FCE7F3", fg: "#9D174D", border: "#FBCFE8" },
  teal:   { bg: "#CCFBF1", fg: "#0F766E", border: "#99F6E4" },
  gray:   { bg: "#E5E7EB", fg: "#374151", border: "#D1D5DB" },
};

export const LABEL_COLOR_LIST: HomeworkLabelColor[] =
  ["blue", "red", "green", "yellow", "purple", "orange", "pink", "teal", "gray"];

export function labelColors(color: HomeworkLabelColor) {
  return PALETTE[color] ?? PALETTE.gray;
}

export default function HomeworkLabelChip({
  label, color, onRemove, size = "sm",
}: {
  label: string;
  color: HomeworkLabelColor;
  onRemove?: () => void;
  size?: "xs" | "sm";
}) {
  const c = labelColors(color);
  const tiny = size === "xs";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: tiny ? "1px 6px" : "2px 8px",
      borderRadius: 999,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      fontSize: tiny ? 10 : 11, fontWeight: 600,
      maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {label}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: "transparent", border: "none", color: c.fg, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, opacity: 0.7 }}>
          ×
        </button>
      )}
    </span>
  );
}
