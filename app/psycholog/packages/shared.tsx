import type { PackagePatient } from "@/lib/api";

/** Pasiyent paketi statusu — kart və pasiyent siyahısı səhifəsi arasında paylaşılır. */
export const STATUS_PT: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_PAYMENT: { label: "Ödəniş gözlənilir", bg: "#FEF3C7", color: "#92400E" },
  ACTIVE:    { label: "Aktiv",       bg: "#D1FAE5", color: "#065F46" },
  // EXHAUSTED = paketin BÜTÜN seansları keçirilib (faktiki bitib).
  EXHAUSTED: { label: "Tamamlanıb",  bg: "#F3F4F6", color: "#374151" },
  EXPIRED:   { label: "Vaxtı keçib", bg: "#FEF3C7", color: "#92400E" },
  CANCELLED: { label: "Ləğv",        bg: "#FEE2E2", color: "#991B1B" },
};

const TINTS = [
  { bg: "#E0EBFA", fg: "#1E3A8A" }, { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" }, { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" }, { bg: "#CCFBF1", fg: "#115E59" },
];
export function avatarTint(name?: string | null) {
  const s = name ?? "?"; let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}
export function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** Eyni pasiyent eyni paketi bir neçə dəfə alarsa, alış tarixinə görə "1-ci dəfə", "2-ci
 *  dəfə" sırası hesablanır — hər giriş özünün neçənci alış olduğunu bilsin. */
export function withPurchaseOrdinal(patients: PackagePatient[]): (PackagePatient & { ordinal: number; purchaseCount: number })[] {
  const byPatient = new Map<number, PackagePatient[]>();
  for (const p of patients) {
    const arr = byPatient.get(p.patientId) ?? [];
    arr.push(p);
    byPatient.set(p.patientId, arr);
  }
  const ordinalByRef = new Map<PackagePatient, number>();
  for (const arr of byPatient.values()) {
    arr.sort((a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime());
    arr.forEach((p, i) => ordinalByRef.set(p, i + 1));
  }
  return patients.map(p => ({ ...p, ordinal: ordinalByRef.get(p) ?? 1, purchaseCount: byPatient.get(p.patientId)?.length ?? 1 }));
}
