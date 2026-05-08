"use client";

import "./admin.css";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";

const NAV: PanelNavItem[] = [
  { href: "/admin/users",          label: "İstifadəçilər", icon: "users" },
  { href: "/admin/psychologists",  label: "Psixoloqlar",   icon: "user" },
  { href: "/admin/blog",           label: "Məqalələr",     icon: "content" },
  { href: "/admin/reviews",        label: "Rəylər",        icon: "megaphone" },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const [reviewBadge, setReviewBadge] = useState<number | undefined>(undefined);
  const [me, setMe] = useState<{ name: string; initials: string; role: string }>({
    name: "Admin",
    initials: "A",
    role: "Super admin",
  });

  useEffect(() => {
    const u = getStoredUser();
    if (u) {
      const first = u.firstName ?? "";
      const last = u.lastName ?? "";
      const name = (first + " " + last).trim() || u.email;
      const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase()
        || (u.email?.[0] ?? "A").toUpperCase();
      setMe({ name, initials, role: "Super admin" });
    }
    adminApi.getPendingReviewCount()
      .then((res) => setReviewBadge(res.count))
      .catch(() => {});
  }, []);

  const navWithBadges = NAV.map(item =>
    item.href === "/admin/reviews" ? { ...item, badge: reviewBadge } : item
  );

  return (
    <PanelShell
      brandLabel="Admin paneli"
      homeHref="/admin"
      navItems={navWithBadges}
      user={me}
      searchPlaceholder="İstifadəçi axtar..."
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
