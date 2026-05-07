"use client";

import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";

const NAV: PanelNavItem[] = [
  { href: "/operator",              label: "Ümumi baxış", icon: "home" },
  { href: "/operator/appointments", label: "Randevular",  icon: "calendar" },
  { href: "/operator/analytics",    label: "Analytics",   icon: "chart" },
];

function OperatorShell({ children }: { children: React.ReactNode }) {
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || "Operator";
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "O";

  return (
    <PanelShell
      brandLabel="Operator paneli"
      homeHref="/operator"
      navItems={NAV}
      user={{ name, initials, role: "Operator" }}
      searchPlaceholder="Randevu, pasiyent axtar..."
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
