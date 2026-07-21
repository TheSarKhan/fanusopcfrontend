import type { ReactNode } from "react";

/**
 * Vəziyyət göstəricisi.
 *
 * QAYDA: status rəngli rozet (badge/pill) və ya rəngli nöqtə ilə göstərilmir —
 * sadə mətndir. Rəng yalnız məna daşıyanda işlədilir və yalnız mətn rəngi kimi.
 * Standart hal `neutral`-dır; `wait` diqqət tələb edən, `risk` iadə/ləğv
 * riskini bildirir. Psixoloji test nəticələrini HEÇ VAXT rəngləməyin.
 */
export type StatusTone = "neutral" | "wait" | "risk" | "muted" | "positive";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "",
  wait: "fx-state--wait",
  risk: "fx-state--risk",
  muted: "fx-state--muted",
  positive: "fx-state--positive",
};

export function Status({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={["fx-state", TONE_CLASS[tone], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

/** Ödəniş statusları üçün hazır uyğunluq cədvəli. */
export const PAYMENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Gözləyir", tone: "wait" },
  PAID: { label: "Ödənilib", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Qismi qaytarılıb", tone: "wait" },
  REFUNDED: { label: "Geri qaytarılıb", tone: "risk" },
  CANCELLED: { label: "Ləğv edilib", tone: "muted" },
};

export function PaymentStatus({ value }: { value: string }) {
  const s = PAYMENT_STATUS[value];
  if (!s) return <Status tone="muted">{value}</Status>;
  return <Status tone={s.tone}>{s.label}</Status>;
}
