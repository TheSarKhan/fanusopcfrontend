/**
 * Single source of truth for appointment status presentation across ALL roles
 * (patient / psychologist / operator / admin). Replaces the per-page STATUS /
 * STATUS_TONE maps that had drifted apart.
 */
export interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
}

const META: Record<string, StatusMeta> = {
  PENDING:               { label: "Gözləyir",       bg: "#FEF3C7", fg: "#92400E" },
  NEW:                   { label: "Yeni",            bg: "#FEF3C7", fg: "#92400E" },
  REJECTED:              { label: "Yenidən təyin",   bg: "#FEF3C7", fg: "#92400E" },
  IN_REVIEW:             { label: "Operatorda",      bg: "#FEF3C7", fg: "#92400E" },
  ASSIGNED:              { label: "Təyin edilib",    bg: "#EEF2FF", fg: "#3730A3" },
  CONFIRMED:             { label: "Təsdiqli",        bg: "#D1FAE5", fg: "#065F46" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", bg: "#FEF3C7", fg: "#92400E" },
  DISPUTED:              { label: "Mübahisəli",      bg: "#FEE2E2", fg: "#991B1B" },
  COMPLETED:             { label: "Tamamlandı",      bg: "#F3F4F6", fg: "#374151" },
  CANCELLED:             { label: "Ləğv edildi",     bg: "#FEE2E2", fg: "#991B1B" },
  CANCEL_REQUESTED:      { label: "Ləğv gözlənir",   bg: "#FEF3C7", fg: "#92400E" },
};

export function statusMeta(status?: string | null): StatusMeta {
  return (status && META[status]) || { label: status ?? "—", bg: "#EEF2F7", fg: "#374151" };
}

/**
 * Pool yalnız YENİ (emal olunmamış) seans müraciətlərini tutur — təyin/təsdiq/
 * ləğv/tamam olanlar pool-a düşmür. Operator pool səhifəsi, nav badge sayğacı və
 * randevu siyahısındakı inline "Götür" bu eyni mənbədən istifadə edir.
 */
export const POOL_STATUSES = new Set(["PENDING", "NEW", "REJECTED"]);
export function isPoolEligible(status?: string | null): boolean {
  return status != null && POOL_STATUSES.has(status);
}
