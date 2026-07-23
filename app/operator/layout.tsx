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
  // "Ödənişlər" nav sayğacı — bütün gözləyən (PENDING) ödənişlər (sahibli/sahibsiz fərq
  // etmir; bu, modulun özündəki "Gözləyən" tabının sayı ilə eyni işi göstərir).
  const [paymentsCount, setPaymentsCount] = useState(0);
  const loadPoolCount = useCallback(() => {
    Promise.all([
      operatorApi.listPoolAppointments().catch(() => []),
      operatorApi.listPoolPackages().catch(() => []),
      operatorApi.listPendingPayments("PENDING").catch(() => []),
    ]).then(([appts, pkgs, payments]) => {
      // Pool "kartları" sayı: standalone seans müraciətləri + appointment-dən törəyən
      // paket qrupları + randevusu olmayan (SCHEDULE_LATER) sahibsiz paketlər.
      // Ödəniş POOL DEYİL — operator yalnız öz üzərindəki ödənişi görür.
      const poolAppts = appts.filter(x => x.claimedByUserId == null && isPoolEligible(x.status));
      const standalone = poolAppts.filter(x => x.patientPackageId == null).length;
      const apptPkgIds = new Set(poolAppts.filter(x => x.patientPackageId != null).map(x => x.patientPackageId));
      const pendingPkgs = pkgs.filter(p => !apptPkgIds.has(p.id)).length;
      setPoolCount(standalone + apptPkgIds.size + pendingPkgs);
      // "Ödənişlər" badge — operatorun ÖZ gözləyən ödənişləri (sahibliyində olanlar).
      setPaymentsCount(payments.length);
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
      if (ty.startsWith("APPOINTMENT_") || ty.startsWith("PAYMENT_") || ty.startsWith("PACKAGE_")) { loadPoolCount(); loadMeetingLinksCount(); }
      if (ty === "SESSION_REQUEST_NEW") loadSessionReqCount();
      if (ty === "SESSION_FEEDBACK") loadFeedbackCount();
    });
    const offC = subscribeOperatorClaims(() => loadPoolCount());
    const refreshAll = () => {
      loadPoolCount(); loadSessionReqCount(); loadFeedbackCount(); loadMeetingLinksCount();
    };
    // Canlı push (websocket) həmişə çatmaya bilər — badge-in "yalnız F5-dən sonra"
    // yenilənməsini aradan qaldırmaq üçün polling qısaldıldı və operator tab-a
    // qayıdanda (fokus/görünürlük) dərhal yenilənir.
    const id = setInterval(refreshAll, 25_000);
    const onFocus = () => refreshAll();
    const onVisible = () => { if (document.visibilityState === "visible") refreshAll(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offN(); offC(); clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadPoolCount, loadSessionReqCount, loadFeedbackCount, loadMeetingLinksCount]);

  // Bütün modullar. Kilidlilər (./modules.ts) sidebar-dan çıxarılır.
  const allNav: ModuleNavItem[] = [
    { key: "dashboard",        href: "/operator",                    label: t("nav.dashboard"),       icon: "home" },
    { key: "pool",             href: "/operator/pool",               label: "Randevu hovuzu",         icon: "inbox", badge: poolCount },
    // "Randevular" pool sayğacını GÖSTƏRMİR — sahibsiz yeni müraciətlər yalnız
    // "Randevu hovuzu"na aiddir (Bug 1). Pasiyent paket seansı planlayanda seans
    // hovuza düşür və "Randevu hovuzu" badge-i artır (Bug 4/6).
    { key: "appointments",     href: "/operator/appointments",       label: t("nav.appointments"),    icon: "calendar" },
    { key: "meetingLinks",  href: "/operator/meeting-links", label: "Görüş linkləri",        icon: "video", badge: meetingLinksCount },
    { key: "payments",      href: "/operator/payments",     label: t("pkg.paymentsTitle"),   icon: "clipboard", badge: paymentsCount },
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
