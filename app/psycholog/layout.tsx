"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import { psychologistApi } from "@/lib/api";
import {
  PSYCHOLOG_MODULES,
  isPsychologPathLockedWith,
  type PsychologModuleKey,
} from "./modules";

type ModuleNavItem = PanelNavItem & { key: PsychologModuleKey };

/** Kilidli modul route-una birbaşa URL ilə girişi tutub Dashboard-a yönləndirir.
 *  `enabled` təyin olunan plandan gələn açıq modul dəstidir; null olduqda (hələ
 *  yüklənməyib və ya xəta) kilidləmə tətbiq olunmur — yanlış yönləndirmənin qarşısı. */
function ModuleLock({ enabled, children }: { enabled: Set<string> | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locked = enabled !== null && isPsychologPathLockedWith(pathname, (k) => enabled.has(k));

  useEffect(() => {
    if (locked) router.replace("/psycholog");
  }, [locked, router]);

  if (locked) return null;
  return <>{children}</>;
}

function PsychologShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const u = getStoredUser();
  const first = u?.firstName ?? "";
  const last = u?.lastName ?? "";
  const name = (first + " " + last).trim() || u?.email || t("nav.psychologists");
  const initials = ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "P";

  // Təyin olunan plana görə açıq modullar — backend-dən. null = hələ yüklənməyib
  // (bu halda statik PSYCHOLOG_MODULES fallback kimi işlədilir, kilid tətbiq olunmur).
  const [modules, setModules] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    psychologistApi.getMyModules()
      .then((keys) => { if (alive) setModules(new Set(keys)); })
      .catch(() => { /* fallback: statik konfiq (isEnabled aşağıda) */ });
    return () => { alive = false; };
  }, []);

  /** Nav filtri: yüklənibsə plan modulları, yoxsa statik fallback. */
  const isEnabled = (key: PsychologModuleKey) => (modules ? modules.has(key) : PSYCHOLOG_MODULES[key]);

  // Bütün modullar. Kilidlilər (plan / statik) sidebar-dan çıxarılır.
  const allNav: ModuleNavItem[] = [
    { key: "dashboard",    href: "/psycholog",              label: t("nav.dashboard"),    icon: "home" },
    { key: "calendar",     href: "/psycholog/calendar",     label: t("nav.calendar"),     icon: "calendar" },
    { key: "appointments", href: "/psycholog/appointments", label: t("nav.appointments"), icon: "video" },
    { key: "packages",     href: "/psycholog/packages",     label: "Qiymətlər & Paketlər", icon: "package" },
    { key: "clients",      href: "/psycholog/clients",      label: t("nav.clients"),      icon: "users" },
    { key: "homework",     href: "/psycholog/homework",     label: t("nav.homework"),     icon: "check" },
    { key: "tests",        href: "/psycholog/tests",        label: "Testlər",             icon: "clipboard" },
    { key: "articles",     href: "/psycholog/articles",     label: t("nav.articles"),     icon: "book" },
    { key: "community",    href: "/psycholog/community",    label: "İcma",                icon: "chat" },
    { key: "resources",    href: "/psycholog/resources",    label: "Resurslar",           icon: "content" },
    { key: "availability", href: "/psycholog/availability", label: t("nav.workHours"),    icon: "clock" },
    { key: "reviews",      href: "/psycholog/reviews",      label: t("nav.reviews"),      icon: "star" },
  ];

  // Profil modul deyil — kilid mexanizmindən kənardır və həmişə görünür.
  const nav: PanelNavItem[] = [
    ...allNav.filter((item) => isEnabled(item.key)),
    { href: "/psycholog/profile", label: t("nav.profile"), icon: "user" },
  ];

  return (
    <PanelShell
      brandLabel={t("pricing.rolePsychologist")}
      homeHref="/psycholog"
      navItems={nav}
      user={{ name, initials, role: t("pricing.rolePsychologist") }}
    >
      <ModuleLock enabled={modules}>{children}</ModuleLock>
    </PanelShell>
  );
}

export default function PsychologLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="PSYCHOLOGIST">
      <PsychologShell>{children}</PsychologShell>
    </PanelAuthGuard>
  );
}
