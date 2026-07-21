"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, meApi } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";
import PanelIcon, { type IconName } from "./PanelIcon";
import NotificationBell from "./NotificationBell";
import LanguageSwitcher from "./LanguageSwitcher";

export interface PanelNavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Nişanəni təcili tonda (kəhrəba) göstərir — təsdiq/silinmə kimi modullar. */
  badgeTone?: "default" | "warn";
  /** Extra route prefixes that also mark this item active (e.g. sibling
   *  routes grouped under one nav entry). Matched by exact path or prefix. */
  match?: string[];
}

interface UserInfo {
  name: string;
  initials: string;
  role: string;
  /** Optional avatar URL. When omitted, PanelShell fetches it from /me. */
  photoUrl?: string | null;
}

interface PanelShellProps {
  children: React.ReactNode;
  brandLabel: string;
  /** Path that, when matched exactly, should be considered the panel "home". Used for active-state matching. */
  homeHref: string;
  navItems: PanelNavItem[];
  user: UserInfo;
  /** Optional primary CTA on the topbar (e.g. "Yeni seans" for psycholog). */
  topbarAction?: React.ReactNode;
  /** Optional auxiliary controls rendered next to the language switcher (e.g. a search trigger). */
  topbarExtras?: React.ReactNode;
  /** Profile page path. Defaults to `${homeHref}/profile`. */
  profileHref?: string;
}

export default function PanelShell({
  children,
  brandLabel,
  homeHref,
  navItems,
  user,
  topbarAction,
  topbarExtras,
  profileHref,
}: PanelShellProps) {
  const resolvedProfileHref = profileHref ?? `${homeHref.replace(/\/$/, "")}/profile`;
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Below this width the sidebar goes off-canvas, so the language/notification
  // controls move from the sidebar brand into the topbar. Kept as a single
  // rendered instance (NotificationBell holds a WebSocket) — never both.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Restore the collapsed preference after mount (avoids SSR/client mismatch).
  useEffect(() => {
    if (localStorage.getItem("ps_sidebar_collapsed") === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("ps_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  // The stored auth record carries no avatar, so pull the current photo from /me
  // once on mount. Keeps the sidebar avatar in sync for every panel role.
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photoUrl ?? null);
  useEffect(() => {
    meApi.get()
      .then(m => setPhotoUrl(m.photoUrl ?? null))
      .catch(() => { /* non-fatal — fall back to initials */ });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      setPhotoUrl((e as CustomEvent<{ photoUrl: string | null }>).detail.photoUrl);
    };
    window.addEventListener("profilePhotoChanged", handler);
    return () => window.removeEventListener("profilePhotoChanged", handler);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = `${getMainSiteUrl()}/login?_logout=1`;
  };

  // Single instance — placed next to the logo on desktop, in the topbar on
  // mobile. The bell dropdown must open rightward (into content) from the narrow
  // sidebar, but leftward from the right-aligned topbar.
  const controls = (
    <>
      {topbarExtras}
      <LanguageSwitcher variant="compact" align={isMobile ? "right" : "left"} />
      <NotificationBell align={isMobile ? "right" : "left"} />
    </>
  );

  return (
    <div className="ps-app">
      {mobileOpen && (
        <div className="ps-overlay" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside className={`ps-side ${mobileOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="ps-side__toggle"
          aria-label={collapsed ? "Sidebar-ı aç" : "Sidebar-ı bağla"}
          onClick={toggleCollapsed}
        >
          <PanelIcon name="chevron" size={13} stroke={2.4} style={{ transform: collapsed ? undefined : "rotate(180deg)" }} />
        </button>

        <div className="ps-side__brand">
          <Link href={homeHref} className="ps-side__brand-link" aria-label={`Fanus — ${brandLabel}`}>
            <span className="ps-side__logo">
              {/* İkon + brand-rəngli yazı (şəkil deyil ki, rəng/ölçü CSS ilə dəqiq idarə
                  olunsun və şəkil-keş problemi olmasın). Collapsed rail-də yalnız ikon. */}
              <Image className="ps-side__logo-mark" src="/images/logos/logo-mark.png" alt="Fanus" width={1035} height={1856} priority />
              <span className="ps-side__logo-text">
                <span className="ps-side__logo-name">FANUS</span>
                <span className="ps-side__logo-sub">
                  <span>Online</span>
                  <span>Psychology</span>
                  <span>Center</span>
                </span>
              </span>
            </span>
          </Link>
          {/* Desktop: language + notifications sit right beside the logo. On mobile
              they live in the topbar instead (sidebar is off-canvas). */}
          {!isMobile && <div className="ps-side__controls">{controls}</div>}
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
              (item.href !== homeHref && pathname === item.href) ||
              (item.match?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false);
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
                  <span
                    className={`ps-nav__badge${item.badgeTone === "warn" ? " ps-nav__badge--warn" : ""}`}
                    title={`${item.badge} gözləyən`}
                    aria-label={`${item.badge} gözləyən`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
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
            <div className="ps-side__avatar">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={user.name}
                  width={36}
                  height={36}
                  unoptimized
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                user.initials
              )}
            </div>
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
        {/* Topbar carries the mobile menu + relocated controls. On desktop with
            no page action it collapses away (see .ps-top--empty). */}
        <header className={`ps-top${topbarAction ? "" : " ps-top--empty"}`}>
          <button
            className="ps-top__menu"
            aria-label="Menyu"
            onClick={() => setMobileOpen(true)}
          >
            <PanelIcon name="menu" size={20} stroke={2} />
          </button>

          <div className="ps-top__right">
            {isMobile && controls}
            {topbarAction}
          </div>
        </header>

        <div className="ps-content">{children}</div>
      </main>
    </div>
  );
}
