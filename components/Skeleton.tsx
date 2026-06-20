import type { CSSProperties } from "react";

/** Shimmer placeholder. Respects prefers-reduced-motion (see globals.css). */
export function Skeleton({
  height = 16, width = "100%", radius = 8, style,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return <div className="ui-skeleton" style={{ height, width, borderRadius: radius, ...style }} />;
}

/** A card-shaped skeleton row — good default for list/agenda loading states. */
export function SkeletonCard() {
  return (
    <div className="ui-skeleton-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <Skeleton width={90} height={20} radius={999} />
        <Skeleton width={70} height={14} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <Skeleton width={44} height={44} radius={999} />
        <div style={{ flex: 1 }}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}

/** N skeleton cards in the same grid the real content will use. */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
