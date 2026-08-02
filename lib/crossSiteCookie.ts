/**
 * Alt-domenlər arasında bölüşülən cookie köməkçiləri.
 *
 * Platforma bir neçə origin-dən ibarətdir: əsas sayt (khansoft.az) və panellər
 * (patient./psycholog./operator./admin.). `localStorage` origin-ə bağlıdır, ona görə
 * əsas saytda yazılan dəyər panel açılanda GÖRÜNMÜR. Bu səbəbdən keçidi yaşamalı olan
 * hər şey (dil seçimi, gözləyən test tokeni) registrable domenə yazılmış cookie-də
 * saxlanılır.
 */

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Cookie-nin bölüşüləcəyi domen — məs. ".khansoft.az". Domainsiz yazılsaydı cookie
 * yalnız cari host üçün olardı və alt-domenə keçəndə itərdi.
 */
export function cookieDomain(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  const parts = host.split(".");
  if (parts.length >= 2) return "." + parts.slice(-2).join(".");
  return host;
}

export function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const domain = cookieDomain();
  // Köhnə host-only (domainsiz) nüsxəni təmizlə ki, iki eyni-adlı cookie qalmasın.
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`
    + (domain ? `; Domain=${domain}` : "");
}

/** Hər iki nüsxəni silir: domenli və host-only. */
export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const domain = cookieDomain();
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  if (domain) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Domain=${domain}`;
  }
}
