// ============================================================================
// Psixoloq paneli — modul kilidləri (tək mənbə / single source of truth)
// ----------------------------------------------------------------------------
// Panel çox modulludur; fokusu itirməmək üçün modulları bir-bir açırıq.
//
//   • Bir modulu AÇMAQ:   aşağıda onun sətrini `true` et.
//   • Bir modulu BAĞLAMAQ: `false` et.
//
// `false` (kilidli) olan modul:
//   • sidebar-da görünmür  → layout.tsx onları filtrləyir,
//   • route-una birbaşa URL ilə girişdə Dashboard-a yönləndirilir → ModuleLock.
//
// Dashboard həmişə açıq qalır (panelin girişidir).
// Profil və bildirişlər modul deyil — onlar həmişə əlçatandır.
// ============================================================================

export type PsychologModuleKey =
  | "dashboard"
  | "calendar"
  | "appointments"
  | "packages"
  | "clients"
  | "homework"
  | "tests"
  | "articles"
  | "community"
  | "resources"
  | "availability"
  | "reviews";

/** Hər modulun açıq (true) / kilidli (false) vəziyyəti.
 *  2026-07-13: bütün modullar açıq — panel kilidləri müvəqqəti söndürülüb. */
export const PSYCHOLOG_MODULES: Record<PsychologModuleKey, boolean> = {
  dashboard:    true,
  calendar:     true,
  appointments: true,
  packages:     true,
  clients:      true,
  homework:     true,
  tests:        true,
  articles:     true,
  community:    true,
  resources:    true,
  availability: true,
  reviews:      true,
};

/** Hər modulun "sahib olduğu" route prefiksləri (guard üçün). */
const MODULE_PATHS: Record<PsychologModuleKey, string[]> = {
  dashboard:    ["/psycholog"],
  calendar:     ["/psycholog/calendar"],
  appointments: ["/psycholog/appointments"],
  packages:     ["/psycholog/packages"],
  clients:      ["/psycholog/clients"],
  homework:     ["/psycholog/homework"],
  tests:        ["/psycholog/tests"],
  articles:     ["/psycholog/articles"],
  community:    ["/psycholog/community"],
  resources:    ["/psycholog/resources", "/psycholog/materials"],
  availability: ["/psycholog/availability"],
  reviews:      ["/psycholog/reviews"],
};

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Modul açıqdırmı? Nav filtrləməsi üçün. */
export function isPsychologModuleEnabled(key: PsychologModuleKey): boolean {
  return PSYCHOLOG_MODULES[key];
}

/** Verilən pathname kilidli bir modula aiddirsə `true` qaytarır.
 *  Dashboard, profil, bildirişlər kimi modul olmayan route-lar həmişə açıqdır. */
export function isPsychologPathLocked(pathname: string): boolean {
  for (const key of Object.keys(MODULE_PATHS) as PsychologModuleKey[]) {
    if (key === "dashboard") continue;     // dashboard heç vaxt kilidlənmir
    if (PSYCHOLOG_MODULES[key]) continue;  // açıq modul
    if (MODULE_PATHS[key].some((p) => pathMatches(pathname, p))) return true;
  }
  return false;
}
