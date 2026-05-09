"use client";

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

  const nav: PanelNavItem[] = [
    { href: "/operator",              label: t("nav.dashboard"),       icon: "home" },
    { href: "/operator/appointments", label: t("nav.appointments"),    icon: "calendar" },
    { href: "/operator/feedback",     label: t("nav.feedbackTriage"),  icon: "star" },
    { href: "/operator/analytics",    label: t("nav.analytics"),       icon: "chart" },
  ];

  return (
    <PanelShell
      brandLabel="Operator"
      homeHref="/operator"
      navItems={nav}
      user={{ name, initials, role: "Operator" }}
      searchPlaceholder={t("common.search")}
    >
      {children}
    </PanelShell>
  );
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="OPERATOR">
      <OperatorShell>{children}</OperatorShell>
    </PanelAuthGuard>
  );
}
