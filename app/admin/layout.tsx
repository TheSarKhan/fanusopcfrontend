"use client";

import "./admin.css";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { useT } from "@/lib/i18n/LocaleProvider";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [reviewBadge, setReviewBadge] = useState<number | undefined>(undefined);
  const [messageBadge, setMessageBadge] = useState<number | undefined>(undefined);
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
    adminApi.getPendingReviewCount()
      .then((res) => setReviewBadge(res.count))
      .catch(() => {});
    adminApi.getNewContactMessageCount()
      .then((res) => setMessageBadge(res.count > 0 ? res.count : undefined))
      .catch(() => {});
  }, []);

  const nav: PanelNavItem[] = [
    { href: "/admin/users",             label: t("nav.users"),         icon: "users" },
    { href: "/admin/psychologists",     label: t("nav.psychologists"), icon: "user" },
    { href: "/admin/appointments",      label: "Randevular",           icon: "calendar" },
    { href: "/admin/operators",         label: "Operatorlar",          icon: "users" },
    { href: "/admin/deletion-requests", label: "Silinmə istəkləri",    icon: "clipboard" },
    { href: "/admin/blog",              label: t("nav.blog"),          icon: "content" },
    { href: "/admin/materials",         label: "Materiallar",          icon: "content" },
    { href: "/admin/tests",             label: "Testlər",              icon: "clipboard" },
    { href: "/admin/resources",         label: "Resurslar",            icon: "content" },
    { href: "/admin/messages",          label: t("nav.messages"),      icon: "message", badge: messageBadge },
    { href: "/admin/reviews",           label: t("nav.reviews"),       icon: "megaphone", badge: reviewBadge },
    { href: "/admin/audit-logs",        label: t("nav.audit"),         icon: "clipboard" },
  ];

  return (
    <PanelShell
      brandLabel="Admin"
      homeHref="/admin"
      navItems={nav}
      user={me}
      searchPlaceholder={t("common.search")}
      searchHref="/admin/users"
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
