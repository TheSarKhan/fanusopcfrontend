/**
 * Public app URL — the canonical origin of the deployed frontend.
 * Set via NEXT_PUBLIC_APP_URL in .env.local / Netlify env vars.
 *
 * Examples:
 *   Local dev:   NEXT_PUBLIC_APP_URL=http://localhost:3000
 *   Production:  NEXT_PUBLIC_APP_URL=https://fanusopc.com
 *
 * Used for: calendar event URLs, share/OG links, email-link fallbacks, etc.
 * Does NOT include trailing slash.
 */
export const APP_URL: string = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Hostname only (without scheme), e.g. "fanusopc.com" or "localhost:3000".
 * Useful for UID namespacing, cookie domains, etc.
 */
export const APP_HOST: string = APP_URL.replace(/^https?:\/\//, "");

/**
 * Build an absolute URL from a relative path.
 *   appUrl("/patient/appointments") → "https://fanusopc.com/patient/appointments"
 */
export function appUrl(path: string = ""): string {
  if (!path) return APP_URL;
  return APP_URL + (path.startsWith("/") ? path : "/" + path);
}
