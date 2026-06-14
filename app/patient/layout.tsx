"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";
import { patientApi, type PatientRiskLevel } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { FEATURE_GOALS } from "@/lib/features";

function RiskBanner({ level }: { level: PatientRiskLevel | null }) {
  if (!level || (level !== "HIGH" && level !== "CRITICAL")) return null;
  return (
    <div className="patient-risk-strip" data-tone={level}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>
        Sizə dəstək lazımdır? Aşağıdakı vasitələrdən birini seçin —
      </span>
      <Link href="/patient/support" className="patient-risk-strip__cta">Dəstək paneli aç →</Link>
    </div>
  );
}

function PatientShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || t("nav.myAccount");
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "P";

  const [risk, setRisk] = useState<PatientRiskLevel | null>(null);
  useEffect(() => {
    patientApi.crisisStatus().then(s => setRisk(s.riskLevel)).catch(() => {});
  }, []);

  const nav: PanelNavItem[] = [
    { href: "/patient",                label: t("nav.dashboard"),     icon: "home" },
    { href: "/patient/psychologists",  label: t("nav.psychologists"), icon: "users" },
    { href: "/patient/appointments",   label: t("nav.appointments"),  icon: "calendar" },
    { href: "/patient/packages",       label: t("pkg.myPackages"),    icon: "badge" },
    { href: "/patient/homework",       label: t("nav.homework"),      icon: "check" },
    ...(FEATURE_GOALS
      ? [{ href: "/patient/goals", label: "Hədəflərim", icon: "check" } as PanelNavItem]
      : []),
    { href: "/patient/favorites",      label: t("nav.favorites"),     icon: "heart" },
    { href: "/patient/tests",          label: "Testlər",              icon: "clipboard" },
    { href: "/patient/profile",        label: t("nav.profile"),       icon: "user" },
  ];

  return (
    <PanelShell
      brandLabel={t("nav.myAccount")}
      homeHref="/patient"
      navItems={nav}
      user={{ name, initials, role: t("nav.myAccount") }}
      searchPlaceholder={t("common.search")}
    >
      <RiskBanner level={risk} />
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
