"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PanelAuthGuard from "@/components/PanelAuthGuard";
import PanelIcon from "@/components/PanelIcon";
import PlanTickIcon from "@/components/PlanTickIcon";
import PanelShell, { type PanelNavItem } from "@/components/PanelShell";
import WhatsAppButton from "@/components/WhatsAppButton";
import { getStoredUser } from "@/lib/auth";
import { useT } from "@/lib/i18n/LocaleProvider";
import { psychologistApi, type MyPlan } from "@/lib/api";
import {
  PSYCHOLOG_MODULES,
  isPsychologPathLockedWith,
  type PsychologModuleKey,
} from "./modules";

type ModuleNavItem = PanelNavItem & { key: PsychologModuleKey };

const WHATSAPP_SUPPORT = "https://wa.me/994502017164?text=" +
  encodeURIComponent("Salam, panel modullarım üçün planımı dəyişmək istəyirəm.");

/** Kilidli modul route-una birbaşa URL ilə girildikdə — yönləndirmə əvəzinə izah ekranı.
 *  `enabled` təyin olunan plandan gələn açıq modul dəstidir; null olduqda (hələ
 *  yüklənməyib və ya xəta) kilidləmə tətbiq olunmur — yanlış bloklamanın qarşısı. */
function ModuleLock({ enabled, children }: { enabled: Set<string> | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const locked = enabled !== null && isPsychologPathLockedWith(pathname, (k) => enabled.has(k));
  if (!locked) return <>{children}</>;
  return (
    <div style={{ maxWidth: 520, margin: "48px auto", background: "#fff", border: "1px solid var(--brand-100, #E3ECF9)", borderRadius: 16, padding: 32, textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#F1F5FC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <PanelIcon name="lock" size={22} stroke={1.9} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--oxford)", margin: "0 0 8px" }}>Bu modul planınıza daxil deyil</h2>
      <p style={{ fontSize: 14, color: "var(--oxford-60)", lineHeight: 1.6, margin: "0 0 20px" }}>
        Bu imkanlardan istifadə etmək üçün ödəniş planınızı dəyişin. Dəstək komandamız uyğun planı seçməkdə kömək edəcək.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <a href={WHATSAPP_SUPPORT} target="_blank" rel="noopener noreferrer" className="fx-btn fx-btn--primary" style={{ textDecoration: "none" }}>Dəstəklə əlaqə</a>
        <Link href="/psycholog" className="fx-btn fx-btn--ghost" style={{ textDecoration: "none" }}>Ana səhifəyə qayıt</Link>
      </div>
    </div>
  );
}

/** Kilidli nav sətrinə klikləyəndə çıxan izah modalı. */
/**
 * Sidebar-ın altında, profil sətrinin üstündə plan sətri.
 *
 * Tək sətirdir və çərçivəsi yoxdur: sidebar-ın alt hissəsi onsuz da profil bloku ilə
 * doludur, ora ikinci kart qoymaq sıxlıq yaradırdı. Modul sayı da yazılmır — psixoloq
 * üçün dəyər daşımır, açıq modulları menyunun özündə görür.
 *
 * Plan təyin olunmayıbsa da göstərilir: psixoloq «mənə plan verilməyib» ilə «planım
 * var, amma bu modul bağlıdır» arasındakı fərqi görməlidir.
 */
function PlanBadge({ plan }: { plan: MyPlan }) {
  const { t } = useT();
  const color = plan.tikColor || "var(--brand)";
  return (
    <Link
      href="/psycholog/profile"
      title={plan.assigned ? t("psyPlan.named", { name: plan.name ?? "" }) : t("psyPlan.none")}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        margin: "0 14px 6px", padding: "6px 0", textDecoration: "none",
        borderTop: "1px solid var(--hairline, rgba(0,33,71,.10))",
        paddingTop: 10,
      }}
    >
      {/* Planın öz nişanı — rəngi plandan gəlir. Plan yoxdursa boz çəkilir. */}
      <PlanTickIcon color={plan.assigned ? color : "var(--oxford-30, #B8C6D6)"} size={20} />
      <span style={{
        minWidth: 0, fontSize: 12.5, fontWeight: 700, color: "var(--oxford)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {plan.assigned ? t("psyPlan.named", { name: plan.name ?? "" }) : t("psyPlan.none")}
      </span>
    </Link>
  );
}

function PlanLockModal({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="fx-overlay fx-overlay--center" onClick={onClose} style={{ zIndex: 9000, padding: 20 }}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center" }}>
        <div className="fx-modal__icon fx-modal__icon--brand"><PanelIcon name="lock" size={19} /></div>
        <h3 className="fx-h3">{label} — planınıza daxil deyil</h3>
        <div className="fx-modal__text">
          Bu imkanlardan istifadə etmək üçün ödəniş planınızı dəyişin. Dəstək komandamız uyğun planı seçməkdə kömək edəcək.
        </div>
        <div className="fx-modal__actions">
          <button type="button" onClick={onClose} className="fx-btn fx-btn--ghost">Bağla</button>
          <a href={WHATSAPP_SUPPORT} target="_blank" rel="noopener noreferrer" className="fx-btn fx-btn--primary" style={{ textDecoration: "none" }}>Dəstəklə əlaqə</a>
        </div>
      </div>
    </div>
  );
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
  // Cari plan — sidebar-ın altında göstərilir ki, psixoloq hansı paketdə olduğunu
  // panelə baxan kimi bilsin (əvvəl bunu heç yerdən görmək mümkün deyildi).
  const [plan, setPlan] = useState<MyPlan | null>(null);
  useEffect(() => {
    let alive = true;
    psychologistApi.getMyModules()
      .then((keys) => { if (alive) setModules(new Set(keys)); })
      .catch(() => { /* fallback: statik konfiq (isEnabled aşağıda) */ });
    psychologistApi.getMyPlan()
      .then((p) => { if (alive) setPlan(p); })
      .catch(() => { /* plan göstərilməsə panel yenə işləməlidir */ });
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
    { key: "tests",        href: "/psycholog/tests",        label: "Psixoloji Testlər",             icon: "clipboard" },
    { key: "articles",     href: "/psycholog/articles",     label: t("nav.articles"),     icon: "book" },
    { key: "community",    href: "/psycholog/community",    label: "İcma",                icon: "chat" },
    { key: "resources",    href: "/psycholog/resources",    label: "Resurslar",           icon: "content" },
    { key: "availability", href: "/psycholog/availability", label: t("nav.workHours"),    icon: "clock" },
    { key: "reviews",      href: "/psycholog/reviews",      label: t("nav.reviews"),      icon: "star" },
  ];

  // Kilidli modullar GİZLƏDİLMİR — qıfılla görünür ki, psixoloq nəyin mövcud
  // olduğunu bilsin və plan dəyişikliyi üçün müraciət edə bilsin.
  // Profil modul deyil — kilid mexanizmindən kənardır və həmişə açıqdır.
  const nav: PanelNavItem[] = [
    ...allNav.map((item) => ({ ...item, locked: !isEnabled(item.key) })),
    { href: "/psycholog/profile", label: t("nav.profile"), icon: "user" as const },
  ];

  const [lockedLabel, setLockedLabel] = useState<string | null>(null);

  return (
    <PanelShell
      brandLabel={t("pricing.rolePsychologist")}
      homeHref="/psycholog"
      navItems={nav}
      user={{ name, initials, role: t("pricing.rolePsychologist") }}
      onLockedClick={(item) => setLockedLabel(item.label)}
      sideFooter={plan && <PlanBadge plan={plan} />}
    >
      <ModuleLock enabled={modules}>{children}</ModuleLock>
      <WhatsAppButton side="right" />
      {lockedLabel && <PlanLockModal label={lockedLabel} onClose={() => setLockedLabel(null)} />}
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
