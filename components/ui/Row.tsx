import type { HTMLAttributes, ReactNode } from "react";

/**
 * Siyahı sətri.
 *
 * Struktur: [avatar/ikon] → ad + meta → status → məbləğ → əməliyyatlar.
 * Meta sətri TAM CÜMLƏdir, `·` ayırıcısı və rozet çipləri işlədilmir:
 *   doğru → "Kart ilə ödənilib, 18.07.2026 — Dr. Rəşad Əliyev"
 *   səhv  → "Kart · 18.07.2026 · Dr. Rəşad Əliyev"
 */
export function Row({
  lead,
  title,
  meta,
  status,
  amount,
  actions,
  onClick,
  className,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** Avatar və ya ikon. */
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  amount?: ReactNode;
  actions?: ReactNode;
}) {
  const clickable = typeof onClick === "function";
  return (
    <div
      // --flush: <Row> həmişə <CardBody> içində durur, onun öz doldurması var.
      className={["fx-row", "fx-row--flush", clickable ? "fx-row--link" : "", className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).click();
              }
            }
          : undefined
      }
      {...rest}
    >
      {lead}
      <div className="fx-row__main">
        <div className="fx-row__title">{title}</div>
        {meta ? <div className="fx-row__meta">{meta}</div> : null}
      </div>
      {status}
      {amount ? <span className="fx-row__amount">{amount}</span> : null}
      {actions ? <div className="fx-row__actions">{actions}</div> : null}
    </div>
  );
}

/** Baş hərflərdən avatar. Rəng tək brend tonudur — təsadüfi rəngləmə yoxdur. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "fx-avatar--sm" : size === "lg" ? "fx-avatar--md" : size === "xl" ? "fx-avatar--lg" : "";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span
      className={["fx-avatar", sizeClass, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      title={name}
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}
