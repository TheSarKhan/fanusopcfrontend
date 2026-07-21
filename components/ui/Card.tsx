import type { HTMLAttributes, ReactNode } from "react";

type Div = HTMLAttributes<HTMLDivElement>;

export type CardTone = "default" | "attention" | "error" | "empty";

const TONE_CLASS: Record<CardTone, string> = {
  default: "",
  attention: "fx-card--attention",
  error: "fx-card--error",
  empty: "fx-card--empty",
};

export function Card({
  tone = "default",
  fill = false,
  className,
  children,
  ...rest
}: Div & {
  tone?: CardTone;
  /** Şəbəkə xanasını tam doldur — sətirdəki kartlar eyni hündürlükdə olsun. */
  fill?: boolean;
}) {
  return (
    <div
      className={["fx-card", fill ? "fx-card--fill" : "", TONE_CLASS[tone], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Kart başlığı. `action` sağda göstərilir (adətən TextButton).
 * Standart olaraq altında hairline bölücü var; `plain` onu götürür —
 * qısa məzmunlu kartlarda daha sakit görünür.
 */
export function CardHead({
  title,
  sub,
  action,
  plain = false,
  className,
  ...rest
}: Div & { title: ReactNode; sub?: ReactNode; action?: ReactNode; plain?: boolean }) {
  return (
    <div
      className={["fx-card__head", plain ? "fx-card__head--plain" : "", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <div style={{ minWidth: 0 }}>
        <h2 className="fx-card-title">{title}</h2>
        {sub ? <p className="fx-subtitle" style={{ margin: "4px 0 0" }}>{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: Div) {
  return (
    <div className={["fx-card__body", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function CardFoot({ className, children, ...rest }: Div) {
  return (
    <div className={["fx-card__foot", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

/** Sərhədsiz doldurma — başlıqsız sadə kart məzmunu üçün. */
export function CardPad({ className, children, ...rest }: Div) {
  return (
    <div className={["fx-card__pad", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}
