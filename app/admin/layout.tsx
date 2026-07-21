"use client";

import "./admin.css";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { adminApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { useT } from "@/lib/i18n/LocaleProvider";

/** Sidebar sayğaclarının yenilənmə tezliyi — sakit fon sorğusu. */
const COUNTS_REFRESH_MS = 60_000;

function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  // Bütün modulların "gözləyən iş" sayı — açar = /admin/<açar>.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [me, setMe] = useState<{ name: string; initials: string; role: string }>({
    name: "Admin",
    initials: "A",
    role: "Admin",
  });

  useEffect(() => {
    const u = getStoredUser();
    if (u) {
      const first = u.firstName ?? "";
      const last = u.lastName ?? "";
      const name = (first + " " + last).trim() || u.email;
      const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase()
        || (u.email?.[0] ?? "A").toUpperCase();
      setMe({ name, initials, role: "Admin" });
    }
  }, []);

  const loadCounts = useCallback(() => {
    adminApi.getSidebarCounts()
      .then(setCounts)
      .catch(() => { /* nişanə kritik deyil — sakitcə keç */ });
  }, []);

  // İlk yükləmə + dövri yeniləmə. Səhifə arxa planda olanda sorğu getmir.
  useEffect(() => {
    loadCounts();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadCounts();
    }, COUNTS_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") loadCounts(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [loadCounts]);

  // Modul səhifəsində işi bitirəndən sonra (route dəyişəndə) sayğac dərhal
  // yenilənsin — əks halda nişanə köhnə qalır və "hələ də iş var" deyir.
  useEffect(() => { loadCounts(); }, [pathname, loadCounts]);

  // Real-time: yeni bildiriş gələn kimi sayğacları yenilə.
  useEffect(() => subscribeNotifications(() => loadCounts()), [loadCounts]);

  /** 0 → nişanə göstərilmir (PanelShell undefined-ı gizlədir). */
  const badge = (key: string) => (counts[key] && counts[key] > 0 ? counts[key] : undefined);

  const nav: PanelNavItem[] = [
    { href: "/admin/users",             label: t("nav.users"),         icon: "users" },
    { href: "/admin/psychologists",     label: t("nav.psychologists"), icon: "user",      badge: badge("psychologists") },
    { href: "/admin/appointments",      label: "Randevular",           icon: "calendar",  badge: badge("appointments") },
    { href: "/admin/payments",          label: "Ödənişlər",            icon: "package",   badge: badge("payments") },
    { href: "/admin/operators",         label: "Operatorlar",          icon: "users" },
    { href: "/admin/approvals",         label: "Təsdiqlər",            icon: "shield",    badge: badge("approvals"), badgeTone: "warn" },
    { href: "/admin/finance",           label: "Maliyyə",              icon: "package",   badge: badge("finance") },
    { href: "/admin/deletion-requests", label: "Silinmə istəkləri",    icon: "clipboard", badge: badge("deletion-requests"), badgeTone: "warn" },
    { href: "/admin/blog",              label: t("nav.blog"),          icon: "content" },
    { href: "/admin/materials",         label: "Materiallar",          icon: "content" },
    { href: "/admin/tests",             label: "Testlər",              icon: "clipboard", badge: badge("tests") },
    { href: "/admin/resources",         label: "Resurslar",            icon: "content",   badge: badge("resources") },
    { href: "/admin/messages",          label: t("nav.messages"),      icon: "message",   badge: badge("messages") },
    { href: "/admin/reviews",           label: t("nav.reviews"),       icon: "megaphone", badge: badge("reviews") },
    { href: "/admin/audit-logs",        label: t("nav.audit"),         icon: "clipboard" },
  ];

  return (
    <PanelShell
      brandLabel="Admin"
      homeHref="/admin"
      navItems={nav}
      user={me}
    >
      {/* Wrap admin pages in .admin-shell so existing admin.css selectors apply. */}
      <div className="admin-shell">{children}</div>
    </PanelShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="ADMIN">
      <AdminShell>{children}</AdminShell>
    </PanelAuthGuard>
  );
}
