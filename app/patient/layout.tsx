"use client";

import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";

function PatientShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || t("nav.myAccount");
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "P";

  const nav: PanelNavItem[] = [
    { href: "/patient",              label: t("nav.dashboard"),     icon: "home" },
    { href: "/patient/appointments", label: t("nav.appointments"),  icon: "calendar" },
    { href: "/patient/homework",     label: t("nav.homework"),      icon: "check" },
    { href: "/patient/favorites",    label: t("nav.favorites"),     icon: "heart" },
    { href: "/patient/profile",      label: t("nav.profile"),       icon: "user" },
  ];

  return (
    <PanelShell
      brandLabel={t("nav.myAccount")}
      homeHref="/patient"
      navItems={nav}
      user={{ name, initials, role: t("nav.myAccount") }}
      searchPlaceholder={t("common.search")}
    >
      {children}
    </PanelShell>
  );
}

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="PATIENT">
      <PatientShell>{children}</PatientShell>
    </PanelAuthGuard>
  );
}
