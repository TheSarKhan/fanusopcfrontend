import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "ghost"
  | "quiet"
  | "danger"
  | "dangerGhost"
  | "warnGhost";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "fx-btn--primary",
  ghost: "fx-btn--ghost",
  quiet: "fx-btn--quiet",
  danger: "fx-btn--danger",
  dangerGhost: "fx-btn--danger-ghost",
  warnGhost: "fx-btn--warn-ghost",
};

/**
 * Düymə sinifini qaytarır — Next `<Link>` düymə kimi görünməli olanda.
 * Belə: `<Link href="/x" className={buttonClass("primary")}>Cədvəlim</Link>`
 * Səhifədə `.fx-*` sinifi əl ilə yazmamaq üçün budur.
 */
export function buttonClass(
  variant: ButtonVariant = "ghost",
  opts: { size?: "sm" | "md"; block?: boolean; className?: string } = {},
) {
  return btnClass(variant, opts.size ?? "md", opts.block ?? false, opts.className);
}

function btnClass(
  variant: ButtonVariant,
  size: "sm" | "md",
  block: boolean,
  extra?: string,
) {
  return [
    "fx-btn",
    VARIANT_CLASS[variant],
    size === "sm" ? "fx-btn--sm" : "",
    block ? "fx-btn--block" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Eyni məntiq mətn bağlantısı üçün: `<Link className={linkClass()}>Hamısı</Link>` */
export function linkClass(className?: string) {
  return ["fx-link", className].filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  block?: boolean;
  /** Soldakı SVG ikon. Emoji QADAĞANDIR. */
  icon?: ReactNode;
};

export function Button({
  variant = "ghost",
  size = "md",
  block = false,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={btnClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  block?: boolean;
  icon?: ReactNode;
};

/** Düymə görünüşlü keçid. Naviqasiya üçün — əməliyyat üçün Button işlədin. */
export function ButtonLink({
  variant = "ghost",
  size = "md",
  block = false,
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={btnClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}

/** Mətn bağlantısı — "Hamısına bax" tipli ikinci dərəcəli əməliyyat. */
export function TextButton({
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={["fx-link", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </button>
  );
}

/** Yalnız ikonlu düymə (topbar, sətir sonu). aria-label MÜTLƏQdir. */
export function IconButton({
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button type={type} className={["fx-iconbtn", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </button>
  );
}
