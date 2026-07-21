import type { HTMLAttributes, ReactNode } from "react";

/**
 * Panel səhifəsinin başlıq bloku.
 * Başlıq CÜMLƏ formasındadır — uppercase "eyebrow" etiket işlədilmir.
 */
export function PageHead({
  title,
  sub,
  actions,
  breadcrumb,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  /** Bir cümləlik izah — nə göstərilir, neçə ədəd. */
  sub?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <>
      {breadcrumb ? <div style={{ marginBottom: 10 }}>{breadcrumb}</div> : null}
      <div className={["fx-head", className].filter(Boolean).join(" ")} {...rest}>
        <div className="fx-head__main">
          <h1 className="fx-h1">{title}</h1>
          {sub ? <p className="fx-head__sub">{sub}</p> : null}
        </div>
        {actions ? <div className="fx-head__actions">{actions}</div> : null}
      </div>
    </>
  );
}

/** Səhifə daxilində bölmə başlığı. */
export function SectionTitle({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={["fx-section-label", className].filter(Boolean).join(" ")}
      style={{ marginBottom: 12 }}
      {...rest}
    >
      {children}
    </h2>
  );
}
