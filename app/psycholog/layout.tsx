"use client";

import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";

const NAV: PanelNavItem[] = [
  { href: "/psycholog",              label: "Ümumi baxış", icon: "home" },
  { href: "/psycholog/calendar",     label: "Təqvim",      icon: "calendar" },
  { href: "/psycholog/appointments", label: "Randevular",  icon: "video" },
  { href: "/psycholog/clients",      label: "Müştərilər",  icon: "users" },
  { href: "/psycholog/homework",     label: "Tapşırıqlar", icon: "check" },
  { href: "/psycholog/availability", label: "Açıq vaxtlar", icon: "clock" },
  { href: "/psycholog/reviews",      label: "Rəylər",      icon: "star" },
];

function PsychologShell({ children }: { children: React.ReactNode }) {
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || "Psixoloq";
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "P";

  return (
    <PanelShell
      brandLabel="Psixoloq paneli"
      homeHref="/psycholog"
      navItems={NAV}
      user={{ name, initials, role: "Klinik psixoloq" }}
      searchPlaceholder="Pasiyent, seans və ya qeyd axtar..."
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
