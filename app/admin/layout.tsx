"use client";

import "./admin.css";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, logout } from "@/lib/api";
import { getMainSiteUrl, getStoredUser } from "@/lib/auth";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import {
  IconHome,
  IconContent,
  IconUser,
  IconCalendar,
  IconMegaphone,
  IconChart,
  IconSettings,
  IconSearch,
  IconBell,
  IconClock,
  IconChevron,
  IconLogout,
} from "./_components/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeKey?: "content" | "appointments";
};

const NAV_MAIN: NavItem[] = [
  { href: "/admin", label: "Dashboard", Icon: IconHome },
  { href: "/admin/content", label: "Kontent", Icon: IconContent, badgeKey: "content" },
  { href: "/admin/psychologists", label: "Psixoloqlar", Icon: IconUser },
  { href: "/admin/appointments", label: "Randevular", Icon: IconCalendar, badgeKey: "appointments" },
  { href: "/admin/announcements", label: "Elanlar", Icon: IconMegaphone },
];

const NAV_ANALYTICS: NavItem[] = [
  { href: "/admin/reports", label: "Statistikalar", Icon: IconChart },
];

const NAV_SYSTEM: NavItem[] = [
  { href: "/admin/settings", label: "Sistem parametrləri", Icon: IconSettings },
];

const TITLE_MAP: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/content": "Kontent idarəsi",
  "/admin/psychologists": "Psixoloqlar",
  "/admin/appointments": "Randevular",
  "/admin/announcements": "Elanlar",
  "/admin/reports": "Statistikalar",
  "/admin/settings": "Sistem parametrləri",
  "/admin/blog": "Bloq",
  "/admin/stats": "Statistika",
  "/admin/faqs": "FAQ",
  "/admin/testimonials": "Rəylər",
  "/admin/config": "Konfiqurasiya",
};

function NavSection({ items, badges, pathname }: { items: NavItem[]; badges: Record<string, number | undefined>; pathname: string }) {
  return (
    <>
      {items.map(({ href, label, Icon, badgeKey }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const badgeVal = badgeKey ? badges[badgeKey] : undefined;
        return (
          <a key={href} href={href} className={`nav-item${active ? " active" : ""}`}>
            <Icon size={16} className="ic" />
            <span>{label}</span>
            {badgeVal !== undefined && badgeVal > 0 && <span className="badge">{badgeVal}</span>}
          </a>
        );
      })}
    </>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number | undefined>>({});
  const [me, setMe] = useState<{ name: string; initials: string; role: string }>({
    name: "Admin",
    initials: "AD",
    role: "Super admin",
  });

  useEffect(() => {
    const u = getStoredUser();
    if (u) {
      const first = u.firstName ?? "";
      const last = u.lastName ?? "";
      const name = (first + " " + last).trim() || u.email;
      const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || (u.email?.[0] ?? "A").toUpperCase();
      setMe({ name, initials, role: "Super admin" });
    }
    adminApi
      .getDashboard()
      .then((d) => {
        const counts = d as Record<string, number>;
        setBadges({
          content: counts.blogPosts ?? counts.content,
          appointments: counts.pendingAppointments ?? counts.appointments,
        });
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = `${getMainSiteUrl()}?_logout=1`;
  };

  const crumb = TITLE_MAP[pathname] ?? Object.entries(TITLE_MAP).find(([k]) => pathname.startsWith(k + "/"))?.[1] ?? "";

  return (
    <div className="admin-shell">
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-name">Fanus</div>
              <div className="brand-sub">Admin</div>
            </div>
          </div>

          <div className="nav-label">Əsas</div>
          <NavSection items={NAV_MAIN} badges={badges} pathname={pathname} />

          <div className="nav-label">Analitika</div>
          <NavSection items={NAV_ANALYTICS} badges={badges} pathname={pathname} />

          <div className="nav-label">Sistem</div>
          <NavSection items={NAV_SYSTEM} badges={badges} pathname={pathname} />

          <div className="sidebar-footer">
            <div className="avatar">{me.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="me-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {me.name}
              </div>
              <div className="me-role">{me.role}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Çıxış">
              <IconLogout size={14} />
            </button>
            <IconChevron size={14} style={{ color: "var(--ox-300)" }} />
          </div>
        </aside>

        <main>
          <div className="topbar">
            <div className="crumbs">
              <span>Admin</span>
              <span className="crumb-sep">/</span>
              <strong>{crumb}</strong>
            </div>
            <div className="topbar-right">
              <div className="search-box">
                <IconSearch size={14} style={{ color: "var(--muted)" }} />
                <input placeholder="İstifadəçi, məqalə, randevu axtar..." />
                <span className="kbd">⌘K</span>
              </div>
              <button className="icon-btn" title="Bildirişlər">
                <IconBell size={15} />
                <span className="dot-notif" />
              </button>
              <button className="icon-btn" title="Saat">
                <IconClock size={15} />
              </button>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="ADMIN">
      <AdminShell>{children}</AdminShell>
    </PanelAuthGuard>
  );
}
