// Modul A — pul formatlaması (AZN). Kart, detal, booking, paketlər və admin/psixoloq
// qiymət səhifələrində EYNİ helper işlədilir ki, format vahid olsun.

const AZN = new Intl.NumberFormat("az-AZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Məbləği "120,00 ₼" formatında qaytarır. null/undefined üçün boş sətir. */
export function formatAzn(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "";
  return `${AZN.format(value)} ₼`;
}
