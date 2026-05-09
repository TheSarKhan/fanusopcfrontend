"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";
import PanelIcon, { type IconName } from "./PanelIcon";
import NotificationBell from "./NotificationBell";
import LanguageSwitcher from "./LanguageSwitcher";

export interface PanelNavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

interface UserInfo {
  name: string;
  initials: string;
  role: string;
}

interface PanelShellProps {
  children: React.ReactNode;
  brandLabel: string;
  /** Path that, when matched exactly, should be considered the panel "home". Used for active-state matching. */
  homeHref: string;
  navItems: PanelNavItem[];
  user: UserInfo;
  /** Optional placeholder text in the topbar search box. */
  searchPlaceholder?: string;
  /** Optional primary CTA on the topbar (e.g. "Yeni seans" for psycholog). */
  topbarAction?: React.ReactNode;
  /** Profile page path. Defaults to `${homeHref}/profile`. */
  profileHref?: string;
  /** Where the topbar search submits to. Defaults to `${homeHref}/appointments`. */
  searchHref?: string;
}

export default function PanelShell({
  children,
  brandLabel,
  homeHref,
  navItems,
  user,
  searchPlaceholder = "Axtar...",
  topbarAction,
  profileHref,
  searchHref,
}: PanelShellProps) {
  const resolvedProfileHref = profileHref ?? `${homeHref.replace(/\/$/, "")}/profile`;
  const resolvedSearchHref = searchHref ?? `${homeHref.replace(/\/$/, "")}/appointments`;
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = `${getMainSiteUrl()}/login?_logout=1`;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    router.push(`${resolvedSearchHref}?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="ps-app">
      {mobileOpen && (
        <div className="ps-overlay" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside className={`ps-side ${mobileOpen ? "is-open" : ""}`}>
        <div className="ps-side__brand">
          <Link href={homeHref} className="ps-side__brand-link" aria-label="Fanus">
            <span className="ps-side__logo">F</span>
            <div>
              <div className="ps-side__name">Fanus</div>
              <div className="ps-side__role">{brandLabel}</div>
            </div>
          </Link>
          <button
            className="ps-side__close"
            aria-label="Bağla"
            onClick={() => setMobileOpen(false)}
          >
            <PanelIcon name="x" size={18} stroke={2} />
          </button>
        </div>

        <nav className="ps-side__nav">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== homeHref && pathname.startsWith(item.href + "/")) ||
              (item.href !== homeHref && pathname === item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ps-nav ${active ? "is-active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <PanelIcon name={item.icon} size={18} stroke={1.8} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ps-nav__badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ps-side__user">
          <Link
            href={resolvedProfileHref}
            className="ps-side__user-link"
            onClick={() => setMobileOpen(false)}
            aria-label="Profilə bax"
          >
            <div className="ps-side__avatar">{user.initials}</div>
            <div className="ps-side__user-text">
              <div className="ps-side__uname">{user.name}</div>
              <div className="ps-side__umeta">{user.role}</div>
            </div>
          </Link>
          <button
            className="ps-side__logout"
            aria-label="Çıxış"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Çıxış"
          >
            <PanelIcon name="logout" size={16} stroke={2} />
          </button>
        </div>
      </aside>

      <main className="ps-main">
        <header className="ps-top">
          <button
            className="ps-top__menu"
            aria-label="Menyu"
            onClick={() => setMobileOpen(true)}
          >
            <PanelIcon name="menu" size={20} stroke={2} />
          </button>

          <form className="ps-top__search" onSubmit={handleSearchSubmit} role="search">
            <PanelIcon name="search" size={15} color="var(--oxford-60)" stroke={2} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              aria-label={searchPlaceholder}
            />
          </form>

          <div className="ps-top__right">
            <LanguageSwitcher variant="compact" />
            <NotificationBell />
            {topbarAction}
          </div>
        </header>

        <div className="ps-content">{children}</div>
      </main>
    </div>
  );
}
