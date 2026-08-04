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

  // Naviqasiya məntiqi domenlərə görə qruplaşdırılıb (PanelShell düz siyahı göstərir,
  // ona görə qruplar bitişik sıralanır). Hər modulun öz fərqli, mənalı ikonu var:
  //  İnsanlar → Əməliyyatlar → Maliyyə → Məzmun → Ünsiyyət → Sistem.
  const nav: PanelNavItem[] = [
    // Ümumi mənzərə — həmişə birinci
    { href: "/admin",                   label: "İdarə paneli",         icon: "home" },
    // İnsanlar
    { href: "/admin/users",             label: t("nav.users"),         icon: "users" },
    { href: "/admin/psychologists",     label: t("nav.psychologists"), icon: "user",      badge: badge("psychologists") },
    { href: "/admin/operators",         label: "Operatorlar",          icon: "headset" },
    // Əməliyyatlar
    { href: "/admin/appointments",      label: "Randevular",           icon: "calendar",  badge: badge("appointments") },
    { href: "/admin/approvals",         label: "Təsdiqlər",            icon: "shield",    badge: badge("approvals"), badgeTone: "warn" },
    // "Silinmə istəkləri" ayrıca sətir DEYİL: qərar gözləyən hər şey Təsdiqlər
    // inbox-undadır (kind=ACCOUNT_DELETE), sayğac da ora əlavə olunub.
    // Maliyyə
    { href: "/admin/payments",          label: "Ödənişlər",            icon: "package",   badge: badge("payments") },
    { href: "/admin/finance",           label: "Maliyyə",              icon: "chart",     badge: badge("finance") },
    // Məzmun
    { href: "/admin/blog",              label: t("nav.blog"),          icon: "edit" },
    { href: "/admin/resources",         label: "Resurslar",            icon: "journal",   badge: badge("resources") },
    { href: "/admin/tests",             label: "Psixoloji Testlər",              icon: "clipboard", badge: badge("tests") },
    // Ünsiyyət
    { href: "/admin/messages",          label: t("nav.messages"),      icon: "message",   badge: badge("messages") },
    { href: "/admin/reviews",           label: t("nav.reviews"),       icon: "star",      badge: badge("reviews") },
    // Sistem
    { href: "/admin/audit-logs",        label: t("nav.audit"),         icon: "clock" },
  ];

  return (
    <PanelShell
      brandLabel={t("roleLabel.ADMIN")}
      homeHref="/admin"
      navItems={nav}
      user={{ name: me.name, initials: me.initials, role: t("roleLabel.ADMIN") }}
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
