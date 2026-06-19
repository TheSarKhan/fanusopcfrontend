"use client";

import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";

function PsychologShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || t("nav.psychologists");
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "P";

  const nav: PanelNavItem[] = [
    { href: "/psycholog",              label: t("nav.dashboard"),    icon: "home" },
    { href: "/psycholog/calendar",     label: t("nav.calendar"),     icon: "calendar" },
    { href: "/psycholog/appointments", label: t("nav.appointments"), icon: "video" },
    { href: "/psycholog/clients",      label: t("nav.clients"),      icon: "users" },
    { href: "/psycholog/referrals",    label: "Yönləndirmələr",      icon: "badge" },
    { href: "/psycholog/homework",     label: t("nav.homework"),     icon: "check" },
    { href: "/psycholog/articles",     label: t("nav.articles"),     icon: "book" },
    { href: "/psycholog/community",    label: "İcma",                icon: "users" },
    { href: "/psycholog/resources",    label: "Bilik bazası",        icon: "content" },
    { href: "/psycholog/availability", label: t("nav.workHours"),    icon: "clock" },
    { href: "/psycholog/reviews",      label: t("nav.reviews"),      icon: "star" },
    { href: "/psycholog/materials",    label: "Materiallar",         icon: "content" },
    { href: "/psycholog/tests",        label: "Testlər",             icon: "clipboard" },
  ];

  return (
    <PanelShell
      brandLabel={t("nav.psychologists")}
      homeHref="/psycholog"
      navItems={nav}
      user={{ name, initials, role: t("nav.psychologists") }}
      searchPlaceholder={t("common.search")}
    >
      {children}
    </PanelShell>
  );
}

export default function PsychologLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="PSYCHOLOGIST">
      <PsychologShell>{children}</PsychologShell>
    </PanelAuthGuard>
  );
}
