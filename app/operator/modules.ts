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
// Dashboard həmişə açıq qalır (panelin girişidir).
// Profil və bildirişlər modul deyil — onlar həmişə əlçatandır.
// ============================================================================

export type OperatorModuleKey =
  | "dashboard"
  | "pool"
  | "appointments"
  | "meetingLinks"
  | "payments"
  | "feedback"
  | "referrals"
  | "analytics"
  | "customers"
  | "psychologists";

/** Hər nav modulunun açıq (true) / kilidli (false) vəziyyəti. */
export const OPERATOR_MODULES: Record<OperatorModuleKey, boolean> = {
  dashboard:     true,  // həmişə açıq — panelin girişi
  pool:          true,  // AÇIQ — müraciət pool-u (intake/triage)
  appointments:  true,  // AÇIQ — randevu detalı (bilet) + siyahı
  meetingLinks:  true,  // AÇIQ — Görüş linkləri (link göndərmə iş siyahısı)
  payments:      true,  // AÇIQ — Ödənişlər (təsdiq · ləğv · geri qaytarma tam/qismi)
  feedback:      true,   // AÇIQ — Seans rəyləri (psixoloq → pasient → rəylər)
  referrals:     false,
  analytics:     true,  // AÇIQ — Analitika (gəlir/refund + əməliyyat göstəriciləri)
  customers:     true,  // AÇIQ — Müştərilər (360° profil + paket satışı)
  psychologists: true,  // AÇIQ — Psixoloq statistikası (reytinq siyahısı + 360° detal)
};

/** Yalnız route-u kilidlənə bilən modullar (dashboard burada YOXDUR). */
const MODULE_PATHS: Partial<Record<OperatorModuleKey, string[]>> = {
  pool:          ["/operator/pool"],
  appointments:  ["/operator/appointments"],
  meetingLinks:  ["/operator/meeting-links"],
  payments:      ["/operator/payments"],
  feedback:      ["/operator/feedback"],
  referrals:     ["/operator/referrals"],
  analytics:     ["/operator/analytics"],
  customers:     ["/operator/customers"],
  psychologists: ["/operator/psychologists"],
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
