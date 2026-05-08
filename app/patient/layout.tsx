"use client";

import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";

const NAV: PanelNavItem[] = [
  { href: "/patient",              label: "Ümumi baxış",  icon: "home" },
  { href: "/patient/appointments", label: "Randevularım", icon: "calendar" },
  { href: "/patient/homework",     label: "Tapşırıqlar",  icon: "check" },
  { href: "/patient/favorites",    label: "Favoritlərim", icon: "heart" },
  { href: "/patient/profile",      label: "Profilim",     icon: "user" },
];

function PatientShell({ children }: { children: React.ReactNode }) {
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || "Pasiyent";
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "P";

  return (
    <PanelShell
      brandLabel="Pasiyent paneli"
      homeHref="/patient"
      navItems={NAV}
      user={{ name, initials, role: "Pasiyent" }}
      searchPlaceholder="Psixoloq, seans, qeyd axtar..."
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
