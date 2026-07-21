import type { HTMLAttributes, ReactNode } from "react";

export type BannerTone = "info" | "warn" | "error" | "success";

function BannerIcon({ tone }: { tone: BannerTone }) {
  const d =
    tone === "success"
      ? "M20 6 9 17l-5-5"
      : tone === "info"
        ? "M12 16v-5M12 8v.01"
        : "M12 8v5M12 16.5v.01";
  return (
    <svg
      className="fx-icon fx-icon--md"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tone !== "success" ? <circle cx="12" cy="12" r="9" /> : null}
      <path d={d} />
    </svg>
  );
}

/**
 * Səhifə bildirişi.
 *
 * QEYD: panel əməliyyatlarının / API xətalarının nəticəsi bura YAZILMIR —
 * onlar üçün qlobal toast işlədilir (`toast(mesaj, "error")`).
 * Banner davamlı vəziyyət üçündür: "Profiliniz təsdiq gözləyir" kimi.
 */
export function Banner({
  tone = "info",
  title,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: BannerTone; title?: ReactNode }) {
  return (
    <div className={["fx-banner", `fx-banner--${tone}`, className].filter(Boolean).join(" ")} {...rest}>
      <BannerIcon tone={tone} />
      <div style={{ minWidth: 0 }}>
        {title ? <div className="fx-banner__title">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

/**
 * Boş vəziyyət. Həmişə səbəbi izah edir və növbəti addımı təklif edir —
 * quru "Məlumat yoxdur" yazmayın.
 */
export function EmptyBlock({
  title,
  body,
  actions,
  boxed = false,
}: {
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  /** Dashed sərhədli kart içində göstər. */
  boxed?: boolean;
}) {
  const inner = (
    <div className="fx-empty">
      <div className="fx-empty__title">{title}</div>
      {body ? <p className="fx-empty__body">{body}</p> : null}
      {actions ? <div className="fx-empty__actions">{actions}</div> : null}
    </div>
  );
  if (!boxed) return inner;
  return <div className="fx-card fx-card--empty">{inner}</div>;
}

export function Progress({
  value,
  max = 100,
  tone = "brand",
  size = "md",
  label,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "soft" | "sage";
  size?: "md" | "lg";
  label?: ReactNode;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fillTone = tone === "soft" ? "fx-progress__fill--soft" : tone === "sage" ? "fx-progress__fill--sage" : "";
  return (
    <div>
      {label ? (
        <div className="fx-row__meta" style={{ marginBottom: 6, marginTop: 0 }}>
          {label}
        </div>
      ) : null}
      <div
        className={["fx-progress", size === "lg" ? "fx-progress--lg" : ""].filter(Boolean).join(" ")}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={["fx-progress__fill", fillTone].filter(Boolean).join(" ")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Wizard addımları. */
export function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  /** 0-dan başlayan indeks. */
  current: number;
}) {
  return (
    <div className="fx-stepper">
      {steps.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center" }}>
          <div
            className={[
              "fx-step",
              i < current ? "fx-step--done" : "",
              i === current ? "fx-step--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="fx-step__dot">
              {i < current ? (
                <svg className="fx-icon fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="fx-step__label">{label}</span>
          </div>
          {i < steps.length - 1 ? (
            <span className={["fx-step-line", i < current ? "fx-step-line--done" : ""].filter(Boolean).join(" ")} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
