import type { HTMLAttributes, ReactNode } from "react";

/** Statistika sırası — avtomatik uyğunlaşan şəbəkə, sağda boş dəhliz qalmır. */
export function Stats({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["fx-stats", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

/**
 * Tək statistika: dəyər + etiket + izah.
 * Rəqəm rozet/badge içində göstərilmir — sadə dəyərdir.
 */
export function Stat({
  value,
  unit,
  label,
  meta,
  size = "md",
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  value: ReactNode;
  /** "AZN", "seans" kimi vahid — dəyərdən kiçik göstərilir. */
  unit?: ReactNode;
  label: ReactNode;
  /** Bir cümləlik kontekst: "Dünənlə müqayisədə 12% çox". */
  meta?: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <div className={["fx-stat", className].filter(Boolean).join(" ")} {...rest}>
      <div className={["fx-stat__value", size === "sm" ? "fx-stat__value--sm" : ""].filter(Boolean).join(" ")}>
        {value}
        {unit ? <span className="fx-stat__unit"> {unit}</span> : null}
      </div>
      <div className="fx-stat__label">{label}</div>
      {meta ? <div className="fx-stat__meta">{meta}</div> : null}
    </div>
  );
}

/** Artım / azalma göstəricisi — məna daşıdığı üçün rənglidir. */
export function Trend({
  direction,
  children,
}: {
  direction: "up" | "down" | "warn";
  children: ReactNode;
}) {
  const path =
    direction === "down"
      ? "M4 7 10 13l4-4 6 6 M14 17h6v-6"
      : "M4 17 10 11l4 4 6-6 M14 7h6v6";
  return (
    <span className={`fx-trend fx-trend--${direction}`}>
      <svg
        className="fx-icon fx-icon--sm"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
      {children}
    </span>
  );
}
