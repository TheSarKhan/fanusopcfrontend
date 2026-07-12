"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import OperatorCommandPalette from "@/components/OperatorCommandPalette";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";
import { operatorApi } from "@/lib/api";
import { isPoolEligible } from "@/lib/appointmentStatus";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import {
  OPERATOR_MODULES,
  isOperatorPathLocked,
  type OperatorModuleKey,
} from "./modules";

type ModuleNavItem = PanelNavItem & { key: OperatorModuleKey };

/** Kilidli modul route-una birbaşa URL ilə girişi tutub Dashboard-a yönləndirir.
 *  Sidebar onsuz da kilidli modulları gizlədir — bu, yalnız birbaşa URL halını
 *  qoruyur. Profil və bildiriş route-ları həmişə açıq qalır. */
function ModuleLock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locked = isOperatorPathLocked(pathname);

  useEffect(() => {
    if (locked) router.replace("/operator");
  }, [locked, router]);

  if (locked) return null;
  return <>{children}</>;
}

function OperatorShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || "Operator";
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "O";

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Nav-dakı "Pool" sayğacı — sahibsiz yeni müraciətlər (seans + ödəniş).
  // Operator hara olursa olsun gözləyən işin sayını görür.
  const [poolCount, setPoolCount] = useState(0);
  const loadPoolCount = useCallback(() => {
    Promise.all([
      operatorApi.listPoolAppointments().catch(() => []),
      operatorApi.listPendingPayments("PENDING").catch(() => []),
    ]).then(([appts, payments]) => {
      // Pool endpoint-i onsuz da sahibsiz+uyğun statusları qaytarır; filtr
      // müdafiə xarakterlidir (endpoint semantikası dəyişsə say şişməsin).
      const a = appts.filter(x => x.claimedByUserId == null && isPoolEligible(x.status)).length;
      const p = payments.filter(x => x.claimedByOperatorId == null).length;
      setPoolCount(a + p);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadPoolCount(); }, [loadPoolCount]);

  // Nav-dakı "Müraciətlər" sayğacı — saytdan gələn yeni (hələ götürülməmiş) lead-lər.
  const [sessionReqCount, setSessionReqCount] = useState(0);
  const loadSessionReqCount = useCallback(() => {
    operatorApi.sessionRequestCountNew().then(setSessionReqCount).catch(() => {});
  }, []);
  useEffect(() => { loadSessionReqCount(); }, [loadSessionReqCount]);

  // Nav-dakı "Seans rəyləri" sayğacı — açıq (həll olunmamış) əlaqə tələbləri.
  // Pasiyentin "operator mənimlə əlaqə saxlasın" müraciəti resolved olana qədər sayılır.
  const [feedbackCount, setFeedbackCount] = useState(0);
  const loadFeedbackCount = useCallback(() => {
    operatorApi.feedbackOpenCount().then(setFeedbackCount).catch(() => {});
  }, []);
  useEffect(() => { loadFeedbackCount(); }, [loadFeedbackCount]);

  // Canlı yeniləmə: yeni müraciət/ödəniş bildirişi və ya sahiblik (claim) hadisəsi.
  useEffect(() => {
    const offN = subscribeNotifications((n) => {
      const ty = typeof n.type === "string" ? n.type : "";
      if (ty.startsWith("APPOINTMENT_") || ty.startsWith("PAYMENT_")) loadPoolCount();
      if (ty === "SESSION_REQUEST_NEW") loadSessionReqCount();
      if (ty === "SESSION_FEEDBACK") loadFeedbackCount();
    });
    const offC = subscribeOperatorClaims(() => loadPoolCount());
    const id = setInterval(() => { loadPoolCount(); loadSessionReqCount(); loadFeedbackCount(); }, 60_000);
    return () => { offN(); offC(); clearInterval(id); };
  }, [loadPoolCount, loadSessionReqCount, loadFeedbackCount]);

  // Open palette on Cmd+K / Ctrl+K from anywhere in the operator panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bütün modullar. Kilidlilər (./modules.ts) sidebar-dan çıxarılır.
  const allNav: ModuleNavItem[] = [
    { key: "dashboard",        href: "/operator",                    label: t("nav.dashboard"),       icon: "home" },
    { key: "pool",             href: "/operator/pool",               label: "Randevu hovuzu",         icon: "inbox", badge: poolCount },
    { key: "appointments",     href: "/operator/appointments",       label: t("nav.appointments"),    icon: "calendar" },
    { key: "meetingLinks",  href: "/operator/meeting-links", label: "Görüş linkləri",        icon: "video" },
    { key: "payments",      href: "/operator/payments",     label: t("pkg.paymentsTitle"),   icon: "clipboard" },
    { key: "analytics",     href: "/operator/analytics",    label: t("nav.analytics"),       icon: "chart" },
    { key: "customers",     href: "/operator/customers",     label: "Müştərilər",            icon: "users" },
    { key: "psychologists", href: "/operator/psychologists", label: "Psixoloq statistikası", icon: "user" },
    { key: "requests",      href: "/operator/requests",      label: "Rəy silmə tələbləri",   icon: "flag" },
    { key: "feedback",      href: "/operator/feedback",      label: "Seans rəyləri",         icon: "star", badge: feedbackCount },
    { key: "sessionRequests", href: "/operator/session-requests", label: "Sayt müraciətləri", icon: "message", badge: sessionReqCount },
  ];

  const nav: PanelNavItem[] = allNav.filter((item) => OPERATOR_MODULES[item.key]);

  return (
    <>
      <PanelShell
        brandLabel="Operator"
        homeHref="/operator"
        navItems={nav}
        user={{ name, initials, role: "Operator" }}
        searchPlaceholder={t("common.search")}
        topbarExtras={
          <button type="button" onClick={() => setPaletteOpen(true)} className="opcp-trigger" title="Sürətli axtarış (⌘K)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Axtar
            <kbd>⌘K</kbd>
          </button>
        }
      >
        <ModuleLock>{children}</ModuleLock>
      </PanelShell>
      <OperatorCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole={["OPERATOR", "ADMIN"]}>
      <OperatorShell>{children}</OperatorShell>
    </PanelAuthGuard>
  );
}
