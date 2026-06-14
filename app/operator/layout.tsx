"use client";

import { useEffect, useState } from "react";
import OperatorCommandPalette from "@/components/OperatorCommandPalette";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";

function OperatorShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || "Operator";
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "O";

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Open palette on Cmd+K / Ctrl+K from anywhere in the operator panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav: PanelNavItem[] = [
    { href: "/operator",              label: t("nav.dashboard"),       icon: "home" },
    { href: "/operator/appointments", label: t("nav.appointments"),    icon: "calendar" },
    { href: "/operator/payments",     label: t("pkg.paymentsTitle"),   icon: "clipboard" },
    { href: "/operator/feedback",     label: t("nav.feedbackTriage"),  icon: "star" },
    { href: "/operator/analytics",    label: t("nav.analytics"),       icon: "chart" },
    { href: "/operator/customers",     label: "Müştərilər",            icon: "users" },
    { href: "/operator/psychologists", label: "Psixoloq statistikası", icon: "badge" },
  ];

  return (
    <>
      <PanelShell
        brandLabel="Operator"
        homeHref="/operator"
        navItems={nav}
        user={{ name, initials, role: "Operator" }}
        searchPlaceholder={t("common.search")}
        topbarExtras={
          <button type="button" onClick={() => setPaletteOpen(true)} className="opcp-trigger" title="Sürətli axtarış (⌘K)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Axtar
            <kbd>⌘K</kbd>
          </button>
        }
      >
        {children}
      </PanelShell>
      <OperatorCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="OPERATOR">
      <OperatorShell>{children}</OperatorShell>
    </PanelAuthGuard>
  );
}
