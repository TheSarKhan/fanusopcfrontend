import { readCookie, writeCookie, deleteCookie } from "@/lib/crossSiteCookie";

/**
 * Saytda anonim doldurulmuş testin "sahiblənmə" tokeni.
 *
 * Ziyarətçi testi əsas saytda (khansoft.az) bitirir, nəticəni görmək üçün isə
 * pasiyent hesabı lazımdır — yəni qeydiyyat, e-poçt təsdiqi, giriş, sonra panel
 * (patient.khansoft.az). Token bu yolun HAMISINI keçməlidir.
 *
 * Əvvəl yalnız `localStorage` işlədilirdi və bu, panelə çatmırdı: `localStorage`
 * origin-ə bağlıdır, əsas saytda yazılan dəyər alt-domendə görünmür. Ona görə əsas
 * saxlama yeri registrable domenə yazılmış cookie-dir; `localStorage` isə eyni
 * origin üçün ehtiyat nüsxə olaraq qalır.
 */
const KEY = "pendingTestClaim";
const TTL_DAYS = 30;

export function savePendingClaim(token: string) {
  writeCookie(KEY, token, TTL_DAYS);
  try { localStorage.setItem(KEY, token); } catch { /* private mode */ }
}

export function readPendingClaim(): string | null {
  const fromCookie = readCookie(KEY);
  if (fromCookie) return fromCookie;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearPendingClaim() {
  deleteCookie(KEY);
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
