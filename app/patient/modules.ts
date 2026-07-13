// ============================================================================
// Pasiyent paneli — modul kilidləri (tək mənbə / single source of truth)
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
// İSTİSNALAR (heç vaxt route kilidlənmir, çünki sidebar-dan kənar əlçatandır):
//   • profile  → aşağıda avatar linki ilə açılır (sidebar-dan yalnız gizlədilir),
//   • support  → böhran dəstəyi; RiskBanner ona link verir, kilidlənməməlidir,
//   • notifications, book, series → sistem/axın route-ları.
// ============================================================================

export type PatientModuleKey =
  | "dashboard"
  | "psychologists"
  | "appointments"
  | "packages"
  | "homework"
  | "favorites"
  | "tests"
  | "profile";

/** Hər nav modulunun açıq (true) / kilidli (false) vəziyyəti.
 *  2026-07-13: bütün modullar açıq — panel kilidləri müvəqqəti söndürülüb. */
export const PATIENT_MODULES: Record<PatientModuleKey, boolean> = {
  dashboard:     true,
  psychologists: true,
  appointments:  true,
  packages:      true,
  homework:      true,
  favorites:     true,
  tests:         true,
  profile:       true,
};

/** Yalnız route-u kilidlənə bilən modullar (dashboard və profile burada YOXDUR). */
const MODULE_PATHS: Partial<Record<PatientModuleKey, string[]>> = {
  psychologists: ["/patient/psychologists"],
  appointments:  ["/patient/appointments"],
  packages:      ["/patient/packages"],
  homework:      ["/patient/homework"],
  favorites:     ["/patient/favorites"],
  tests:         ["/patient/tests"],
};

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Modul açıqdırmı? Nav filtrləməsi üçün. */
export function isPatientModuleEnabled(key: PatientModuleKey): boolean {
  return PATIENT_MODULES[key];
}

/** Verilən pathname kilidli bir modula aiddirsə `true` qaytarır.
 *  Dashboard, profil, dəstək (support), bildiriş kimi route-lar həmişə açıqdır. */
export function isPatientPathLocked(pathname: string): boolean {
  for (const key of Object.keys(MODULE_PATHS) as PatientModuleKey[]) {
    if (PATIENT_MODULES[key]) continue;  // açıq modul
    if (MODULE_PATHS[key]!.some((p) => pathMatches(pathname, p))) return true;
  }
  return false;
}
