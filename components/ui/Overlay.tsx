"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export type ModalIconTone = "brand" | "rose" | "amber";

/**
 * Təsdiq / kiçik form modalı.
 * Destruktiv və maliyyə əməliyyatları MÜTLƏQ modaldan keçir.
 */
export function Modal({
  open,
  onClose,
  title,
  text,
  icon,
  iconTone = "brand",
  wide = false,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Bir-iki cümləlik izah — nə baş verəcək. */
  text?: ReactNode;
  icon?: ReactNode;
  iconTone?: ModalIconTone;
  wide?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fx-overlay fx-overlay--center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={["fx-modal", wide ? "fx-modal--wide" : ""].filter(Boolean).join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {icon ? <div className={`fx-modal__icon fx-modal__icon--${iconTone}`}>{icon}</div> : null}
        <h2 className="fx-h3">{title}</h2>
        {text ? <p className="fx-modal__text" style={{ margin: 0 }}>{text}</p> : null}
        {children}
        <div className="fx-modal__actions">
          {actions ?? (
            <Button variant="ghost" onClick={onClose}>
              Bağla
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sağdan açılan detal paneli — sətrə klik edildikdə. */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <>
      <div className="fx-overlay" onClick={onClose} role="presentation" />
      <aside className="fx-drawer" role="dialog" aria-modal="true">
        <div className="fx-drawer__section" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="fx-h3" style={{ flex: 1, minWidth: 0 }}>
            {title}
          </h2>
          <button type="button" className="fx-iconbtn" onClick={onClose} aria-label="Bağla">
            <svg className="fx-icon fx-icon--md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function DrawerSection({ children }: { children: ReactNode }) {
  return <div className="fx-drawer__section">{children}</div>;
}

/** Sadə dropdown paneli. Açıq/bağlı vəziyyəti çağıran tərəfdə saxlanılır. */
export function Menu({ children }: { children: ReactNode }) {
  return (
    <div className="fx-menu" role="menu">
      {children}
    </div>
  );
}

export function MenuItem({
  icon,
  danger = false,
  onClick,
  children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={["fx-menu-item", danger ? "fx-menu-item--danger" : ""].filter(Boolean).join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="fx-menu-divider" />;
}
