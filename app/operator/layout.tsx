"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  // Nav-dakı "Görüş linkləri" sayğacı — yaxınlaşan, hələ link göndərilməmiş seanslar
  // (eyni mənbə — Görüş linkləri səhifəsinin özü).
  const [meetingLinksCount, setMeetingLinksCount] = useState(0);
  const loadMeetingLinksCount = useCallback(() => {
    operatorApi.pendingMeetingLinks().then(items => setMeetingLinksCount(items.length)).catch(() => {});
  }, []);
  useEffect(() => { loadMeetingLinksCount(); }, [loadMeetingLinksCount]);

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
      if (ty.startsWith("APPOINTMENT_") || ty.startsWith("PAYMENT_")) { loadPoolCount(); loadMeetingLinksCount(); }
      if (ty === "SESSION_REQUEST_NEW") loadSessionReqCount();
      if (ty === "SESSION_FEEDBACK") loadFeedbackCount();
    });
    const offC = subscribeOperatorClaims(() => loadPoolCount());
    const id = setInterval(() => {
      loadPoolCount(); loadSessionReqCount(); loadFeedbackCount(); loadMeetingLinksCount();
    }, 60_000);
    return () => { offN(); offC(); clearInterval(id); };
  }, [loadPoolCount, loadSessionReqCount, loadFeedbackCount, loadMeetingLinksCount]);

  // Bütün modullar. Kilidlilər (./modules.ts) sidebar-dan çıxarılır.
  const allNav: ModuleNavItem[] = [
    { key: "dashboard",        href: "/operator",                    label: t("nav.dashboard"),       icon: "home" },
    { key: "pool",             href: "/operator/pool",               label: "Randevu hovuzu",         icon: "inbox", badge: poolCount },
    { key: "appointments",     href: "/operator/appointments",       label: t("nav.appointments"),    icon: "calendar", badge: poolCount },
    { key: "meetingLinks",  href: "/operator/meeting-links", label: "Görüş linkləri",        icon: "video", badge: meetingLinksCount },
    { key: "payments",      href: "/operator/payments",     label: t("pkg.paymentsTitle"),   icon: "clipboard" },
    { key: "analytics",     href: "/operator/analytics",    label: t("nav.analytics"),       icon: "chart" },
    { key: "customers",     href: "/operator/customers",     label: "Müştərilər",            icon: "users" },
    { key: "psychologists", href: "/operator/psychologists", label: "Psixoloqlar", icon: "user" },
    { key: "requests",      href: "/operator/requests",      label: "Rəy silmə tələbləri",   icon: "flag" },
    { key: "feedback",      href: "/operator/feedback",      label: "Seans rəyləri",         icon: "star", badge: feedbackCount },
    { key: "sessionRequests", href: "/operator/session-requests", label: "Sayt müraciətləri", icon: "message", badge: sessionReqCount },
  ];

  const nav: PanelNavItem[] = allNav.filter((item) => OPERATOR_MODULES[item.key]);

  return (
    <PanelShell
      brandLabel="Operator"
      homeHref="/operator"
      navItems={nav}
      user={{ name, initials, role: "Operator" }}
    >
      <ModuleLock>{children}</ModuleLock>
    </PanelShell>
  );
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole={["OPERATOR", "ADMIN"]}>
      <OperatorShell>{children}</OperatorShell>
    </PanelAuthGuard>
  );
}
