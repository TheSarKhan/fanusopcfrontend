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
import { useT } from "@/lib/i18n/LocaleProvider";

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
  /** Plan modulu bağlıdır — sətir qıfılla göstərilir və klik naviqasiya etmir,
   *  `onLockedClick` çağırılır (məs. "planınızı dəyişin" modalı). */
  locked?: boolean;
  /** Sidebar-da kateqoriya başlığı. Eyni `group` dəyərinə malik ardıcıl sətirlər
   *  bir başlığın altında göstərilir — dəyər əvvəlki sətirdən fərqlənəndə yeni
   *  başlıq çıxır. Boş buraxılsa başlıqsız (əvvəlki davranış) göstərilir. */
  group?: string;
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
  /** Kilidli (plana daxil olmayan) nav sətrinə klik — məs. "planınızı dəyişin" modalı. */
  onLockedClick?: (item: PanelNavItem) => void;
  /**
   * Yan menyunun altında, profil sətrinin ÜSTÜNDƏ göstərilən əlavə blok.
   * Psixoloq paneli burada cari planını göstərir; digər panellər ötürmür.
   */
  sideFooter?: React.ReactNode;
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
  onLockedClick,
  sideFooter,
}: PanelShellProps) {
  const { t } = useT();
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
          aria-label={collapsed ? t("pshell.sidebarExpand") : t("pshell.sidebarCollapse")}
          onClick={toggleCollapsed}
        >
          <PanelIcon name="chevron" size={13} stroke={2.4} style={{ transform: collapsed ? undefined : "rotate(180deg)" }} />
        </button>

        <div className="ps-side__brand">
          {/* Loqo ƏSAS SAYTA aparır (panelin ana səhifəsinə yox) — istifadəçi brendə
              klikləyəndə ictimai saytı gözləyir. Panel ana səhifəsi nav-dakı ilk sətirdir. */}
          <a href={getMainSiteUrl()} className="ps-side__brand-link" aria-label={`Fanus — ${brandLabel}`}>
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
          </a>
          {/* Desktop: language + notifications sit right beside the logo. On mobile
              they live in the topbar instead (sidebar is off-canvas). */}
          {!isMobile && <div className="ps-side__controls">{controls}</div>}
          <button
            className="ps-side__close"
            aria-label={t("pshell.closeAria")}
            onClick={() => setMobileOpen(false)}
          >
            <PanelIcon name="x" size={18} stroke={2} />
          </button>
        </div>

        <nav className="ps-side__nav">
          {navItems.flatMap((item, idx) => {
            const nodes: React.ReactNode[] = [];
            const prevGroup = idx > 0 ? navItems[idx - 1].group : undefined;
            if (item.group && item.group !== prevGroup) {
              nodes.push(
                <div key={`group-${idx}`} className="ps-nav__group">{item.group}</div>
              );
            }

            const active =
              pathname === item.href ||
              (item.href !== homeHref && pathname.startsWith(item.href + "/")) ||
              (item.href !== homeHref && pathname === item.href) ||
              (item.match?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false);
            // Plana daxil olmayan modul: naviqasiya yoxdur — qıfıl + izah modalı.
            if (item.locked) {
              nodes.push(
                <button
                  key={item.href}
                  type="button"
                  className="ps-nav ps-nav--locked"
                  onClick={() => { setMobileOpen(false); onLockedClick?.(item); }}
                  title={t("pshell.lockedTitle")}
                  style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer", font: "inherit", opacity: 0.62 }}
                >
                  <PanelIcon name={item.icon} size={18} stroke={1.8} />
                  <span>{item.label}</span>
                  <span style={{ marginLeft: "auto", display: "inline-flex" }} aria-label={t("pshell.lockedAria")}>
                    <PanelIcon name="lock" size={14} stroke={1.9} />
                  </span>
                </button>
              );
              return nodes;
            }
            nodes.push(
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
                    title={t("pshell.pendingBadge", { n: item.badge })}
                    aria-label={t("pshell.pendingBadge", { n: item.badge })}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
            return nodes;
          })}
        </nav>

        {sideFooter}

        <div className="ps-side__user">
          <Link
            href={resolvedProfileHref}
            className="ps-side__user-link"
            onClick={() => setMobileOpen(false)}
            aria-label={t("pshell.profileAria")}
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
            aria-label={t("pshell.logout")}
            onClick={handleLogout}
            disabled={loggingOut}
            title={t("pshell.logout")}
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
            aria-label={t("pshell.menuAria")}
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
