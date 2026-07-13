// ============================================================================
// Operator paneli — modul kilidləri (tək mənbə / single source of truth)
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
// Dashboard route-u (/operator) MODULE_PATHS-da yoxdur, ona görə ModuleLock onu
// heç vaxt bağlamır (kilidli modulların fallback yönləndirmə hədəfi kimi qalır) —
// `dashboard: false` yalnız sidebar linkini gizlədir, route-u söndürmür.
// Profil və bildirişlər modul deyil — onlar həmişə əlçatandır.
// ============================================================================

// Qeyd: "referrals" (standalone siyahı) modulu qarışıqlıq yaratmamaq üçün SİLİNİB
// (2026-07-03). Yönləndirmə detalı (/operator/referrals/{id}) qalır — Randevular
// səhifəsinin tabından açılır. "sessionRequests" (anonim lead forması) həmin
// tarixdə bağlanmışdı — sonra hovuz/sahiblik modeli ilə yenidən açıldı.
// "feedback" (seans rəyləri) də həmin tarixdə bağlanmışdı; 2026-07-12-də lifecycle
// statusu (YENİ → ƏLAQƏDƏ → HƏLL OLUNDU) ilə geri qaytarıldı — pasiyentin "operator
// mənimlə əlaqə saxlasın" müraciəti artıq izlənilə bilən siyahıda görünür, yalnız
// bildirişdə deyil.

export type OperatorModuleKey =
  | "dashboard"
  | "pool"
  | "appointments"
  | "meetingLinks"
  | "payments"
  | "analytics"
  | "customers"
  | "psychologists"
  | "requests"
  | "feedback"
  | "sessionRequests";

/** Hər nav modulunun açıq (true) / kilidli (false) vəziyyəti.
 *  2026-07-13: bütün modullar açıq — panel kilidləri müvəqqəti söndürülüb. */
export const OPERATOR_MODULES: Record<OperatorModuleKey, boolean> = {
  dashboard:       true,
  pool:            true,
  appointments:    true,
  meetingLinks:    true,
  payments:        true,
  analytics:       true,
  customers:       true,
  psychologists:   true,
  requests:        true,
  feedback:        true,
  sessionRequests: true,
};

/** Yalnız route-u kilidlənə bilən modullar (dashboard burada YOXDUR). */
const MODULE_PATHS: Partial<Record<OperatorModuleKey, string[]>> = {
  pool:            ["/operator/pool"],
  appointments:    ["/operator/appointments"],
  meetingLinks:  ["/operator/meeting-links"],
  payments:      ["/operator/payments"],
  analytics:     ["/operator/analytics"],
  customers:     ["/operator/customers"],
  psychologists: ["/operator/psychologists"],
  requests:      ["/operator/requests"],
  feedback:      ["/operator/feedback"],
  sessionRequests: ["/operator/session-requests"],
};

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Modul açıqdırmı? Nav filtrləməsi üçün. */
export function isOperatorModuleEnabled(key: OperatorModuleKey): boolean {
  return OPERATOR_MODULES[key];
}

/** Verilən pathname kilidli bir modula aiddirsə `true` qaytarır.
 *  Dashboard, profil, bildiriş kimi route-lar həmişə açıqdır. */
export function isOperatorPathLocked(pathname: string): boolean {
  for (const key of Object.keys(MODULE_PATHS) as OperatorModuleKey[]) {
    if (OPERATOR_MODULES[key]) continue;  // açıq modul
    if (MODULE_PATHS[key]!.some((p) => pathMatches(pathname, p))) return true;
  }
  return false;
}
