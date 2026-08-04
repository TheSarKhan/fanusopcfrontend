"use client";

import ProfileShell from "@/components/ProfileShell";
import { useT } from "@/lib/i18n/LocaleProvider";

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 12.6V6.2M6.3 12.6V3.4M9.7 12.6V7.6M13 12.6V4.8" strokeLinecap="round" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.6" />
      <path d="M2.4 6.6h11.2M5.6 2.4v2M10.4 2.4v2" strokeLinecap="round" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 12l4.5-4.5 2.5 2.5L14 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 4.5H14V8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.1 12.8h3.8M4.4 12.8V7.4a3.6 3.6 0 0 1 7.2 0v5.4M3.2 12.8h9.6" strokeLinecap="round" />
    </svg>
  );
}

export default function OperatorProfilePage() {
  const { t } = useT();
  return (
    <ProfileShell
      title={t("uprof.opTitle")}
      subtitle={t("uprof.opSub")}
      quickLinks={[
        { href: "/operator", label: "Dashboard", icon: <DashboardIcon /> },
        { href: "/operator/appointments", label: "Randevular", icon: <CalendarIcon /> },
        { href: "/operator/analytics", label: "Analitika", icon: <TrendIcon /> },
        { href: "/operator/notifications", label: t("prof.qlNotifications"), icon: <BellIcon /> },
      ]}
    />
  );
}
