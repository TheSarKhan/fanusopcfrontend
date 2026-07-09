import { storeUser, clearUser, getMainSiteUrl } from "./auth";
import { withSlugs } from "./slug";

let API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
if (API_URL.endsWith("/")) API_URL = API_URL.slice(0, -1);
if (!API_URL.endsWith("/api")) API_URL += "/api";

const BASE = API_URL;

/** Read the user's chosen UI locale from the cookie set by LocaleProvider.
 *  Returns the BCP-47 tag the backend can match against (`az`, `ru`, `en`). */
function readLocaleCookie(): string {
  if (typeof document === "undefined") return "az";
  const m = document.cookie.match(/(?:^|;\s*)fanus-locale=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "az";
}

/** Backend reads Accept-Language to localize error messages. */
function localeHeaders(): Record<string, string> {
  return { "Accept-Language": readLocaleCookie() };
}

/** Serverlə əlaqə qurulmadıqda göstəriləcək lokallaşmış mesaj (locale cookie-yə görə). */
function connectionErrorMessage(): string {
  switch (readLocaleCookie()) {
    case "en": return "Could not reach the server. Check your internet connection and try again.";
    case "ru": return "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте снова.";
    default:   return "Serverlə əlaqə qurulmadı. İnternet bağlantınızı yoxlayıb bir azdan yenidən cəhd edin.";
  }
}

/** fetch üçün nazik örtük. Server sönülü, internet yoxdur, DNS/CORS kimi ŞƏBƏKƏ
 *  səviyyəsində uğursuzluqda fetch xam `TypeError: Failed to fetch` atır — bu mətn
 *  birbaşa istifadəçiyə (məs. login formuna) düşür. Burada həmin TypeError-i tutub
 *  anlaşıqlı, lokallaşmış mesaja çeviririk. HTTP cavab (4xx/5xx) qayıdan hallar
 *  TOXUNULMUR — onları çağıran kod öz mesajı ilə idarə edir. */
async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    // fetch yalnız şəbəkə səviyyəsində rejection atır — bu həmişə TypeError-dır.
    if (e instanceof TypeError) throw new Error(connectionErrorMessage());
    throw e;
  }
}

async function get<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    // Merge rather than let `...opts` clobber this — callers pass `next.tags`
    // to enable on-demand revalidation without losing the time-based fallback.
    next: { revalidate: 30, ...(opts?.next ?? {}) },
    credentials: "include",
    headers: { ...localeHeaders(), ...(opts?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

/** Ping our own Next.js server to bust the ISR cache for blog content.
 *  Mutations happen via direct fetches to the Spring backend from the browser,
 *  so Next has no idea the underlying data changed — without this, the public
 *  site keeps serving the stale cached page until the revalidate window (or a
 *  lucky refresh) catches up. Fire-and-forget: a failed revalidation ping
 *  shouldn't block the save flow, it'll just self-heal after 30s. */
function revalidateBlogCache(slug?: string | null) {
  if (typeof window === "undefined") return;
  const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  fetch(`/api/revalidate-blog${qs}`, { method: "POST" }).catch(() => {});
}

/** Same idea as revalidateBlogCache, for the public psychologist directory —
 *  photo/profile edits (self-service or admin) otherwise stay stale on
 *  /psychologists/[slug] until the fetch's 30s revalidate window (or a lucky
 *  refresh) catches up. Fire-and-forget: safe to skip on failure, it self-heals. */
export function revalidatePsychologistsCache() {
  if (typeof window === "undefined") return;
  fetch("/api/revalidate-psychologists", { method: "POST" }).catch(() => {});
}

// Tokens live in HTTP-only cookies. JS can't read or write them — backend handles
// set/clear on login, refresh, and logout. We just send credentials: "include"
// and the browser does the work.

// "ok"         — refreshed successfully
// "auth_failure" — refresh token invalid/expired → must log out
// "network_error" — server unreachable, transient → do NOT log out
export type RefreshOutcome = "ok" | "auth_failure" | "network_error";

export function clearSession() {
  clearUser();
  if (typeof window === "undefined") return;
  // Notify module-level caches (favourites, etc.) to drop user-scoped state.
  try { window.dispatchEvent(new Event("fanus:session-cleared")); } catch { /* ignore */ }
}

/** Called when an authenticated request fails after a refresh attempt — that
 *  always means the session genuinely expired (we had one to refresh). */
export function redirectToLogin() {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  clearSession();
  const params = new URLSearchParams({ session: "expired" });
  if (next && next !== "/" && !next.startsWith("/login")) params.set("next", next);
  window.location.href = `${getMainSiteUrl()}/login?${params.toString()}`;
}

async function _doRefresh(): Promise<RefreshOutcome> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // refresh token rides in the HTTP-only cookie
    });

    if (res.status === 401 || res.status === 403) return "auth_failure";
    if (!res.ok) return "network_error";

    // Backend rotates cookies as part of the response. Body still carries the
    // user record so we can keep the localStorage UI cache fresh.
    const data = await res.json().catch(() => ({}));
    if (data && data.userId) {
      storeUser({
        userId: data.userId,
        email: data.email,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
      });
    }
    return "ok";
  } catch {
    return "network_error";
  }
}

// In-tab singleton — first line of defence against parallel refresh in the same tab.
let _refreshPromise: Promise<RefreshOutcome> | null = null;

// Cross-tab mutex via the Web Locks API. Only one tab refreshes at a time;
// other tabs wait. Falls back to the in-tab singleton on browsers without locks.
type LockManager = {
  request: <T>(name: string, cb: () => Promise<T>) => Promise<T>;
};
function getLockManager(): LockManager | null {
  if (typeof navigator === "undefined") return null;
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  return locks ?? null;
}

async function _refreshWithCrossTabLock(): Promise<RefreshOutcome> {
  const locks = getLockManager();
  if (!locks) return _doRefresh();
  return locks.request("fanus-refresh-token", () => _doRefresh());
}

export async function tryRefresh(): Promise<RefreshOutcome> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _refreshWithCrossTabLock().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

function buildHeaders(isJson = true) {
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...localeHeaders(),
  };
}

/** Error that keeps the HTTP status so callers can branch (e.g. 409 = slot
 *  conflict → refresh the slot list). Still an Error — existing
 *  `(e as Error).message` call sites keep working unchanged. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True when the failure is the GAP-02 double-booking guard (HTTP 409). */
export function isSlotConflict(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409;
}

async function authedRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      const retry = await fetch(`${BASE}${path}`, {
        method,
        credentials: "include",
        headers: buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new ApiError((err as { error?: string }).error ?? `API error ${retry.status}`, retry.status);
      }
      if (retry.status === 204) return undefined as T;
      return retry.json();
    }
    if (outcome === "auth_failure") {
      redirectToLogin();
    }
    // network_error: don't logout, let caller handle
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError((err as { error?: string }).error ?? `API error ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function authedBlobRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      const retry = await fetch(`${BASE}${path}`, {
        method,
        credentials: "include",
        headers: buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) throw new Error(`API error ${retry.status}`);
      return retry.blob();
    }
    if (outcome === "auth_failure") redirectToLogin();
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.blob();
}

async function authedMultipartRequest<T>(
  method: string,
  path: string,
  form: FormData
): Promise<T> {
  const makeReq = () => fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    // Don't set Content-Type — the browser adds the multipart boundary itself.
    body: form,
  });

  const res = await makeReq();

  if (res.status === 401) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      const retry = await makeReq();
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `API error ${retry.status}`);
      }
      return retry.json();
    }
    if (outcome === "auth_failure") redirectToLogin();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `API error ${res.status}`);
  }

  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Psychologist {
  id: number; name: string; title: string; specializations: string[];
  experience: string; sessionsCount: string; rating: string;
  photoUrl?: string; bio?: string; phone?: string; email?: string;
  languages?: string; sessionTypes?: string;
  university?: string; degree?: string; graduationYear?: string;
  accentColor: string; bgColor: string;
  displayOrder: number; active: boolean;
  defaultSessionMinutes?: number;
  userId?: number | null;
  /** Computed client-side from name + collision suffix; safe to use in URLs. */
  slug?: string;
  // Modul A/C — Fanus/Adi tipi. Qiymət yalnız Operator/Admin/psixoloqun özü görür —
  // public/pasiyent cavabında bu sahələr backend tərəfindən null/omit edilir.
  psychologistType?: "FANUS" | "NORMAL";
  individualPrice?: number | null;
  currency?: string | null;
  packages?: PackageSummary[];
  // Modul D — statistika mənbəyi + sıralama göstəriciləri
  statsSource?: "FANUS_PLATFORM" | "PRIOR_EXPERIENCE";
  fanusSessionCount?: number;
  priorExperienceSessions?: number;
  displayedSessionCount?: number;
}

// Modul A — public/pasiyent kartda göstərilən paket xülasəsi. Qiymət sahələri
// yalnız Operator/Admin/psixoloqun özü üçün doldurulur; public/pasiyent üçün null.
export interface PackageSummary {
  id: number;
  name: string;
  sessionCount: number;
  packagePrice: number | null;
  perSessionPrice: number | null;
}

// Modul A — psixoloq/admin idarəetməsində tam paket
export interface PackageDto {
  id: number;
  name: string;
  sessionCount: number;
  packagePrice: number;
  perSessionPrice: number;
  currency: string;
  active: boolean;
  displayOrder: number;
  setBy: string;
}

/** "Paketlərim" — paketi alan pasiyentin gedişatı. */
export interface PackagePatient {
  patientName: string;
  completed: number;
  total: number;
  status: string; // ACTIVE | EXHAUSTED | EXPIRED | CANCELLED
}

/** "Paketlərim" — hər kataloq paketi üzrə satış/istifadə statistikası. */
export interface PackageStats {
  packageId: number;
  sold: number;
  active: number;
  completed: number;
  cancelled: number;
  expired: number;
  revenue: number;
  completionPct: number;
  patients: PackagePatient[];
}
export type PackageReq = {
  name: string;
  sessionCount: number;
  packagePrice: number;
  displayOrder?: number;
  active?: boolean;
};
export interface PriceChangeLogItem {
  id: number;
  target: "INDIVIDUAL" | "PACKAGE";
  packageId?: number | null;
  oldPrice?: number | null;
  newPrice: number;
  currency: string;
  changedByRole: "ADMIN" | "OPERATOR" | "PSYCHOLOGIST";
  reason?: string | null;
  createdAt: string;
}
export interface Stat { id: number; statValue: number; suffix: string; label: string; subLabel: string; displayOrder: number; }
export interface Announcement { id: number; category: string; categoryColor: string; categoryBg: string; title: string; excerpt: string; publishedDate: string; iconType: string; active: boolean; }
export interface ArticleAttachment {
  id: number;
  fileUrl: string;
  fileName: string;
  fileType: string; // IMAGE, VIDEO, DOCUMENT
  fileSizeBytes: number;
  displayOrder: number;
}

export interface BlogCategory {
  id: number;
  name: string;
  color: string;
  bg: string;
  emoji: string;
  active: boolean;
  sortOrder: number;
}

export interface BlogPost {
  id: number;
  category: string;
  categoryColor: string;
  categoryBg: string;
  title: string;
  excerpt: string;
  content?: string;
  coverImageUrl?: string;
  readTimeMinutes: number;
  publishedDate: string;
  emoji: string;
  slug: string;
  featured: boolean;
  active: boolean;
  status: string; // DRAFT | PUBLISHED
  authorId?: number;
  authorName?: string;
  createdAt?: string;
  updatedAt?: string;
  attachments?: ArticleAttachment[];
  // Draft shadow fields (published articles only)
  draftTitle?: string;
  draftContent?: string;
  draftCoverImageUrl?: string;
  draftExcerpt?: string;
  hasPendingDraft?: boolean;
}
export interface Faq { id: number; question: string; answer: string; displayOrder: number; active: boolean; }
export interface Testimonial { id: number; quote: string; authorName: string; authorRole: string; initials: string; gradient: string; rating: number; active: boolean; }
export interface SiteConfig { [key: string]: string; }
export interface Appointment { id: number; patientName: string; phone: string; psychologistName?: string; note?: string; preferredDate?: string; status: string; createdAt: string; }

export interface ContactMessagePayload {
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  message: string;
  status: "NEW" | "IN_REVIEW" | "RESOLVED" | "SPAM";
  ticketCode?: string | null;
  adminNote?: string | null;
  sourceIp?: string | null;
  userId?: number | null;
  userEmail?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  resolvedByUserId?: number | null;
}

export interface AppointmentDetail {
  id: number;
  status: string;
  patientId?: number | null;
  patientName?: string | null;
  patientEmail?: string | null;
  patientPhone?: string | null;
  psychologistId?: number | null;
  psychologistName?: string | null;
  requestedPsychologistId?: number | null;
  requestedPsychologistName?: string | null;
  requestedStartAt?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  note?: string | null;
  operatorNote?: string | null;
  assignedByOperatorId?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  // Mutual session confirmation
  patientConfirmedAt?: string | null;
  psychologistConfirmedAt?: string | null;
  patientDisputed?: boolean;
  psychologistDisputed?: boolean;
  disputeReason?: string | null;
  disputeResolvedAt?: string | null;
  autoConfirmedAt?: string | null;
  // Cancellation detail
  cancelReasonCode?: string | null;
  cancelReasonText?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  lateCancel?: boolean;
  cancelWindowHours?: number | null;
  // Reschedule chain
  rescheduleChainId?: string | null;
  rescheduleIndex?: number;
  // Recurring series
  seriesId?: number | null;
  seriesIndex?: number | null;
  seriesTotal?: number | null;
  // Cancel request (patient → operator approval)
  cancelRequestedAt?: string | null;
  cancelRequestReasonCode?: string | null;
  cancelRequestReasonText?: string | null;
  statusBeforeCancelRequest?: string | null;
  // Reschedule request (patient → operator; operator reschedules, no status change)
  rescheduleRequestedAt?: string | null;
  rescheduleRequestNote?: string | null;
  // Operator follow-up trail (populated only on operator endpoints)
  lastContactAt?: string | null;
  lastContactChannel?: "CALL" | "SMS" | "EMAIL" | "WHATSAPP" | "OTHER" | null;
  lastContactOutcome?: "ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER" | null;
  // GAP-01: stamped by the SLA job once the request crosses the threshold
  slaNotifiedAt?: string | null;
  // OP-2: soft-lock claim (null unless an ALIVE claim exists; staleness is
  // resolved server-side against app.operator.claim-ttl-minutes)
  claimedByUserId?: number | null;
  claimedByName?: string | null;
  claimedAt?: string | null;
  // Modul B: operator tərəfindən təyin edilən seans görüş linki
  meetingLink?: string | null;
  meetingLinkSetAt?: string | null;
  meetingLinkSentAt?: string | null;
  // Modul A — paket bağlantısı
  patientPackageId?: number | null;
  bookingType?: string;
  // Paket meta (yalnız patientPackageId varsa backend doldurur)
  packageName?: string | null;
  packageTotal?: number | null;
  packageRemaining?: number | null;
  packageStatus?: string | null;
  // Ödəniş statusu (yalnız tək seans ödənişi; paket seanslarında null)
  // null = ödəniş qeydi yoxdur; "PENDING" = operator hələ təsdiqləməyib; "PAID" = təsdiqlənib
  paymentStatus?: string | null;
  // Ödəniş məbləği (tək seans). 0 = qəbul olunub, lakin operator hələ məbləği təyin etməyib.
  paymentAmount?: number | null;
  // Rezervasiya mənbəyi ('DIRECT' | 'PLATFORM_MATCHED') — komissiya fərqləndirməsi.
  origin?: string | null;
  // Seans növü: 'STANDARD' | 'INTRO' (15 dəq, pulsuz tanışlıq görüşü).
  sessionKind?: string | null;
}

// Modul B: operator panelində link tarixçəsinin bir sətri
export interface MeetingLinkLogItem {
  action: "SET" | "UPDATED" | "REVOKED" | "SENT";
  meetingLink?: string | null;
  actorName?: string | null;
  createdAt: string;
}

// ─── Structured cancellation reasons ────────────────────────────────────
export type CancellationRole = "PATIENT" | "PSYCHOLOGIST" | "OPERATOR";

export interface CancellationReasonOption {
  code: string;
  label: string;
  role: CancellationRole;
}

export const CANCEL_REASONS: CancellationReasonOption[] = [
  { code: "PATIENT_BUSY",          label: "Məşğul oldum",            role: "PATIENT" },
  { code: "PATIENT_HEALTH",        label: "Xəstələndim",             role: "PATIENT" },
  { code: "PATIENT_FORGOT",        label: "Unutdum",                 role: "PATIENT" },
  { code: "PATIENT_NOT_NEEDED",    label: "Lazım deyil artıq",       role: "PATIENT" },
  { code: "PATIENT_TECHNICAL",     label: "Texniki problem",         role: "PATIENT" },
  { code: "PATIENT_TIME_CONFLICT", label: "Vaxt uyğun deyil",        role: "PATIENT" },
  { code: "PATIENT_OTHER",         label: "Digər",                   role: "PATIENT" },

  { code: "PSY_HEALTH",            label: "Xəstələndim",             role: "PSYCHOLOGIST" },
  { code: "PSY_EMERGENCY",         label: "Təcili məsələ",           role: "PSYCHOLOGIST" },
  { code: "PSY_TECHNICAL",         label: "Texniki problem",         role: "PSYCHOLOGIST" },
  { code: "PSY_INCOMPATIBLE",      label: "Profil uyğun deyil",      role: "PSYCHOLOGIST" },
  { code: "PSY_OTHER",             label: "Digər",                   role: "PSYCHOLOGIST" },

  { code: "OPERATOR_PATIENT_REQUEST",    label: "Pasient telefonla bildirdi", role: "OPERATOR" },
  { code: "OPERATOR_PSY_UNAVAILABLE",    label: "Psixoloq mövcud deyil",       role: "OPERATOR" },
  { code: "OPERATOR_DISPUTE_RESOLUTION", label: "Mübahisə həlli",              role: "OPERATOR" },
  { code: "OPERATOR_NO_SHOW_BOTH",       label: "İkisi də gəlmədi",            role: "OPERATOR" },
  { code: "OPERATOR_PATIENT_BLOCKED",    label: "Pasient bloklandı",           role: "OPERATOR" },
  { code: "OPERATOR_OTHER",              label: "Digər",                       role: "OPERATOR" },
];

export function reasonsForRole(role: CancellationRole): CancellationReasonOption[] {
  return CANCEL_REASONS.filter(r => r.role === role);
}

const REASON_LABEL_BY_CODE: Record<string, string> =
  Object.fromEntries(CANCEL_REASONS.map(r => [r.code, r.label]));

/** Ləğv səbəb kodunu oxunaqlı etiketə çevirir (tapılmasa kodun özünü qaytarır). */
export function reasonLabel(code?: string | null): string {
  if (!code) return "";
  return REASON_LABEL_BY_CODE[code] ?? code;
}

export interface TimeSlot {
  id: number;
  psychologistId: number;
  dayOfWeek: number; // 1=Mon..7=Sun (ISO)
  startTime: string; // "HH:mm:ss"
  endTime: string;
  active: boolean;
}

export interface TimeSlotOverride {
  id: number;
  psychologistId: number;
  overrideDate: string; // "YYYY-MM-DD"
  overrideType: "BLOCK" | "EXTRA";
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
}

export interface AvailableSlot {
  startAt: string; // ISO
  endAt: string;
}
export interface UserRecord {
  id: number; email: string; role: string;
  firstName?: string; lastName?: string; phone?: string;
  emailVerified: boolean; inPsychologistList: boolean; active: boolean;
  lastLogin?: string; createdAt: string;
}

export interface PsychologistApplication {
  id: number;
  firstName: string; lastName: string; email: string; phone?: string;
  birthDate?: string;             // YYYY-MM-DD
  gender?: "FEMALE" | "MALE" | "OTHER";
  finId?: string;
  title?: string;
  university?: string; degree?: string; graduationYear?: string;
  specializations?: string; sessionTypes?: string; experienceYears?: string;
  bio?: string; motivation?: string;
  certifications?: string; languages?: string;
  diplomaFileUrl?: string; certificateFileUrls?: string;
  educationsJson?: string;        // JSON array string
  certificatesJson?: string;      // JSON array string
  consentEthics?: boolean; consentGdpr?: boolean; consentTerms?: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote?: string; createdAt: string; reviewedAt?: string;
  photoUrl?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const getPsychologists = async (): Promise<Psychologist[]> => {
  const list = await get<Psychologist[]>("/psychologists", { next: { revalidate: 30, tags: ["psychologists"] } });
  return withSlugs(list);
};
export const getStats = () => get<Stat[]>("/stats");
export const getAnnouncements = () => get<Announcement[]>("/announcements");
export const getBlogPosts = () => get<BlogPost[]>("/blog-posts", { next: { tags: ["blog-posts"] } });
export const getBlogPostBySlug = (slug: string) =>
  get<BlogPost>(`/blog-posts/${slug}`, { next: { tags: ["blog-posts", `blog-post-${slug}`] } });
export const getFaqs = () => get<Faq[]>("/faqs");
export const getTestimonials = () => get<Testimonial[]>("/testimonials");
export const getSiteConfig = () => get<SiteConfig>("/site-config");

export const getPsychologistAvailability = (
  id: number, from?: string, to?: string, sessionKind?: "STANDARD" | "INTRO",
) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (sessionKind === "INTRO") params.set("sessionKind", sessionKind);
  const qs = params.toString();
  return get<AvailableSlot[]>(`/psychologists/${id}/availability${qs ? "?" + qs : ""}`);
};

// ─── Public reviews ──────────────────────────────────────────────────────────
export interface PublicReview {
  id: number;
  rating: number;
  comment: string;
  authorDisplayName: string;
  authorInitials: string;
  createdAt: string;
  reply?: string | null;
  replyAt?: string | null;
}

export interface ReviewSummary {
  total: number;
  average: number;
  distribution: Record<string, number>;
}

export const getPsychologistReviews = (id: number) =>
  get<PublicReview[]>(`/psychologists/${id}/reviews`);
export const getPsychologistReviewSummary = (id: number) =>
  get<ReviewSummary>(`/psychologists/${id}/reviews/summary`);

export const bookAppointment = (data: {
  patientName: string; phone: string; psychologistName?: string; note?: string; preferredDate?: string;
}) => fetch(`${BASE}/appointments`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
}).then(r => r.json());

/** FAZA B1-2 "Təkrarla": probe whether a slot repeats freely across the next
 *  N weeks. Public — same visibility as the availability endpoint. */
export const repeatCheck = async (data: {
  psychologistId: number;
  slot: string;
  weeks: number;
  step: 7 | 14;
}): Promise<RepeatCheckEntry[]> => {
  const res = await fetch(`${BASE}/public/booking/repeat-check`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new ApiError((e as { error?: string }).error ?? `API error ${res.status}`, res.status);
  }
  return res.json();
};

export const submitContactMessage = async (data: ContactMessagePayload): Promise<ContactMessage> => {
  const res = await fetch(`${BASE}/contact`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const msg = (e as { message?: string; error?: string }).message ?? (e as { error?: string }).error;
    throw new Error(msg ?? `Mesaj göndərilmədi (${res.status})`);
  }
  return res.json();
};

// ─── Funnel tracking (GAP-08) ─────────────────────────────────────────────────
export type FunnelEventType = "MOOD_SELECTED" | "MOOD_BOOKING_CLICK" | "MOOD_MATCH_CLICK";

/** Fire-and-forget conversion counter — must never break the UX it measures. */
export function trackFunnelEvent(eventType: FunnelEventType, mood?: string): void {
  try {
    void fetch(`${BASE}/public/funnel-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, mood }),
      keepalive: true, // survives the page navigation that usually follows
    }).catch(() => {});
  } catch { /* ignore */ }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Backend sets accessToken + refreshToken as HTTP-only cookies (Domain=.fanus.com).
// We just keep the lightweight user record locally for immediate UI rendering.
export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { error?: string }).error ?? "Login uğursuz oldu");
  }
  const data = await res.json();
  storeUser({
    userId: data.userId,
    email: data.email,
    role: data.role,
    firstName: data.firstName,
    lastName: data.lastName,
  });
  return data;
};

export const logout = async () => {
  try {
    // Backend clears HTTP-only cookies and revokes refresh token server-side.
    await fetch(`${BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  } catch { /* ignore */ }
  clearSession();
};

// ─── Patient Auth ──────────────────────────────────────────────────────────────
export const checkEmail = (email: string): Promise<{ taken: boolean }> =>
  fetch(`${BASE}/auth/check-email?email=${encodeURIComponent(email)}`)
    .then(r => r.json());

export const registerPatient = (data: {
  email: string; password: string; firstName: string; lastName: string; phone?: string;
  // Modul G — opsional təcili əlaqə + yaşayış ünvanı
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  residentialAddress?: string;
}) => fetch(`${BASE}/auth/register/patient`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", ...localeHeaders() },
  body: JSON.stringify(data),
}).then(async r => {
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? "Qeydiyyat uğursuz oldu");
  return body;
});

export interface PsychologistRegistrationData {
  // Personal
  email: string; password: string;
  firstName: string; lastName: string;
  phone: string;
  birthDate?: string;            // ISO YYYY-MM-DD
  gender?: "FEMALE" | "MALE" | "OTHER";
  finId?: string;
  // Professional
  title: string;
  experienceYears: string;
  // Modul D — platformadan əvvəlki ümumi seans sayı (off-platform)
  priorSessions?: number;
  languages: string[];
  specializations: string[];
  sessionTypes: string[];
  // Multi rows (will be JSON-stringified)
  educations: { institution: string; degree?: string; graduationYear?: string }[];
  certificates: { title: string; issuer?: string; year?: string; type: "CERTIFICATE" | "SEMINAR" }[];
  // Bio
  bio: string;
  motivation?: string;
  // Consents (must all be true)
  consentEthics: boolean;
  consentGdpr: boolean;
  consentTerms: boolean;
}

export const registerPsychologist = (
  data: PsychologistRegistrationData,
  diplomaFile?: File | null,
  certificateFiles?: File[],
  photoFile?: File | null
) => {
  const form = new FormData();
  form.append("email", data.email);
  form.append("password", data.password);
  form.append("firstName", data.firstName);
  form.append("lastName", data.lastName);
  form.append("phone", data.phone);
  if (data.birthDate) form.append("birthDate", data.birthDate);
  if (data.gender) form.append("gender", data.gender);
  if (data.finId) form.append("finId", data.finId);
  if (data.title) form.append("title", data.title);
  if (data.experienceYears) form.append("experienceYears", data.experienceYears);
  if (data.priorSessions != null) form.append("priorExperienceSessions", String(data.priorSessions));
  data.languages.forEach(l => form.append("languages", l));
  data.specializations.forEach(s => form.append("specializations", s));
  data.sessionTypes.forEach(s => form.append("sessionTypes", s));
  form.append("educationsJson", JSON.stringify(data.educations));
  form.append("certificatesJson", JSON.stringify(data.certificates));
  if (data.bio) form.append("bio", data.bio);
  if (data.motivation) form.append("motivation", data.motivation);
  form.append("consentEthics", String(data.consentEthics));
  form.append("consentGdpr", String(data.consentGdpr));
  form.append("consentTerms", String(data.consentTerms));
  if (diplomaFile) form.append("diplomaFile", diplomaFile);
  certificateFiles?.forEach(f => form.append("certificateFiles", f));
  if (photoFile) form.append("photoFile", photoFile);

  return fetch(`${BASE}/auth/register/psychologist`, {
    method: "POST",
    credentials: "include",
    headers: localeHeaders(),
    body: form,
  }).then(async r => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Qeydiyyat uğursuz oldu");
    return body;
  });
};

export const verifyEmail = (token: string) =>
  fetch(`${BASE}/auth/verify?token=${token}`, { credentials: "include" })
    .then(async r => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Təsdiq uğursuz oldu");
      return body;
    });

// Hesab sahiblənmə (operator-yaradılan pasiyent) — nömrəli OTP
export const requestClaimOtp = (email: string) =>
  fetch(`${BASE}/auth/claim/request-otp`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify({ email }),
  }).then(async r => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Kod göndərilmədi");
    return body;
  });

export const verifyClaimOtp = (data: {
  email: string; code: string; password: string;
  firstName?: string; lastName?: string; phone?: string;
}) => fetch(`${BASE}/auth/claim/verify-otp`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", ...localeHeaders() },
  body: JSON.stringify(data),
}).then(async r => {
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? "Aktivləşdirmə uğursuz oldu");
  return body;
});

export const forgotPassword = (email: string) =>
  fetch(`${BASE}/auth/forgot-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).then(r => r.json());

export const resetPassword = (token: string, newPassword: string) =>
  fetch(`${BASE}/auth/reset-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  }).then(async r => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Şifrə sıfırlama uğursuz oldu");
    return body;
  });

// ─── Dashboard metrics ────────────────────────────────────────────────────────
export interface StatBlock { value: number; secondary: number | null; deltaPercent: number | null; label: string; }
export interface DailyFlow { date: string; confirmed: number; pending: number; cancelled: number; }
export interface ActivityEntry { type: string; tone: string; title: string; meta: string; at: string | null; }
export interface TopArticle { rank: number; title: string; author: string; category: string; views: number; deltaPct: number | null; }
export interface TopicSlice { label: string; percent: number; color: string; }
export interface DashboardMetrics {
  totalUsers: StatBlock;
  activePsychologists: StatBlock;
  pendingAppointments: StatBlock;
  newMessages: StatBlock;
  articleReads: StatBlock;
  appointmentFlow: DailyFlow[];
  recentActivity: ActivityEntry[];
  topArticles: TopArticle[];
  topicDistribution: TopicSlice[];
  systemStatus: Record<string, string>;
}

// ─── Reports types ────────────────────────────────────────────────────────────
export interface HeadlineMetric { value: number; unit: string; deltaAbs: number; deltaUnit: string; label: string; }
export interface FunnelStep { label: string; count: number; pctOfTotal: number; color: string; }
export interface TrafficSource { label: string; percent: number; color: string; }
export interface TopConvertingArticle { title: string; views: number; requests: number; conversionRate: number; }
export interface PsychologistPerformance { initials: string; avatarColor: string; name: string; sessions: number; completionPct: number; rating: number; }
export interface ReportsData {
  conversion: HeadlineMetric;
  completion: HeadlineMetric;
  averageRating: HeadlineMetric;
  activeUsers: HeadlineMetric;
  funnel: FunnelStep[];
  trafficSources: TrafficSource[];
  hourlyHeatmap: number[][];
  topConverting: TopConvertingArticle[];
  performance: PsychologistPerformance[];
}

export interface PagedUsersResponse {
  content: UserRecord[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  roleCounts: Record<string, number>;
}

export interface AuditLogEntry {
  id: number;
  actorUserId: number | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  summary: string | null;
  metadata: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PagedAuditLogs {
  content: AuditLogEntry[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

// ─── ADMIN MODUL 1: komanda mərkəzi ──────────────────────────────────────────
export interface CommandCenterQueue {
  count: number;
  oldestAt: string | null;
}
export interface CommandCenterDisputed extends CommandCenterQueue {
  escalatedCount: number;
}
export interface CommandCenter {
  asOf: string;
  applications: CommandCenterQueue;
  reviews: CommandCenterQueue;
  cancelRequests: CommandCenterQueue;
  cancelRequestAppointments: number;
  cancelRequestSeries: number;
  disputed: CommandCenterDisputed;
  slaOverdue: CommandCenterQueue;
  slaHours: number;
  crisis: CommandCenterQueue;
  contactMessages: CommandCenterQueue;
  deletionRequests: CommandCenterQueue;
  emailFailures: CommandCenterQueue;
}

// ─── ADMIN MODUL 2: randevu idarəetməsi ──────────────────────────────────────
export interface AdminAppointmentRow {
  detail: AppointmentDetail;
  assignedByOperatorName: string | null;
  patientFlag: string | null; // HIGH_NO_SHOW | HIGH_LATE_CANCEL | HIGH_REJECT
}

/** B4-2.1: 409 zamanı tutan randevunun zənginləşdirilmiş görünüşü (yalnız admin). */
export interface ConflictInfo {
  appointmentId: number;
  status: string;
  patientName: string | null;
  patientPhone: string | null;
  startAt: string | null;
  endAt: string | null;
  seriesId: number | null;
  seriesIndex: number | null;
  seriesTotal: number | null;
  rescheduleCount: number;
  hasPendingProposal: boolean;
}

export interface BulkCancelResult {
  cancelled: number[];
  failed: Record<string, string>;
}

// ─── ADMIN MODUL 3: istifadəçi kartları, GDPR, operator idarəetməsi ──────────
export interface AdminTag {
  id: number;
  label: string;
  color: string;
  psychologistName: string | null;
  createdAt: string;
}
export interface AdminNotificationEntry {
  id: number;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface ClinicalGrant {
  id: number;
  adminEmail: string | null;
  reason: string;
  grantedAt: string;
  expiresAt: string;
}
export interface ClinicalNote {
  id: number;
  psychologistName: string | null;
  appointmentId: number | null;
  title: string | null;
  body: string | null;
  moodScore: number | null;
  createdAt: string;
}
export interface HomeworkAnswer {
  id: number;
  psychologistName: string | null;
  title: string;
  status: string;
  completedAt: string | null;
  completionNote: string | null;
  createdAt: string;
}
export interface CheckInEntry {
  id: number;
  moodScore: number;
  note: string | null;
  createdAt: string;
}
export interface ClinicalData {
  sessionNotes: ClinicalNote[];
  homework: HomeworkAnswer[];
  checkIns: CheckInEntry[];
  /** Jurnal backend-də saxlanmır — UI bunu açıq deyir. */
  journalAvailable: boolean;
}
export interface PatientCard {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  active: boolean;
  blocked: boolean;
  blockReason: string | null;
  emailVerified: boolean;
  lastLogin: string | null;
  createdAt: string;
  patientId: number | null;
  noShowCount: number;
  lateCancelCount: number;
  rejectCount: number;
  autoFlag: string | null;
  autoFlagSetAt: string | null;
  riskLevel: string | null;
  tags: AdminTag[];
  deletionRequestedAt: string | null;
  appointments: AppointmentDetail[];
  series: BookingSeries[];
  notifications: AdminNotificationEntry[];
  clinicalAccess: ClinicalGrant | null;
  // Modul G — təcili əlaqə + yaşayış ünvanı (decrypt olunmuş, yalnız admin)
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  residentialAddress?: string | null;
}
export interface DeletionRequest {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  blocked: boolean;
  requestedAt: string;
  daysLeft: number;
}
export interface PsyPerformance {
  monthSessionsCompleted: number;
  monthSessionsTotal: number;
  received30: number;
  rejected30: number;
  rejectionRatePct: number | null;
  avgConfirmMinutes: number | null;
  rating: number | null;
  reviewCount: number;
  activeSeriesCount: number;
  next7Booked: number;
  next7FreeSlots: number;
  next7FullnessPct: number | null;
}
export interface PsychologistCard {
  psychologistId: number;
  userId: number | null;
  name: string;
  active: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  performance: PsyPerformance;
  vacations: Vacation[];
}
export interface OperatorOverview {
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
  assignedToday: number;
  assignedWeek: number;
  assigned30: number;
  avgResponseMinutes: number | null;
  slaViolations30: number;
}

// ─── Modul E: material kitabxanası ───────────────────────────────────────────
export interface MaterialCategory { id: number; name: string; slug: string; color?: string | null; bg?: string | null; active: boolean; sortOrder: number }
export interface Material { id: number; title: string; description?: string | null; categoryId: number; categoryName?: string | null; categorySlug?: string | null; active: boolean; sortOrder: number; versionCount: number; latestVersionId?: number | null; latestVersionNo?: number | null; latestFileUrl?: string | null; latestFileName?: string | null; latestFileType?: string | null; latestFileSize?: number | null; createdAt: string; updatedAt?: string | null }
export interface MaterialVersion { id: number; versionNo: number; fileUrl: string; fileName: string; fileType: string; contentType?: string | null; fileSize?: number | null; uploadedById?: number | null; uploadedByName?: string | null; createdAt: string }
export type MaterialCategoryReq = { name: string; slug: string; color?: string; bg?: string; active: boolean; sortOrder: number }
export type MaterialReq = { title: string; description?: string; categoryId: number; active: boolean; sortOrder: number }

// ─── Modul F: psixoloji testlər ──────────────────────────────────────────────
export interface PsyTestSummary { id: number; title: string; published: boolean; questionCount: number; scaleCount: number; shareStatus: string; mine: boolean }
export interface PsyTestOption { id: number; label: string; points: number; displayOrder: number }
export interface PsyTestQuestion { id: number; text: string; displayOrder: number; options: PsyTestOption[] }
export interface PsyTestScale { id: number; label: string; minScore: number; maxScore: number; color?: string | null; description?: string | null; displayOrder: number }
export interface PsyTest { id: number; title: string; description?: string | null; instructions?: string | null; scoreBasis: string; published: boolean; questionCount: number; questions: PsyTestQuestion[]; scales: PsyTestScale[] }
export type PsyOptionReq = { label: string; points: number; displayOrder: number }
export type PsyQuestionReq = { text: string; displayOrder: number; options: PsyOptionReq[] }
export type PsyScaleReq = { label: string; minScore: number; maxScore: number; color?: string; description?: string; displayOrder: number }
export type PsyTestReq = { title: string; description?: string; instructions?: string; scoreBasis: string; published: boolean; questions: PsyQuestionReq[]; scales: PsyScaleReq[] }
export interface TakeOption { id: number; label: string }
export interface TakeQuestion { id: number; text: string; options: TakeOption[] }
export interface TakeTest { testId: number; assignmentId?: number | null; title: string; description?: string | null; instructions?: string | null; questions: TakeQuestion[]; note?: string | null }
export type SubmitAnswer = { questionId: number; selectedOptionId: number }
export interface AnswerResult { questionId: number; questionText: string; selectedOptionId: number; selectedLabel: string; pointsAwarded: number; displayOrder: number }
export interface TestResult { resultId: number; assignmentId: number; totalScore: number; maxScore: number; percentage: number; scaleId?: number | null; scaleLabel?: string | null; respondentName?: string | null; submittedAt: string; answers: AnswerResult[] }
export interface TestAssignment { id: number; testId: number; testTitle: string; patientId?: number | null; patientName?: string | null; status: string; publicToken?: string | null; assignedAt: string; completedAt?: string | null; hasResult: boolean; submissionCount: number; note?: string | null }

// Psixoloq müraciət statusu — public (auth YOXDUR): e-poçtdakı token ilə baxılır.
export interface ApplicationStatusResult {
  status: "PENDING" | "APPROVED" | "REJECTED";
  firstName?: string | null;
  adminNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}
export const getApplicationStatus = (token: string) =>
  get<ApplicationStatusResult>(
    `/public/application-status?token=${encodeURIComponent(token)}`,
    { next: { revalidate: 0 } },
  );

// Modul F — public (auth YOXDUR): token vasitəsilə test götürmə + cavab göndərmə
export const getPublicTest = (token: string) => get<TakeTest>(`/public/psych-tests/${token}`);
export const submitPublicTest = (token: string, data: { answers: SubmitAnswer[]; respondentName?: string }) =>
  fetch(`${BASE}/public/psych-tests/${token}/submit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify(data),
  }).then(async r => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Test göndərilmədi");
    return body as TestResult;
  });

export const adminApi = {
  getDashboard: () => authedRequest<Record<string, number>>("GET", "/admin/dashboard"),

  // Audit log
  getAuditLogs: (params: {
    action?: string; actorId?: number; targetType?: string; targetId?: number;
    since?: string; page?: number; size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.action)     q.set("action", params.action);
    if (params.actorId)    q.set("actorId", String(params.actorId));
    if (params.targetType) q.set("targetType", params.targetType);
    if (params.targetId)   q.set("targetId", String(params.targetId));
    if (params.since)      q.set("since", params.since);
    if (params.page  !== undefined) q.set("page", String(params.page));
    if (params.size  !== undefined) q.set("size", String(params.size));
    const qs = q.toString();
    return authedRequest<PagedAuditLogs>("GET", `/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
  getDashboardMetrics: () => authedRequest<DashboardMetrics>("GET", "/admin/dashboard/metrics"),
  getUsersSummary: () => authedRequest<Record<string, number>>("GET", "/admin/users/summary"),
  getReports: () => authedRequest<ReportsData>("GET", "/admin/reports"),

  // Psychologists
  getPsychologists: () => authedRequest<Psychologist[]>("GET", "/admin/psychologists"),
  createPsychologist: (data: Omit<Psychologist, "id">) =>
    authedRequest<Psychologist>("POST", "/admin/psychologists", data).then(p => { revalidatePsychologistsCache(); return p; }),
  updatePsychologist: (id: number, data: Omit<Psychologist, "id">) =>
    authedRequest<Psychologist>("PUT", `/admin/psychologists/${id}`, data).then(p => { revalidatePsychologistsCache(); return p; }),
  deletePsychologist: (id: number) =>
    authedRequest<void>("DELETE", `/admin/psychologists/${id}`).then(r => { revalidatePsychologistsCache(); return r; }),
  // Modul C — Fanus/Adi tip + Fanus qiymət/paket idarəsi (ayrıca endpointlər;
  // PsychologistRequest pozisional record-a toxunulmur)
  setPsyType: (psyId: number, type: "FANUS" | "NORMAL") =>
    authedRequest<void>("PUT", `/admin/psychologists/${psyId}/type`, { type }),
  setPsyPricing: (psyId: number, individualPrice: number) =>
    authedRequest<{ individualPrice: number | null; currency: string }>("PUT", `/admin/psychologists/${psyId}/pricing`, { individualPrice }),
  getPsyPackages: (psyId: number) => authedRequest<PackageDto[]>("GET", `/admin/psychologists/${psyId}/packages`),
  createPsyPackage: (psyId: number, data: PackageReq) => authedRequest<PackageDto>("POST", `/admin/psychologists/${psyId}/packages`, data),
  updatePsyPackage: (psyId: number, id: number, data: PackageReq) => authedRequest<PackageDto>("PUT", `/admin/psychologists/${psyId}/packages/${id}`, data),
  deletePsyPackage: (psyId: number, id: number) => authedRequest<void>("DELETE", `/admin/psychologists/${psyId}/packages/${id}`),
  getPsyPriceHistory: (psyId: number) => authedRequest<PriceChangeLogItem[]>("GET", `/admin/psychologists/${psyId}/price-history`),

  // Stats
  getStats: () => authedRequest<Stat[]>("GET", "/admin/stats"),
  createStat: (data: Omit<Stat, "id">) => authedRequest<Stat>("POST", "/admin/stats", data),
  updateStat: (id: number, data: Omit<Stat, "id">) => authedRequest<Stat>("PUT", `/admin/stats/${id}`, data),
  deleteStat: (id: number) => authedRequest<void>("DELETE", `/admin/stats/${id}`),

  // Announcements
  getAnnouncements: () => authedRequest<Announcement[]>("GET", "/admin/announcements"),
  createAnnouncement: (data: Omit<Announcement, "id">) => authedRequest<Announcement>("POST", "/admin/announcements", data),
  updateAnnouncement: (id: number, data: Omit<Announcement, "id">) => authedRequest<Announcement>("PUT", `/admin/announcements/${id}`, data),
  deleteAnnouncement: (id: number) => authedRequest<void>("DELETE", `/admin/announcements/${id}`),

  // Blog categories
  getBlogCategories: () => authedRequest<BlogCategory[]>("GET", "/admin/blog-categories"),
  createBlogCategory: (data: Omit<BlogCategory, "id">) => authedRequest<BlogCategory>("POST", "/admin/blog-categories", data),
  updateBlogCategory: (id: number, data: Omit<BlogCategory, "id">) => authedRequest<BlogCategory>("PUT", `/admin/blog-categories/${id}`, data),
  deleteBlogCategory: (id: number) => authedRequest<void>("DELETE", `/admin/blog-categories/${id}`),

  // Blog
  getBlogPosts: () => authedRequest<BlogPost[]>("GET", "/admin/blog-posts"),
  getBlogPostById: (id: number) => authedRequest<BlogPost>("GET", `/admin/blog-posts/${id}`),
  createBlogPost: (data: Omit<BlogPost, "id">) =>
    authedRequest<BlogPost>("POST", "/admin/blog-posts", data).then(p => { revalidateBlogCache(p.slug); return p; }),
  updateBlogPost: (id: number, data: Omit<BlogPost, "id">) =>
    authedRequest<BlogPost>("PUT", `/admin/blog-posts/${id}`, data).then(p => { revalidateBlogCache(p.slug); return p; }),
  deleteBlogPost: (id: number, slug?: string) =>
    authedRequest<void>("DELETE", `/admin/blog-posts/${id}`).then(() => revalidateBlogCache(slug)),
  addAttachment: async (articleId: number, file: File, displayOrder = 0): Promise<ArticleAttachment> => {
    const form = new FormData();
    form.append("file", file);
    form.append("displayOrder", String(displayOrder));
    return authedMultipartRequest<ArticleAttachment>("POST", `/admin/blog-posts/${articleId}/attachments`, form);
  },
  deleteAttachment: (articleId: number, attachmentId: number) =>
    authedRequest<void>("DELETE", `/admin/blog-posts/${articleId}/attachments/${attachmentId}`),

  // FAQs
  getFaqs: () => authedRequest<Faq[]>("GET", "/admin/faqs"),
  createFaq: (data: Omit<Faq, "id">) => authedRequest<Faq>("POST", "/admin/faqs", data),
  updateFaq: (id: number, data: Omit<Faq, "id">) => authedRequest<Faq>("PUT", `/admin/faqs/${id}`, data),
  deleteFaq: (id: number) => authedRequest<void>("DELETE", `/admin/faqs/${id}`),

  // Testimonials
  getTestimonials: () => authedRequest<Testimonial[]>("GET", "/admin/testimonials"),
  createTestimonial: (data: Omit<Testimonial, "id">) => authedRequest<Testimonial>("POST", "/admin/testimonials", data),
  updateTestimonial: (id: number, data: Omit<Testimonial, "id">) => authedRequest<Testimonial>("PUT", `/admin/testimonials/${id}`, data),
  deleteTestimonial: (id: number) => authedRequest<void>("DELETE", `/admin/testimonials/${id}`),

  // Site config
  getSiteConfig: () => authedRequest<SiteConfig>("GET", "/admin/site-config"),
  updateSiteConfig: (data: SiteConfig) => authedRequest<void>("PUT", "/admin/site-config", data),

  // Appointments
  getAppointments: () => authedRequest<Appointment[]>("GET", "/admin/appointments"),
  updateAppointmentStatus: (id: number, status: string) =>
    authedRequest<Appointment>("PUT", `/admin/appointments/${id}/status`, { status }),

  // Psychologist Applications
  getApplications: () => authedRequest<PsychologistApplication[]>("GET", "/admin/applications"),
  approveApplication: (id: number, adminNote?: string) =>
    authedRequest<PsychologistApplication>("PUT", `/admin/applications/${id}/approve`, { adminNote }),
  rejectApplication: (id: number, adminNote?: string) =>
    authedRequest<PsychologistApplication>("PUT", `/admin/applications/${id}/reject`, { adminNote }),

  // Users
  getUsers: (opts?: { role?: string; q?: string; page?: number; size?: number; sort?: string; dir?: string }) => {
    const params = new URLSearchParams();
    if (opts?.role) params.set("role", opts.role);
    if (opts?.q) params.set("q", opts.q);
    if (opts?.page !== undefined) params.set("page", String(opts.page));
    if (opts?.size !== undefined) params.set("size", String(opts.size));
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.dir) params.set("dir", opts.dir);
    const qs = params.toString();
    return authedRequest<PagedUsersResponse>("GET", `/admin/users${qs ? "?" + qs : ""}`);
  },
  exportUsers: (opts?: { role?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (opts?.role) params.set("role", opts.role);
    if (opts?.q) params.set("q", opts.q);
    const qs = params.toString();
    return authedBlobRequest("GET", `/admin/users/export${qs ? "?" + qs : ""}`);
  },
  getUser: (id: number) => authedRequest<UserRecord>("GET", `/admin/users/${id}`),
  updateUser: (id: number, data: { firstName?: string; lastName?: string; phone?: string; role?: string; emailVerified?: boolean; active?: boolean }) =>
    authedRequest<UserRecord>("PUT", `/admin/users/${id}`, data),
  deleteUser: (id: number) => authedRequest<void>("DELETE", `/admin/users/${id}`),
  toggleUserActive: (id: number) => authedRequest<UserRecord>("PUT", `/admin/users/${id}/toggle-active`),
  addToPsychologists: (id: number) =>
    authedRequest<{ message: string }>("POST", `/admin/users/${id}/add-to-psychologists`),
  getUserPsychologistProfile: (id: number) =>
    authedRequest<Psychologist>("GET", `/admin/users/${id}/psychologist-profile`),
  updateUserPsychologistProfile: (id: number, data: Omit<Psychologist, "id">) =>
    authedRequest<Psychologist>("PUT", `/admin/users/${id}/psychologist-profile`, data),
  getUserApplication: (id: number) =>
    authedRequest<PsychologistApplication>("GET", `/admin/users/${id}/application`),

  // Operators
  createOperator: (data: { email: string; firstName: string; lastName: string; phone?: string }) =>
    authedRequest<{ id: number; email: string; message: string }>("POST", "/admin/operators", data),

  // Upload
  uploadFile: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const data = await authedMultipartRequest<{ url: string }>("POST", "/admin/upload", form);
    return data.url;
  },

  // Contact messages
  getContactMessages: (status?: ContactMessage["status"]) => {
    const qs = status ? `?status=${status}` : "";
    return authedRequest<ContactMessage[]>("GET", `/admin/contact-messages${qs}`);
  },
  getNewContactMessageCount: () =>
    authedRequest<{ count: number }>("GET", "/admin/contact-messages/count-new"),
  updateContactMessageStatus: (id: number, status: ContactMessage["status"], adminNote?: string) =>
    authedRequest<ContactMessage>("PUT", `/admin/contact-messages/${id}/status`, { status, adminNote }),

  // Reviews moderation
  getReviews: (status?: "PENDING" | "APPROVED" | "REJECTED") => {
    const qs = status ? `?status=${status}` : "";
    return authedRequest<AdminReview[]>("GET", `/admin/reviews${qs}`);
  },
  getPendingReviewCount: () =>
    authedRequest<{ count: number }>("GET", "/admin/reviews/pending-count"),
  approveReview: (id: number, moderationNote?: string) =>
    authedRequest<AdminReview>("POST", `/admin/reviews/${id}/approve`, { moderationNote }),
  rejectReview: (id: number, moderationNote?: string) =>
    authedRequest<AdminReview>("POST", `/admin/reviews/${id}/reject`, { moderationNote }),
  deleteReview: (id: number) => authedRequest<void>("DELETE", `/admin/reviews/${id}`),

  // ─── MODUL 1: komanda mərkəzi (bütün növbələr tək sorğuda) ───────────────
  getCommandCenter: () => authedRequest<CommandCenter>("GET", "/admin/command-center"),

  // ─── MODUL 2: randevu idarəetməsi (tam əməliyyat dəsti) ──────────────────
  getAppointmentsDetailed: () =>
    authedRequest<AdminAppointmentRow[]>("GET", "/admin/appointments/detailed"),
  getAppointmentDetail: (id: number) =>
    authedRequest<AppointmentDetail>("GET", `/admin/appointments/${id}`),
  getAppointmentHistory: (id: number) =>
    authedRequest<AuditLogEntry[]>("GET", `/admin/appointments/${id}/history`),
  assignAppointment: (id: number, data: OperatorAssignPayload) =>
    authedRequest<AppointmentDetail>("POST", `/admin/appointments/${id}/assign`, data),
  updateAppointmentNote: (id: number, note: string) =>
    authedRequest<AppointmentDetail>("PUT", `/admin/appointments/${id}/note`, { note }),
  cancelAppointment: (id: number, reasonCode: string, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/admin/appointments/${id}/cancel`, { reasonCode, note }),
  approveAppointmentCancelRequest: (id: number, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/admin/appointments/${id}/approve-cancel`, { note }),
  rejectAppointmentCancelRequest: (id: number, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/admin/appointments/${id}/reject-cancel`, { note }),
  resolveAppointmentDispute: (
    id: number,
    decision: "COMPLETE" | "CANCEL",
    note?: string,
    blameSide?: "PATIENT" | "PSYCHOLOGIST"
  ) =>
    authedRequest<AppointmentDetail>("POST", `/admin/appointments/${id}/resolve-dispute`, { decision, note, blameSide }),
  bulkCancelAppointments: (appointmentIds: number[], reasonCode: string, note?: string) =>
    authedRequest<BulkCancelResult>("POST", "/admin/appointments/bulk-cancel", { appointmentIds, reasonCode, note }),
  getBookingSeries: (seriesId: number) =>
    authedRequest<BookingSeries>("GET", `/admin/appointments/booking-series/${seriesId}`),
  approveSeriesCancelRequest: (seriesId: number, note?: string) =>
    authedRequest<BookingSeries>("POST", `/admin/appointments/booking-series/${seriesId}/approve-cancel`, { note }),
  rejectSeriesCancelRequest: (seriesId: number, note?: string) =>
    authedRequest<BookingSeries>("POST", `/admin/appointments/booking-series/${seriesId}/reject-cancel`, { note }),
  /** B4-2: 409 sonrası tutan randevunun zənginləşdirilmiş görünüşü. */
  getConflictInfo: (psychologistId: number, startAt: string, endAt: string) =>
    authedRequest<ConflictInfo>(
      "GET",
      `/admin/appointments/conflict?psychologistId=${psychologistId}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`),
  /** Vasitəçili vaxt-dəyişmə təklifi: id = tutan randevu. */
  mediateReschedule: (id: number, data: {
    options: { startAt: string; endAt: string }[];
    reason?: string | null;
    swapTargetAppointmentId?: number | null;
  }) =>
    authedRequest<RescheduleProposal>("POST", `/admin/appointments/${id}/mediate-reschedule`, data),

  // ─── MODUL 3A: pasiyent kartı + break-glass klinik giriş ─────────────────
  getPatientCard: (userId: number) =>
    authedRequest<PatientCard>("GET", `/admin/users/${userId}/patient-card`),
  grantClinicalAccess: (userId: number, reason: string) =>
    authedRequest<ClinicalGrant>("POST", `/admin/users/${userId}/clinical-access`, { reason }),
  getClinicalData: (userId: number) =>
    authedRequest<ClinicalData>("GET", `/admin/users/${userId}/clinical-data`),

  // ─── MODUL 3B: silinmə istəkləri (GDPR) ──────────────────────────────────
  getDeletionRequests: () =>
    authedRequest<DeletionRequest[]>("GET", "/admin/deletion-requests"),
  approveDeletionRequest: (userId: number) =>
    authedRequest<void>("POST", `/admin/deletion-requests/${userId}/approve`),
  rejectDeletionRequest: (userId: number, reason?: string) =>
    authedRequest<void>("POST", `/admin/deletion-requests/${userId}/reject`, { reason }),

  // ─── MODUL 3C: psixoloq kartı ────────────────────────────────────────────
  getPsychologistCard: (psyId: number) =>
    authedRequest<PsychologistCard>("GET", `/admin/psychologists/${psyId}/card`),
  suspendPsychologist: (psyId: number, reason: string) =>
    authedRequest<void>("POST", `/admin/psychologists/${psyId}/suspend`, { reason }),
  unsuspendPsychologist: (psyId: number) =>
    authedRequest<void>("POST", `/admin/psychologists/${psyId}/unsuspend`),
  getPsyVacations: (psyId: number) =>
    authedRequest<Vacation[]>("GET", `/admin/psychologists/${psyId}/vacations`),
  createPsyVacation: (psyId: number, data: { startDate: string; endDate: string; reason?: string; notifyPatients?: boolean }) =>
    authedRequest<VacationCreateResult>("POST", `/admin/psychologists/${psyId}/vacations`, data),
  deletePsyVacation: (psyId: number, vacationId: number) =>
    authedRequest<void>("DELETE", `/admin/psychologists/${psyId}/vacations/${vacationId}`),

  // ─── MODUL 3D: operator idarəetməsi ──────────────────────────────────────
  getOperatorsOverview: () =>
    authedRequest<OperatorOverview[]>("GET", "/admin/operators-overview"),

  // ─── MODUL 3E: dəstək alətləri (impersonation YOXDUR — PO qərarı) ────────
  sendPasswordReset: (userId: number) =>
    authedRequest<void>("POST", `/admin/users/${userId}/send-password-reset`),
  resendVerification: (userId: number) =>
    authedRequest<void>("POST", `/admin/users/${userId}/resend-verification`),
  changeUserEmail: (userId: number, newEmail: string) =>
    authedRequest<void>("POST", `/admin/users/${userId}/change-email`, { newEmail }),
  terminateUserSessions: (userId: number) =>
    authedRequest<void>("POST", `/admin/users/${userId}/terminate-sessions`),

  // ─── Modul E: material kitabxanası ───────────────────────────────────────
  getMaterialCategories: () => authedRequest<MaterialCategory[]>("GET", "/admin/material-categories"),
  createMaterialCategory: (data: MaterialCategoryReq) => authedRequest<MaterialCategory>("POST", "/admin/material-categories", data),
  updateMaterialCategory: (id: number, data: MaterialCategoryReq) => authedRequest<MaterialCategory>("PUT", `/admin/material-categories/${id}`, data),
  deleteMaterialCategory: (id: number) => authedRequest<void>("DELETE", `/admin/material-categories/${id}`),
  getMaterials: () => authedRequest<Material[]>("GET", "/admin/materials"),
  createMaterial: (data: MaterialReq) => authedRequest<Material>("POST", "/admin/materials", data),
  updateMaterial: (id: number, data: MaterialReq) => authedRequest<Material>("PUT", `/admin/materials/${id}`, data),
  deleteMaterial: (id: number) => authedRequest<void>("DELETE", `/admin/materials/${id}`),
  setMaterialActive: (id: number, active: boolean) => authedRequest<Material>("PUT", `/admin/materials/${id}/active`, { active }),
  uploadMaterialVersion: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return authedMultipartRequest<MaterialVersion>("POST", `/admin/materials/${id}/versions`, form);
  },
  getMaterialVersions: (id: number) => authedRequest<MaterialVersion[]>("GET", `/admin/materials/${id}/versions`),

  // ─── Modul F: psixoloji testlər ──────────────────────────────────────────
  getPsychTests: () => authedRequest<PsyTestSummary[]>("GET", "/admin/psych-tests"),
  getPsychTest: (id: number) => authedRequest<PsyTest>("GET", `/admin/psych-tests/${id}`),
  createPsychTest: (data: PsyTestReq) => authedRequest<PsyTest>("POST", "/admin/psych-tests", data),
  updatePsychTest: (id: number, data: PsyTestReq) => authedRequest<PsyTest>("PUT", `/admin/psych-tests/${id}`, data),
  deletePsychTest: (id: number) => authedRequest<void>("DELETE", `/admin/psych-tests/${id}`),
  // Psychologist test-share moderation
  pendingTestShares: () => authedRequest<PsyTestSummary[]>("GET", "/admin/psych-tests/pending-shares"),
  approveTestShare: (id: number, note?: string) => authedRequest<PsyTestSummary>("POST", `/admin/psych-tests/${id}/approve-share`, { note }),
  rejectTestShare: (id: number, note?: string) => authedRequest<PsyTestSummary>("POST", `/admin/psych-tests/${id}/reject-share`, { note }),
  // Psychologist resource share moderation
  pendingResources: () => authedRequest<PsychResource[]>("GET", "/admin/resources/pending"),
  approveResource: (id: number, note?: string) => authedRequest<PsychResource>("POST", `/admin/resources/${id}/approve`, { note }),
  rejectResource: (id: number, note?: string) => authedRequest<PsychResource>("POST", `/admin/resources/${id}/reject`, { note }),

  // ─── Təsdiqlər: İadə + Hovuz-Buraxma (Admin BRD §8, §9) ──────────────────
  listRefundRequests: (status?: string) =>
    authedRequest<RefundRequestItem[]>("GET", `/admin/refund-requests${status ? `?status=${status}` : ""}`),
  approveRefundRequest: (id: number, note?: string) =>
    authedRequest<RefundRequestItem>("POST", `/admin/refund-requests/${id}/approve`, { note }),
  rejectRefundRequest: (id: number, note?: string) =>
    authedRequest<RefundRequestItem>("POST", `/admin/refund-requests/${id}/reject`, { note }),
  listPoolReleaseRequests: (status?: string) =>
    authedRequest<PoolReleaseRequestItem[]>("GET", `/admin/pool-release-requests${status ? `?status=${status}` : ""}`),
  approvePoolReleaseRequest: (id: number, note?: string) =>
    authedRequest<PoolReleaseRequestItem>("POST", `/admin/pool-release-requests/${id}/approve`, { note }),
  rejectPoolReleaseRequest: (id: number, note?: string) =>
    authedRequest<PoolReleaseRequestItem>("POST", `/admin/pool-release-requests/${id}/reject`, { note }),
  approvalsPendingCounts: () =>
    authedRequest<{ refundRequests: number; poolReleaseRequests: number }>("GET", "/admin/approvals/pending-counts"),

  // ─── Maliyyə və Komissiya (Admin BRD §12) ────────────────────────────────
  getCommission: () => authedRequest<{ globalPercent: number | null }>("GET", "/admin/finance/commission"),
  setCommission: (percent: number) =>
    authedRequest<{ globalPercent: number | null }>("PUT", "/admin/finance/commission", { percent }),
  /** Pasientin özü müraciət etdiyi (DIRECT) rezervasiyalar üçün faiz — default 0%. */
  getDirectCommission: () => authedRequest<{ globalPercent: number | null }>("GET", "/admin/finance/direct-commission"),
  setDirectCommission: (percent: number) =>
    authedRequest<{ globalPercent: number | null }>("PUT", "/admin/finance/direct-commission", { percent }),
  setPsychologistCommission: (psychologistId: number, percent: number | null) =>
    authedRequest<void>("PUT", `/admin/finance/psychologists/${psychologistId}/commission`, { percent }),
  payoutBalances: () => authedRequest<PayoutBalance[]>("GET", "/admin/finance/payouts/balances"),
  listPayouts: (psychologistId?: number) =>
    authedRequest<PayoutItem[]>("GET", `/admin/finance/payouts${psychologistId ? `?psychologistId=${psychologistId}` : ""}`),
  createPayout: (data: { psychologistId: number; amount: number; note?: string }) =>
    authedRequest<PayoutItem>("POST", "/admin/finance/payouts", data),
  listSubscriptionPlans: () => authedRequest<SubscriptionPlanItem[]>("GET", "/admin/finance/plans"),
  createSubscriptionPlan: (data: { name: string; price: number; period: string; perks?: string; active?: boolean }) =>
    authedRequest<SubscriptionPlanItem>("POST", "/admin/finance/plans", data),
  updateSubscriptionPlan: (id: number, data: { name: string; price: number; period: string; perks?: string; active?: boolean }) =>
    authedRequest<SubscriptionPlanItem>("PUT", `/admin/finance/plans/${id}`, data),
  listSubscriptions: () => authedRequest<PsySubscriptionItem[]>("GET", "/admin/finance/subscriptions"),
  createSubscription: (data: { psychologistId: number; planId: number; startedAt?: string; expiresAt?: string }) =>
    authedRequest<PsySubscriptionItem>("POST", "/admin/finance/subscriptions", data),
  updateSubscriptionStatus: (id: number, status: string) =>
    authedRequest<PsySubscriptionItem>("POST", `/admin/finance/subscriptions/${id}/status`, { status }),
  financeSummary: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return authedRequest<FinanceSummary>("GET", `/admin/finance/summary${qs ? `?${qs}` : ""}`);
  },
};

// ─── Təsdiq axınları + Maliyyə tipləri ───────────────────────────────────────

export interface ReviewDeletionRequestItem {
  id: number;
  reviewId: number;
  reviewRating: number;
  reviewComment: string;
  patientName: string | null;
  psychologistId: number;
  psychologistName: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface RefundRequestItem {
  id: number;
  paymentId: number;
  amount: number;
  paymentAmount: number | null;
  alreadyRefunded: number;
  patientName: string | null;
  reason: string;
  requestedByName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface PoolReleaseRequestItem {
  id: number;
  appointmentId: number;
  appointmentStatus: string | null;
  patientName: string | null;
  operatorId: number;
  operatorName: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface PayoutBalance {
  psychologistId: number;
  psychologistName: string;
  earnedNet: number;
  paidOut: number;
  balance: number;
}

export interface PayoutItem {
  id: number;
  psychologistId: number;
  psychologistName: string | null;
  amount: number;
  note: string | null;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  createdAt: string;
}

export interface SubscriptionPlanItem {
  id: number;
  name: string;
  price: number;
  period: "MONTHLY" | "YEARLY";
  perks: string | null;
  active: boolean;
}

export interface PsySubscriptionItem {
  id: number;
  psychologistId: number;
  psychologistName: string | null;
  planId: number;
  planName: string | null;
  planPrice: number | null;
  status: "ACTIVE" | "EXPIRED" | "OVERDUE" | "CANCELLED";
  startedAt: string;
  expiresAt: string | null;
}

export interface FinanceSummary {
  commissionRevenue: number;
  directCommissionRevenue: number;
  platformMatchedCommissionRevenue: number;
  activeSubscriptions: number;
  subscriptionMonthlyRevenue: number;
  totalRevenue: number;
}

export interface AdminReview {
  id: number;
  psychologistId: number;
  psychologistName: string;
  patientId: number;
  patientName: string;
  appointmentId?: number | null;
  rating: number;
  comment: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  moderationNote?: string | null;
  moderatedByEmail?: string | null;
  moderatedAt?: string | null;
  reply?: string | null;
  replyAt?: string | null;
  createdAt: string;
}

// ─── Patient API ──────────────────────────────────────────────────────────────
export interface PatientBookingPayload {
  note: string;
  requestedPsychologistId?: number | null;
  requestedStartAt?: string | null; // ISO
  sessionKind?: "STANDARD" | "INTRO" | null;
}

// Pulsuz tanışlıq (INTRO, 15 dəq) görüşü haqqı.
export interface IntroEligibility {
  eligible: boolean;
  usedCount: number;
  hasGrant: boolean;
  reason?: string | null;
}

// Modul G — pasiyentin təcili əlaqə + yaşayış ünvanı (decrypt olunmuş, sahib üçün)
export interface EmergencyContact {
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  residentialAddress?: string | null;
}

// Modul A — alınmış paket (pasiyent balansı)
export interface PatientPackageItem {
  id: number;
  psychologistId: number;
  psychologistName: string;
  packageName: string;
  total: number;
  remaining: number;
  status: string;
  schedulingMode: "SCHEDULE_NOW" | "SCHEDULE_LATER";
  pricePaid: number;
  currency: string;
  purchasedAt: string;
  /** 'DIRECT' | 'PLATFORM_MATCHED' — komissiya fərqləndirməsi üçün mənbə. */
  origin?: string | null;
}

// Modul A — manual ödəniş qeydi (operator paneli)
export interface PaymentItem {
  id: number;
  patientPackageId?: number | null;
  appointmentId?: number | null;
  patientId?: number | null;
  patientName: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  paidAt?: string | null;
  createdAt: string;
  // Pool sahibliyi (paket müraciəti)
  claimedByOperatorId?: number | null;
  claimedByName?: string | null;
  claimedAt?: string | null;
  // Geri qaytarma / ləğv
  refundedAmount?: number | null;
  statusNote?: string | null;
  // Bağlı seans/paket operator sahibliyindədir → ödəniş tək başına pool-a buraxıla bilməz.
  linkedOwned?: boolean;
  // Ödənişlər modulunun zəngin görünüşü üçün zənginləşdirmə sahələri (backend DTO doldurur).
  // Boş gəlsə UI bu sahələri sakit gizlədir.
  psychologistName?: string | null;
  patientPhone?: string | null;
  commissionAmount?: number | null;
  /** 'DIRECT' | 'PLATFORM_MATCHED' — komissiya fərqləndirməsi üçün mənbə. */
  origin?: string | null;
}

export interface PaymentSummary {
  pendingCount: number;
  pendingSum: number;
  paidMonthCount: number;
  paidMonthSum: number;
  refundedMonthSum: number;
  mineCount: number;
}

export interface PackagePurchaseInput {
  psychologistId: number;
  packageId: number;
  schedulingMode: "SCHEDULE_NOW" | "SCHEDULE_LATER";
  slots?: string[];
  note?: string;
}

/** Backend PagedResponse<T> — bütün səhifələnmiş endpoint-lərin ortaq cavab forması. */
export interface Paged<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

/** Səhifələmə + filtr parametrlərindən query string qur (boşlar atılır). */
function pagedQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const patientApi = {
  myAppointments: () => authedRequest<AppointmentDetail[]>("GET", "/patient/appointments"),
  /** Səhifələnmiş — scope: "history" keçmiş seanslar; q: psixoloq adı axtarışı. */
  myAppointmentsPaged: (opts: { page?: number; size?: number; scope?: string; q?: string } = {}) =>
    authedRequest<Paged<AppointmentDetail>>("GET", `/patient/appointments/paged${pagedQuery(opts)}`),
  book: (data: PatientBookingPayload) =>
    authedRequest<AppointmentDetail>("POST", "/patient/appointments", data),
  introEligibility: () =>
    authedRequest<IntroEligibility>("GET", "/patient/intro-eligibility"),
  cancel: (id: number, reasonCode: string, reasonText?: string) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${id}/cancel`, { reasonCode, reasonText }),
  // Modul G — öz təcili əlaqə + ünvan məlumatı
  getEmergencyContact: () =>
    authedRequest<EmergencyContact>("GET", "/patient/profile/emergency-contact"),
  updateEmergencyContact: (data: EmergencyContact) =>
    authedRequest<void>("PUT", "/patient/profile/emergency-contact", data),

  // Modul A — paket alışı + balans + sonradan planlama
  purchasePackage: (data: PackagePurchaseInput) =>
    authedRequest<{ patientPackageId: number; basketResult: BasketResult | null }>("POST", "/patient/packages/purchase", data),
  myPackages: () => authedRequest<PatientPackageItem[]>("GET", "/patient/packages"),
  myPackagesPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<PatientPackageItem>>("GET", `/patient/packages/paged${pagedQuery(opts)}`),
  schedulePackageSession: (id: number, data: { startAt: string; note?: string }) =>
    authedRequest<AppointmentDetail>("POST", `/patient/packages/${id}/schedule`, data),

  favorites: () => authedRequest<Psychologist[]>("GET", "/patient/favorites"),
  favoriteIds: () => authedRequest<number[]>("GET", "/patient/favorites/ids"),
  toggleFavorite: (psychologistId: number) =>
    authedRequest<{ favorite: boolean }>("POST", `/patient/favorites/${psychologistId}/toggle`),

  reschedule: (appointmentId: number, data: PatientBookingPayload) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${appointmentId}/reschedule`, data),

  /** Simplified reschedule: just signal an operator to change the time. */
  requestRescheduleNote: (appointmentId: number, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${appointmentId}/reschedule-request-note`, { note }),

  // Reschedule proposals (psychologist → patient)
  /** GAP-03: patient proposes 1–3 alternative slots; psychologist decides. */
  requestReschedule: (appointmentId: number, data: {
    options: { startAt: string; endAt: string }[];
    reason?: string | null;
  }) =>
    authedRequest<RescheduleProposal>("POST", `/patient/appointments/${appointmentId}/reschedule-request`, data),
  pendingRescheduleProposals: () =>
    authedRequest<RescheduleProposal[]>("GET", "/patient/reschedule-proposals"),
  getRescheduleProposal: (id: number) =>
    authedRequest<RescheduleProposal>("GET", `/patient/reschedule-proposals/${id}`),
  acceptRescheduleProposal: (id: number, optionIndex: number) =>
    authedRequest<RescheduleProposal>("POST", `/patient/reschedule-proposals/${id}/accept`, { optionIndex }),
  rejectRescheduleProposal: (id: number, reason?: string) =>
    authedRequest<RescheduleProposal>("POST", `/patient/reschedule-proposals/${id}/reject`, { reason }),

  // Per-session feedback (private — separate from public reviews)
  getSessionFeedback: (appointmentId: number) =>
    authedRequest<SessionFeedback | null>("GET", `/patient/appointments/${appointmentId}/feedback`),
  submitSessionFeedback: (appointmentId: number, data: { rating: number; comment?: string; followUpNeeded?: boolean }) =>
    authedRequest<SessionFeedback>("POST", `/patient/appointments/${appointmentId}/feedback`, data),

  // Recurring booking series
  /** FAZA B1: basket booking — concrete slot list, partial success on races.
   *  Pass seriesId to append the slots to an existing course ("Uzat"). */
  createBookingBasket: (data: {
    requestedPsychologistId: number;
    slots: string[];
    note?: string;
    seriesId?: number;
  }) => authedRequest<BasketResult>("POST", "/patient/booking-basket", data),
  createBookingSeries: (data: {
    firstBooking: PatientBookingPayload;
    frequency: "WEEKLY" | "BIWEEKLY";
    totalCount: number;
  }) => authedRequest<BookingSeries>("POST", "/patient/booking-series", data),
  myBookingSeries: () => authedRequest<BookingSeries[]>("GET", "/patient/booking-series"),
  cancelBookingSeries: (id: number) =>
    authedRequest<BookingSeries>("DELETE", `/patient/booking-series/${id}`),
  extendBookingSeries: (id: number, count: number) =>
    authedRequest<BookingSeries>("POST", `/patient/booking-series/${id}/extend?count=${count}`),

  confirmSession: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${id}/confirm-session`),
  disputeSession: (id: number, reason?: string) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${id}/dispute-session`, { reason }),


  // Homework
  homework: () => authedRequest<Homework[]>("GET", "/patient/homework"),
  homeworkPaged: (opts: { page?: number; size?: number; status?: string } = {}) =>
    authedRequest<Paged<Homework>>("GET", `/patient/homework/paged${pagedQuery(opts)}`),
  markHomework: (id: number, data: { status: "COMPLETED" | "IN_PROGRESS" | "PENDING"; completionNote?: string }) =>
    authedRequest<Homework>("POST", `/patient/homework/${id}/mark`, data),
  homeworkMove: (id: number, status: HomeworkStatus, position: number) =>
    authedRequest<Homework>("PATCH", `/patient/homework/${id}/move`, { status, position }),
  homeworkAddItem: (id: number, label: string) =>
    authedRequest<HomeworkChecklistItem>("POST", `/patient/homework/${id}/checklist`, { label }),
  homeworkToggleItem: (id: number, itemId: number, completed: boolean) =>
    authedRequest<HomeworkChecklistItem>("POST", `/patient/homework/${id}/checklist/${itemId}/toggle`, { completed }),
  homeworkUploadAttachment: async (id: number, file: File): Promise<HomeworkAttachment> => {
    const form = new FormData();
    form.append("file", file);
    return authedMultipartRequest<HomeworkAttachment>("POST", `/patient/homework/${id}/attachments`, form);
  },
  homeworkDeleteAttachment: (id: number, attachmentId: number) =>
    authedRequest<void>("DELETE", `/patient/homework/${id}/attachments/${attachmentId}`),

  homeworkComments: (id: number) =>
    authedRequest<HomeworkComment[]>("GET", `/patient/homework/${id}/comments`),
  homeworkAddComment: (id: number, body: string) =>
    authedRequest<HomeworkComment>("POST", `/patient/homework/${id}/comments`, { body }),
  homeworkDeleteComment: (id: number, commentId: number) =>
    authedRequest<void>("DELETE", `/patient/homework/${id}/comments/${commentId}`),
  homeworkActivity: (id: number) =>
    authedRequest<HomeworkActivity[]>("GET", `/patient/homework/${id}/activity`),

  // Crisis support
  crisisStatus: () => authedRequest<CrisisStatus>("GET", "/patient/crisis/status"),
  crisisCheckIn: (data: { moodScore: number; note?: string | null }) =>
    authedRequest<CrisisCheckIn>("POST", "/patient/crisis/check-in", data),

  // Treatment goals (read-only + progress self-report)
  goals: () => authedRequest<PatientGoalView[]>("GET", "/patient/goals"),
  goalsPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<PatientGoalView>>("GET", `/patient/goals/paged${pagedQuery(opts)}`),
  updateGoalProgress: (id: number, progressPct: number, note?: string | null) =>
    authedRequest<PatientGoalView>("PATCH", `/patient/goals/${id}/progress`, {
      progressPct, note: note ?? null,
    }),

  // Reviews
  myReviews: () => authedRequest<MyReview[]>("GET", "/patient/reviews"),
  canReview: (psychologistId: number) =>
    authedRequest<{ canReview: boolean }>("GET", `/patient/reviews/can-review/${psychologistId}`),
  submitReview: (psychologistId: number, data: ReviewPayload) =>
    authedRequest<MyReview>("POST", `/patient/psychologists/${psychologistId}/reviews`, data),
  updateReview: (reviewId: number, data: ReviewPayload) =>
    authedRequest<MyReview>("PUT", `/patient/reviews/${reviewId}`, data),
  deleteReview: (reviewId: number) =>
    authedRequest<void>("DELETE", `/patient/reviews/${reviewId}`),

  // ─── Modul F: psixoloji testlər ──────────────────────────────────────────
  myTestAssignments: () => authedRequest<TestAssignment[]>("GET", "/patient/psych-tests/assignments"),
  takeTest: (assignmentId: number) => authedRequest<TakeTest>("GET", `/patient/psych-tests/assignments/${assignmentId}`),
  submitTest: (assignmentId: number, data: { answers: SubmitAnswer[]; respondentName?: string }) =>
    authedRequest<TestResult>("POST", `/patient/psych-tests/assignments/${assignmentId}/submit`, data),
  patientTestResult: (assignmentId: number) => authedRequest<TestResult>("GET", `/patient/psych-tests/assignments/${assignmentId}/result`),
};

// ─── Keys yönləndirmə (referral) tipləri ──────────────────────────────────────
export type ReferralStatus =
  | "PENDING_OPERATOR" | "PENDING_REVIEW" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export type ReferralSubjectType = "APPOINTMENT" | "PACKAGE";

export interface Referral {
  id: number;
  direction: "SENT" | "RECEIVED" | "OPERATOR";
  fromPsychologistId: number;
  fromPsychologistName: string;
  toPsychologistId: number;
  toPsychologistName: string;
  patientId: number;
  patientName?: string | null;
  subjectType: ReferralSubjectType;
  appointmentId?: number | null;
  patientPackageId?: number | null;
  subjectLabel?: string | null;
  referredAmount?: number | null;
  currency?: string | null;
  reason: string;
  clinicalSummary?: string | null;
  message?: string | null;
  status: ReferralStatus;
  operatorNote?: string | null;
  operatorApprovedAt?: string | null;
  createdAt?: string;
  respondedAt?: string | null;
}

export interface ReferableSubject {
  type: ReferralSubjectType;
  id: number;
  label: string;
  patientName?: string | null;
  when?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export interface ReferableOptions {
  appointments: ReferableSubject[];
  packages: ReferableSubject[];
}

export interface CreateReferralReq {
  toPsychologistId: number;
  subjectType: ReferralSubjectType;
  appointmentId?: number;
  patientPackageId?: number;
  reason: string;
  clinicalSummary?: string;
  message?: string;
}

export interface ReviewPayload {
  appointmentId?: number | null;
  rating: number;
  comment: string;
}
export interface MyReview {
  id: number;
  psychologistId: number;
  psychologistName: string;
  rating: number;
  comment: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reply?: string | null;
  replyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications (any authenticated role) ───────────────────────────────────
export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  relatedType?: string | null;
  relatedId?: number | null;
  readAt?: string | null;
  createdAt: string;
}

export const notificationsApi = {
  /** page: köhnə bildirişlərə çatmaq üçün — cavab limit-dən qısadırsa son səhifədir. */
  list: (limit = 30, page = 0) =>
    authedRequest<NotificationItem[]>("GET", `/me/notifications?limit=${limit}${page > 0 ? `&page=${page}` : ""}`),
  unreadCount: () => authedRequest<{ count: number }>("GET", "/me/notifications/unread-count"),
  markRead: (id: number) => authedRequest<void>("POST", `/me/notifications/${id}/read`),
  markAllRead: () => authedRequest<{ updated: number }>("POST", "/me/notifications/read-all"),
  markReadBulk: (ids: number[]) =>
    authedRequest<{ updated: number }>("POST", "/me/notifications/bulk-read", { ids }),
  deleteBulk: (ids: number[]) =>
    authedRequest<{ deleted: number }>("POST", "/me/notifications/bulk-delete", { ids }),
};

// ─── /me — generic user profile ─────────────────────────────────────────────
export interface MeProfile {
  id: number;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  emailVerified: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

/** Probe the current session. Returns:
 *    - MeProfile when the server confirms we're logged in (or after a
 *      successful refresh).
 *    - null ONLY when refresh itself returned 401/403 (definitively logged out).
 *    - A cached MeProfile (from localStorage) on any other failure — network
 *      blip, 5xx, CORS hiccup. Returning null on those used to bounce the
 *      user to /login on every transient glitch (laptop wake-up, weak wifi),
 *      which the user experienced as fast random logouts. */
export async function tryGetMe(): Promise<MeProfile | null> {
  type AttemptResult = MeProfile | "unauthorized" | "unreachable";
  const attempt = async (): Promise<AttemptResult> => {
    try {
      const res = await fetch(`${BASE}/me`, {
        method: "GET",
        credentials: "include",
        headers: localeHeaders(),
      });
      if (res.status === 401) return "unauthorized";
      if (!res.ok) return "unreachable";
      return await res.json() as MeProfile;
    } catch {
      return "unreachable";
    }
  };

  const first = await attempt();
  if (first === "unreachable") {
    // Server can't be reached. Hand back the cached identity so the UI
    // keeps rendering; the next real request will retry.
    return getStoredUserAsMeProfile();
  }
  if (first === "unauthorized") {
    const outcome = await tryRefresh();
    if (outcome === "auth_failure") return null;        // definitively logged out
    if (outcome === "network_error") return getStoredUserAsMeProfile();
    const second = await attempt();
    if (second === "unauthorized") return null;
    if (second === "unreachable") return getStoredUserAsMeProfile();
    return second;
  }
  return first;
}

function getStoredUserAsMeProfile(): MeProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("authUser");
    if (!raw) return null;
    const u = JSON.parse(raw) as { userId: number; email: string; role: string; firstName?: string; lastName?: string };
    // We only have a slim user record cached client-side; fill the rest with
    // safe defaults so the MeProfile shape stays whole. This is purely UI
    // continuity during a network blip — the next successful /me call
    // replaces it with the authoritative server copy.
    return {
      id: u.userId, email: u.email, role: u.role,
      firstName: u.firstName ?? null, lastName: u.lastName ?? null,
      emailVerified: true,
      createdAt: new Date(0).toISOString(),
    };
  } catch { return null; }
}

export const meApi = {
  get: () => authedRequest<MeProfile>("GET", "/me"),
  update: (data: { firstName?: string | null; lastName?: string | null; phone?: string | null }) =>
    authedRequest<MeProfile>("PUT", "/me", data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    authedRequest<void>("POST", "/me/password", data),
  uploadPhoto: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    return authedMultipartRequest<{ url: string }>("POST", "/me/photo", fd);
  },
  deletePhoto: () => authedRequest<void>("DELETE", "/me/photo"),

  /** Persist the user's UI/email locale preference server-side.
   *  Called from LanguageSwitcher when a logged-in user changes language. */
  setLocale: (locale: string) =>
    authedRequest<{ locale: string }>("POST", "/me/locale", { locale }),

  // GDPR
  accountStatus: () => authedRequest<AccountStatus>("GET", "/me/account-status"),
  deleteAccount: (data: { currentPassword: string; confirmation: string }) =>
    authedRequest<AccountStatus>("POST", "/me/delete-account", data),
  /** Cancel a pending self-service deletion within the 30-day grace window.
   *  Restores the account to fully-active. Idempotent: harmless to call when
   *  no deletion is pending. */
  cancelDeletionRequest: () =>
    authedRequest<AccountStatus>("DELETE", "/me/deletion-request"),
  /** Triggers a browser download of the GDPR data export ZIP. */
  exportData: async (): Promise<void> => {
    const blob = await authedBlobRequest("GET", "/me/export");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fanus-export.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  },
};

export interface AccountStatus {
  active: boolean;
  deletionRequestedAt: string | null;
  daysUntilPurge: number;
}

// ─── Peer follow (psixoloqlar arası izləmə) ───────────────────────────────────
export interface FollowStatus {
  following: boolean;
  followerCount: number;
  followingCount: number;
}
export interface FollowSummary {
  id: number;
  name: string;
  title: string;
  photoUrl?: string | null;
}

// ─── İcma daxili interaktivlik (panel oxucu + şərh + bəyənmə) ──────────────────
export interface ArticleComment {
  id: number;
  parentId: number | null;
  authorId: number | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  body: string | null;
  deleted: boolean;
  mine: boolean;
  createdAt: string;
  editedAt: string | null;
  replies: ArticleComment[];
}
export interface ArticleReader {
  post: BlogPost;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

// ─── Bilik bazası (paylaşılan psixoloq resursları) ────────────────────────────
export interface PsychResource {
  id: number;
  title: string;
  description?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  category: string;
  authorId?: number | null;
  authorName?: string | null;
  authorPhotoUrl?: string | null;
  mine: boolean;
  shareStatus: string;          // PRIVATE | PENDING | APPROVED | REJECTED
  adminNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface PsychResourceReq {
  title: string;
  description?: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  category: string;
}

// ─── Psychologist API ─────────────────────────────────────────────────────────
export const psychologistApi = {
  me: () => authedRequest<Psychologist>("GET", "/psychologist/me"),
  updateSessionMinutes: (minutes: number) =>
    authedRequest<Psychologist>("PUT", "/psychologist/me/session-minutes", { minutes }),
  // Modul D — profil statistikası mənbəyi (FANUS_PLATFORM seçimi +10% görünürlük)
  updateStatsSource: (statsSource: "FANUS_PLATFORM" | "PRIOR_EXPERIENCE") =>
    authedRequest<Psychologist>("PUT", "/psychologist/me/stats-source", { statsSource }),

  // Modul A/C — psixoloqun öz qiymət/paket idarəsi (FANUS isə redaktə 403)
  myPricing: () =>
    authedRequest<{ individualPrice: number | null; currency: string }>("GET", "/psychologist/me/pricing"),
  updateMyPricing: (individualPrice: number) =>
    authedRequest<{ individualPrice: number | null; currency: string }>("PUT", "/psychologist/me/pricing", { individualPrice }),
  myPackages: () => authedRequest<PackageDto[]>("GET", "/psychologist/me/packages"),
  myPackageStats: () => authedRequest<PackageStats[]>("GET", "/psychologist/me/packages/stats"),
  createMyPackage: (data: PackageReq) => authedRequest<PackageDto>("POST", "/psychologist/me/packages", data),
  updateMyPackage: (id: number, data: PackageReq) => authedRequest<PackageDto>("PUT", `/psychologist/me/packages/${id}`, data),
  deleteMyPackage: (id: number) => authedRequest<void>("DELETE", `/psychologist/me/packages/${id}`),

  listSlots: () => authedRequest<TimeSlot[]>("GET", "/psychologist/time-slots"),
  createSlot: (data: { dayOfWeek: number; startTime: string; endTime: string; active?: boolean }) =>
    authedRequest<TimeSlot>("POST", "/psychologist/time-slots", data),
  updateSlot: (id: number, data: { dayOfWeek: number; startTime: string; endTime: string; active?: boolean }) =>
    authedRequest<TimeSlot>("PUT", `/psychologist/time-slots/${id}`, data),
  deleteSlot: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/time-slots/${id}`),

  listOverrides: () => authedRequest<TimeSlotOverride[]>("GET", "/psychologist/time-slot-overrides"),
  createOverride: (data: {
    overrideDate: string; overrideType: "BLOCK" | "EXTRA";
    startTime?: string; endTime?: string; note?: string;
  }) => authedRequest<TimeSlotOverride>("POST", "/psychologist/time-slot-overrides", data),
  deleteOverride: (id: number) =>
    authedRequest<void>(`DELETE`, `/psychologist/time-slot-overrides/${id}`),

  myAppointments: () => authedRequest<AppointmentDetail[]>("GET", "/psychologist/appointments"),
  /** Səhifələnmiş — scope: "history" keçmiş seanslar; q: pasiyent adı axtarışı. */
  myAppointmentsPaged: (opts: { page?: number; size?: number; scope?: string; q?: string } = {}) =>
    authedRequest<Paged<AppointmentDetail>>("GET", `/psychologist/appointments/paged${pagedQuery(opts)}`),
  confirm: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/confirm`),
  reject: (id: number, reasonCode: string, reasonText?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/reject`, { reasonCode, reasonText }),
  cancel: (id: number, reasonCode: string, reasonText?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/cancel`, { reasonCode, reasonText }),
  bulkCancel: (ids: number[], reasonCode: string, reasonText?: string) =>
    authedRequest<{ cancelled: AppointmentDetail[]; errors: { id: number; message: string }[] }>(
      "POST", "/psychologist/appointments/bulk-cancel", { ids, reasonCode, reasonText }
    ),
  confirmSession: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/confirm-session`),
  disputeSession: (id: number, reason?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/dispute-session`, { reason }),
  complete: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/complete`),

  stats: () => authedRequest<PsychologistStats>("GET", "/psychologist/stats"),
  clients: () => authedRequest<ClientSummary[]>("GET", "/psychologist/clients"),
  clientsPaged: (opts: { page?: number; size?: number; q?: string } = {}) =>
    authedRequest<Paged<ClientSummary>>("GET", `/psychologist/clients/paged${pagedQuery(opts)}`),
  notesForPatient: (patientId: number) =>
    authedRequest<ClientNote[]>("GET", `/psychologist/clients/${patientId}/notes`),
  /** Bu seansa yazılmış qeyd — yoxdursa `null` (backend 204 qaytarır). */
  noteForAppointment: (appointmentId: number) =>
    authedRequest<ClientNote | undefined>("GET", `/psychologist/appointments/${appointmentId}/note`)
      .then(n => n ?? null),
  createNote: (data: ClientNotePayload) =>
    authedRequest<ClientNote>("POST", "/psychologist/client-notes", data),
  updateNote: (id: number, data: ClientNotePayload) =>
    authedRequest<ClientNote>("PUT", `/psychologist/client-notes/${id}`, data),
  deleteNote: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/client-notes/${id}`),

  // Vacation / out-of-office
  listVacations: () =>
    authedRequest<Vacation[]>("GET", "/psychologist/vacations"),
  /** GAP-05: returns created=false + conflicts when active bookings overlap. */
  createVacation: (data: { startDate: string; endDate: string; reason?: string; notifyPatients?: boolean }) =>
    authedRequest<VacationCreateResult>("POST", "/psychologist/vacations", data),
  cancelVacation: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/vacations/${id}`),
  /** GAP-05: hand a conflicting booking back to operators (→ IN_REVIEW). */
  handoffToOperator: (appointmentId: number, reason?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${appointmentId}/handoff-to-operator`, { reason }),
  /** GAP-06 (optional CTA): nudge a patient to continue their series. */
  suggestSeriesRenewal: (patientId: number) =>
    authedRequest<{ nudged: number }>("POST", `/psychologist/clients/${patientId}/suggest-series-renewal`),

  // Reschedule proposals (psy side)
  /** status verilərsə (məs. PENDING) yalnız o — tam tarixçə çəkilmir. */
  myRescheduleProposals: (status?: string) =>
    authedRequest<RescheduleProposal[]>("GET", `/psychologist/reschedule-proposals${status ? `?status=${status}` : ""}`),
  proposeReschedule: (appointmentId: number, data: {
    options: { startAt: string; endAt: string }[];
    reason?: string;
    expiresInHours?: number;
  }) =>
    authedRequest<RescheduleProposal>("POST", `/psychologist/appointments/${appointmentId}/reschedule-proposals`, data),
  withdrawRescheduleProposal: (id: number) =>
    authedRequest<RescheduleProposal>("DELETE", `/psychologist/reschedule-proposals/${id}`),
  /** GAP-03: decide a PATIENT-initiated reschedule request. */
  acceptPatientReschedule: (id: number, optionIndex: number) =>
    authedRequest<RescheduleProposal>("POST", `/psychologist/reschedule-proposals/${id}/accept`, { optionIndex }),
  rejectPatientReschedule: (id: number, reason?: string) =>
    authedRequest<RescheduleProposal>("POST", `/psychologist/reschedule-proposals/${id}/reject`, { reason }),

  // Patient tags (private to the psychologist)
  patientTags: (patientId: number) =>
    authedRequest<PatientTag[]>("GET", `/psychologist/clients/${patientId}/tags`),
  allMyPatientTags: () =>
    authedRequest<PatientTag[]>("GET", "/psychologist/patient-tags"),
  createPatientTag: (patientId: number, data: { label: string; color?: string }) =>
    authedRequest<PatientTag>("POST", `/psychologist/clients/${patientId}/tags`, data),
  deletePatientTag: (tagId: number) =>
    authedRequest<void>("DELETE", `/psychologist/patient-tags/${tagId}`),

  // Patient clinical risk flag
  patientRisk: (patientId: number) =>
    authedRequest<PatientRisk>("GET", `/psychologist/clients/${patientId}/risk`),
  setPatientRisk: (patientId: number, data: { riskLevel: PatientRiskLevel | null; riskNote?: string | null }) =>
    authedRequest<PatientRisk>("PUT", `/psychologist/clients/${patientId}/risk`, {
      riskLevel: data.riskLevel ?? "",
      riskNote: data.riskNote ?? null,
    }),

  // Patient treatment goals
  patientGoals: (patientId: number) =>
    authedRequest<PatientGoal[]>("GET", `/psychologist/clients/${patientId}/goals`),
  createGoal: (patientId: number, data: PatientGoalPayload) =>
    authedRequest<PatientGoal>("POST", `/psychologist/clients/${patientId}/goals`, data),
  updateGoal: (goalId: number, data: PatientGoalPayload) =>
    authedRequest<PatientGoal>("PUT", `/psychologist/goals/${goalId}`, data),
  deleteGoal: (goalId: number) =>
    authedRequest<void>("DELETE", `/psychologist/goals/${goalId}`),
  patientCrisisHistory: (patientId: number) =>
    authedRequest<CrisisCheckIn[]>("GET", `/psychologist/clients/${patientId}/crisis-check-ins`),

  // Homework
  homework: () => authedRequest<Homework[]>("GET", "/psychologist/homework"),
  /** Səhifələnmiş — status verilərsə (PENDING/IN_PROGRESS/COMPLETED) yalnız o sütun. */
  homeworkPaged: (opts: { page?: number; size?: number; status?: string } = {}) =>
    authedRequest<Paged<Homework>>("GET", `/psychologist/homework/paged${pagedQuery(opts)}`),
  createHomework: (data: {
    patientId: number; title: string; description?: string; dueDate?: string;
    checklist?: string[]; priority?: HomeworkPriority; labelIds?: number[];
  }) =>
    authedRequest<Homework>("POST", "/psychologist/homework", data),
  updateHomework: (id: number, data: {
    patientId: number; title: string; description?: string; dueDate?: string;
    priority?: HomeworkPriority; labelIds?: number[];
  }) =>
    authedRequest<Homework>("PUT", `/psychologist/homework/${id}`, data),
  deleteHomework: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/homework/${id}`),
  homeworkMove: (id: number, status: HomeworkStatus, position: number) =>
    authedRequest<Homework>("PATCH", `/psychologist/homework/${id}/move`, { status, position }),
  homeworkSetPriority: (id: number, priority: HomeworkPriority) =>
    authedRequest<Homework>("PATCH", `/psychologist/homework/${id}/priority`, { priority }),
  homeworkAddItem: (id: number, label: string) =>
    authedRequest<HomeworkChecklistItem>("POST", `/psychologist/homework/${id}/checklist`, { label }),
  homeworkToggleItem: (id: number, itemId: number, completed: boolean) =>
    authedRequest<HomeworkChecklistItem>("POST", `/psychologist/homework/${id}/checklist/${itemId}/toggle`, { completed }),
  homeworkDeleteItem: (id: number, itemId: number) =>
    authedRequest<void>("DELETE", `/psychologist/homework/${id}/checklist/${itemId}`),
  homeworkUploadAttachment: async (id: number, file: File): Promise<HomeworkAttachment> => {
    const form = new FormData();
    form.append("file", file);
    return authedMultipartRequest<HomeworkAttachment>("POST", `/psychologist/homework/${id}/attachments`, form);
  },
  homeworkDeleteAttachment: (id: number, attachmentId: number) =>
    authedRequest<void>("DELETE", `/psychologist/homework/${id}/attachments/${attachmentId}`),

  // Labels (psychologist's personal palette)
  homeworkLabels: () => authedRequest<HomeworkLabel[]>("GET", "/psychologist/homework-labels"),
  homeworkLabelCreate: (label: string, color: HomeworkLabelColor) =>
    authedRequest<HomeworkLabel>("POST", "/psychologist/homework-labels", { label, color }),
  homeworkLabelUpdate: (id: number, label: string, color: HomeworkLabelColor) =>
    authedRequest<HomeworkLabel>("PUT", `/psychologist/homework-labels/${id}`, { label, color }),
  homeworkLabelDelete: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/homework-labels/${id}`),
  homeworkAttachLabel: (id: number, labelId: number) =>
    authedRequest<Homework>("POST", `/psychologist/homework/${id}/labels/${labelId}`),
  homeworkDetachLabel: (id: number, labelId: number) =>
    authedRequest<Homework>("DELETE", `/psychologist/homework/${id}/labels/${labelId}`),

  // Comments + activity
  homeworkComments: (id: number) =>
    authedRequest<HomeworkComment[]>("GET", `/psychologist/homework/${id}/comments`),
  homeworkAddComment: (id: number, body: string) =>
    authedRequest<HomeworkComment>("POST", `/psychologist/homework/${id}/comments`, { body }),
  homeworkDeleteComment: (id: number, commentId: number) =>
    authedRequest<void>("DELETE", `/psychologist/homework/${id}/comments/${commentId}`),
  homeworkActivity: (id: number) =>
    authedRequest<HomeworkActivity[]>("GET", `/psychologist/homework/${id}/activity`),

  // Templates
  templates: () => authedRequest<FollowupTemplate[]>("GET", "/psychologist/templates"),
  createTemplate: (data: { name: string; body: string }) =>
    authedRequest<FollowupTemplate>("POST", "/psychologist/templates", data),
  updateTemplate: (id: number, data: { name: string; body: string }) =>
    authedRequest<FollowupTemplate>("PUT", `/psychologist/templates/${id}`, data),
  deleteTemplate: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/templates/${id}`),

  // Reviews (received from patients)
  receivedReviews: () =>
    authedRequest<PsychologistReceivedReview[]>("GET", "/psychologist/reviews"),
  receivedReviewsPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<PsychologistReceivedReview>>("GET", `/psychologist/reviews/paged${pagedQuery(opts)}`),
  replyToReview: (reviewId: number, reply: string) =>
    authedRequest<PsychologistReceivedReview>("POST", `/psychologist/reviews/${reviewId}/reply`, { reply }),
  deleteReviewReply: (reviewId: number) =>
    authedRequest<void>("DELETE", `/psychologist/reviews/${reviewId}/reply`),
  /** Rəy Silmə Tələbi göndər — qərar Operatorundur (PSI-FR-17). */
  requestReviewDeletion: (reviewId: number, reason: string) =>
    authedRequest<ReviewDeletionRequestItem>("POST", `/psychologist/reviews/${reviewId}/deletion-request`, { reason }),
  myReviewDeletionRequests: () =>
    authedRequest<ReviewDeletionRequestItem[]>("GET", "/psychologist/review-deletion-requests"),

  // Articles (psychologist-owned blog posts)
  listArticles: () => authedRequest<BlogPost[]>("GET", "/psychologist/articles"),
  listArticlesPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<BlogPost>>("GET", `/psychologist/articles/paged${pagedQuery(opts)}`),
  getArticleById: (id: number) => authedRequest<BlogPost>("GET", `/psychologist/articles/${id}`),
  createArticle: (data: Omit<BlogPost, "id">) =>
    authedRequest<BlogPost>("POST", "/psychologist/articles", data).then(p => { revalidateBlogCache(p.slug); return p; }),
  updateArticle: (id: number, data: Omit<BlogPost, "id">) =>
    authedRequest<BlogPost>("PUT", `/psychologist/articles/${id}`, data).then(p => { revalidateBlogCache(p.slug); return p; }),
  /** Flip status only — bypasses the shadow-draft auto-save path so
   *  unpublishing actually unpublishes. */
  setArticleStatus: (id: number, status: "PUBLISHED" | "DRAFT") =>
    authedRequest<BlogPost>("PATCH", `/psychologist/articles/${id}/status`, { status }).then(p => { revalidateBlogCache(p.slug); return p; }),
  deleteArticle: (id: number, slug?: string) =>
    authedRequest<void>("DELETE", `/psychologist/articles/${id}`).then(() => revalidateBlogCache(slug)),
  addArticleAttachment: async (articleId: number, file: File, displayOrder = 0): Promise<ArticleAttachment> => {
    const form = new FormData();
    form.append("file", file);
    form.append("displayOrder", String(displayOrder));
    return authedMultipartRequest<ArticleAttachment>("POST", `/psychologist/articles/${articleId}/attachments`, form);
  },
  deleteArticleAttachment: (articleId: number, attachmentId: number) =>
    authedRequest<void>("DELETE", `/psychologist/articles/${articleId}/attachments/${attachmentId}`),

  // Article editor helpers (mirror admin shape so ArticleEditorPage can be reused)
  getBlogCategories: () => authedRequest<BlogCategory[]>("GET", "/blog-categories"),
  uploadFile: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const data = await authedMultipartRequest<{ url: string }>("POST", "/psychologist/upload", form);
    return data.url;
  },

  // Google Calendar integration
  googleStatus: () => authedRequest<GoogleCalendarStatus>("GET", "/psychologist/google/status"),
  googleAuthUrl: () => authedRequest<{ url: string }>("GET", "/psychologist/google/auth-url"),
  googleDisconnect: () => authedRequest<void>("POST", "/psychologist/google/disconnect"),
  googleResync: () => authedRequest<{ queued: number }>("POST", "/psychologist/google/resync"),
  googleEvents: (fromIso: string, toIso: string) =>
    authedRequest<GoogleExternalEvent[]>(
      "GET",
      `/psychologist/google/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
    ),

  // ─── Modul E: material kitabxanası (yalnız oxuma) ─────────────────────────
  psyMaterialCategories: () => authedRequest<MaterialCategory[]>("GET", "/psychologist/material-categories"),
  psyMaterials: (categoryId?: number, search?: string) => {
    const p = new URLSearchParams();
    if (categoryId != null) p.set("categoryId", String(categoryId));
    if (search) p.set("search", search);
    const qs = p.toString();
    return authedRequest<Material[]>("GET", `/psychologist/materials${qs ? `?${qs}` : ""}`);
  },
  psyMaterialVersions: (id: number) => authedRequest<MaterialVersion[]>("GET", `/psychologist/materials/${id}/versions`),

  // ─── Modul F: psixoloji testlər ──────────────────────────────────────────
  assignableTests: () => authedRequest<PsyTestSummary[]>("GET", "/psychologist/psych-tests"),
  // Psychologist-authored tests (own builder; sharing needs admin approval)
  myTests: () => authedRequest<PsyTestSummary[]>("GET", "/psychologist/psych-tests/manage"),
  myTest: (id: number) => authedRequest<PsyTest>("GET", `/psychologist/psych-tests/manage/${id}`),
  createMyTest: (data: PsyTestReq) => authedRequest<PsyTest>("POST", "/psychologist/psych-tests/manage", data),
  updateMyTest: (id: number, data: PsyTestReq) => authedRequest<PsyTest>("PUT", `/psychologist/psych-tests/manage/${id}`, data),
  deleteMyTest: (id: number) => authedRequest<void>("DELETE", `/psychologist/psych-tests/manage/${id}`),
  requestTestShare: (id: number) => authedRequest<PsyTestSummary>("POST", `/psychologist/psych-tests/manage/${id}/request-share`),
  assignTest: (data: { testId: number; patientId: number; note?: string }) =>
    authedRequest<TestAssignment>("POST", "/psychologist/psych-tests/assignments", data),
  createTestLink: (data: { testId: number; note?: string }) =>
    authedRequest<{ token: string; url: string }>("POST", "/psychologist/psych-tests/public-links", data),
  testAssignments: () => authedRequest<TestAssignment[]>("GET", "/psychologist/psych-tests/assignments"),
  testAssignmentsPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<TestAssignment>>("GET", `/psychologist/psych-tests/assignments/paged${pagedQuery(opts)}`),
  testResult: (assignmentId: number) =>
    authedRequest<TestResult>("GET", `/psychologist/psych-tests/assignments/${assignmentId}/result`),
  /** All submissions for one assignment — a public link collects many takers. */
  testSubmissions: (assignmentId: number) =>
    authedRequest<TestResult[]>("GET", `/psychologist/psych-tests/assignments/${assignmentId}/results`),
  closeTestLink: (assignmentId: number) =>
    authedRequest<TestAssignment>("POST", `/psychologist/psych-tests/assignments/${assignmentId}/close`),

  // ─── Peer follow (psixoloqlar arası izləmə) ──────────────────────────────
  follow: (targetId: number) => authedRequest<void>("POST", `/psychologist/follow/${targetId}`),
  unfollow: (targetId: number) => authedRequest<void>("DELETE", `/psychologist/follow/${targetId}`),
  followStatus: (targetId: number) =>
    authedRequest<FollowStatus>("GET", `/psychologist/follow/${targetId}/status`),
  following: () => authedRequest<FollowSummary[]>("GET", "/psychologist/following"),
  followers: () => authedRequest<FollowSummary[]>("GET", "/psychologist/followers"),
  feed: () => authedRequest<BlogPost[]>("GET", "/psychologist/feed"),
  feedPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<BlogPost>>("GET", `/psychologist/feed/paged${pagedQuery(opts)}`),

  // ─── İcma daxili interaktivlik (məqalə oxucu + şərh + bəyənmə) ────────────
  communityPost: (id: number) =>
    authedRequest<ArticleReader>("GET", `/psychologist/community/posts/${id}`),
  communityComments: (id: number) =>
    authedRequest<ArticleComment[]>("GET", `/psychologist/community/posts/${id}/comments`),
  addComment: (id: number, body: string, parentId?: number | null) =>
    authedRequest<ArticleComment>("POST", `/psychologist/community/posts/${id}/comments`, { body, parentId: parentId ?? null }),
  editComment: (commentId: number, body: string) =>
    authedRequest<ArticleComment>("PUT", `/psychologist/community/comments/${commentId}`, { body }),
  deleteComment: (commentId: number) =>
    authedRequest<void>("DELETE", `/psychologist/community/comments/${commentId}`),
  likePost: (id: number) =>
    authedRequest<ArticleReader>("POST", `/psychologist/community/posts/${id}/like`),
  unlikePost: (id: number) =>
    authedRequest<ArticleReader>("DELETE", `/psychologist/community/posts/${id}/like`),

  // ─── Bilik bazası (paylaşılan resurslar) ─────────────────────────────────
  listResources: (category?: string) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    return authedRequest<PsychResource[]>("GET", `/psychologist/resources${qs}`);
  },
  getResource: (id: number) => authedRequest<PsychResource>("GET", `/psychologist/resources/${id}`),
  /** Current psychologist's OWN resources (any share state) — management view. */
  myResources: () => authedRequest<PsychResource[]>("GET", "/psychologist/resources/mine"),
  listResourcesPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<PsychResource>>("GET", `/psychologist/resources/paged${pagedQuery(opts)}`),
  myResourcesPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<PsychResource>>("GET", `/psychologist/resources/mine/paged${pagedQuery(opts)}`),
  createResource: (data: PsychResourceReq) =>
    authedRequest<PsychResource>("POST", "/psychologist/resources", data),
  updateResource: (id: number, data: PsychResourceReq) =>
    authedRequest<PsychResource>("PUT", `/psychologist/resources/${id}`, data),
  deleteResource: (id: number) => authedRequest<void>("DELETE", `/psychologist/resources/${id}`),
  /** Ask an admin to publish this resource to the shared library. */
  requestShareResource: (id: number) =>
    authedRequest<PsychResource>("POST", `/psychologist/resources/${id}/request-share`),

  // ─── Keys yönləndirmə (referral) ─────────────────────────────────────────
  referralOptions: () => authedRequest<ReferableOptions>("GET", "/psychologist/referrals/options"),
  createReferral: (data: CreateReferralReq) =>
    authedRequest<Referral>("POST", "/psychologist/referrals", data),
  sentReferrals: () => authedRequest<Referral[]>("GET", "/psychologist/referrals/sent"),
  receivedReferrals: () => authedRequest<Referral[]>("GET", "/psychologist/referrals/received"),
  sentReferralsPaged: (opts: { page?: number; size?: number } = {}) =>
    authedRequest<Paged<Referral>>("GET", `/psychologist/referrals/sent/paged${pagedQuery(opts)}`),
  receivedReferralsPaged: (opts: { page?: number; size?: number; status?: string } = {}) =>
    authedRequest<Paged<Referral>>("GET", `/psychologist/referrals/received/paged${pagedQuery(opts)}`),
  /** Randevular səhifəsindəki nişan — baxılmamış yönləndirmə sayı. */
  receivedReferralsCountPending: () =>
    authedRequest<{ count?: number }>("GET", "/psychologist/referrals/received/count-pending")
      .then(r => r?.count ?? 0),
  acceptReferral: (id: number) =>
    authedRequest<Referral>("POST", `/psychologist/referrals/${id}/accept`),
  declineReferral: (id: number) =>
    authedRequest<Referral>("POST", `/psychologist/referrals/${id}/decline`),
  cancelReferral: (id: number) =>
    authedRequest<Referral>("POST", `/psychologist/referrals/${id}/cancel`),
};

export interface GoogleExternalEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status?: string | null;
  htmlLink?: string | null;
}

export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  calendarId?: string;
}

export interface PsychologistReceivedReview {
  id: number;
  patientId: number;
  patientName: string;
  rating: number;
  comment: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reply?: string | null;
  replyAt?: string | null;
  createdAt: string;
}

// ─── Homework / Resource / Template types ─────────────────────────────
export type HomeworkStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type HomeworkPriority = "LOW" | "MEDIUM" | "HIGH";
export type HomeworkLabelColor =
  "blue" | "red" | "green" | "yellow" | "purple" | "orange" | "pink" | "teal" | "gray";

export interface HomeworkChecklistItem {
  id: number;
  label: string;
  position: number;
  completed: boolean;
  completedAt?: string | null;
}
export interface HomeworkAttachment {
  id: number;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  contentType?: string | null;
  uploadedByRole: "PSYCHOLOGIST" | "PATIENT";
  uploadedByName?: string | null;
  createdAt: string;
}
export interface HomeworkLabel {
  id: number;
  label: string;
  color: HomeworkLabelColor;
}
export interface HomeworkComment {
  id: number;
  body: string;
  authorRole: "PSYCHOLOGIST" | "PATIENT";
  authorName?: string | null;
  authorUserId?: number | null;
  createdAt: string;
  editedAt?: string | null;
}
export interface HomeworkActivity {
  id: number;
  action: string;
  meta?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  createdAt: string;
}
export interface Homework {
  id: number;
  psychologistId: number;
  psychologistName: string;
  patientId: number;
  patientName: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: HomeworkStatus;
  priority: HomeworkPriority;
  position: number;
  completedAt?: string | null;
  completionNote?: string | null;
  createdAt: string;
  checklistTotal: number;
  checklistCompleted: number;
  checklist: HomeworkChecklistItem[];
  attachments: HomeworkAttachment[];
  labels: HomeworkLabel[];
  commentCount: number;
}
export interface FollowupTemplate {
  id: number; name: string; body: string; createdAt: string;
}

// ─── Psychologist stats / clients / notes types ──────────────────────────────
export interface PsychologistStats {
  thisMonthTotal: number;
  thisMonthCompleted: number;
  thisMonthCancelled: number;
  thisMonthConfirmed: number;
  thisWeekTotal: number;
  upcomingCount: number;
  activeClientsLast90Days: number;
  last30Days: { date: string; count: number }[];
  // Engagement metrics
  completionRatePct?: number | null;
  averageRating?: number | null;
  totalReviews?: number;
  returningClients?: number;
  returningClientsPct?: number | null;
  sessionHoursThisMonth?: number;
  weeklyStreak?: number;
  noShowsLast90Days?: number;
}

export interface ClientSummary {
  patientId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  totalSessions: number;
  completedSessions: number;
  noteCount: number;
  lastAppointmentAt?: string | null;
  autoFlag?: string | null;
  noShowCount: number;
  lateCancelCount: number;
}

export interface ClientNote {
  id: number;
  patientId: number;
  patientName: string;
  appointmentId?: number | null;
  title?: string | null;
  body: string;
  moodScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNotePayload {
  patientId: number;
  appointmentId?: number | null;
  title?: string | null;
  body: string;
  moodScore?: number | null;
}

export type PatientTagColor = "brand" | "good" | "warn" | "danger" | "neutral" | "purple" | "teal";
export interface PatientTag {
  id: number;
  patientId: number;
  label: string;
  color: PatientTagColor;
  createdAt: string;
}

export type PatientRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface PatientRisk {
  patientId: number;
  riskLevel: PatientRiskLevel | null;
  riskNote: string | null;
  riskSetAt: string | null;
  riskSetByName: string | null;
}

export type PatientGoalStatus = "OPEN" | "IN_PROGRESS" | "ACHIEVED" | "ABANDONED";
export interface PatientGoal {
  id: number;
  patientId: number;
  psychologistId: number;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: PatientGoalStatus;
  progressPct: number;
  createdAt: string;
  updatedAt: string;
  achievedAt: string | null;
}
export interface PatientGoalPayload {
  title: string;
  description?: string | null;
  targetDate?: string | null;
  status?: PatientGoalStatus;
  progressPct?: number;
}
export interface PatientGoalView {
  id: number;
  psychologistId: number | null;
  psychologistName: string | null;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: PatientGoalStatus;
  progressPct: number;
  createdAt: string;
  updatedAt: string;
  achievedAt: string | null;
}

export interface Vacation {
  id: number;
  psychologistId: number;
  startDate: string;        // ISO date (YYYY-MM-DD)
  endDate: string;          // inclusive
  reason: string | null;
  notifyPatients: boolean;
  cancelledAt: string | null;
  createdAt: string;
  affectedAppointments: number;
}

/** GAP-05: vacation creation result — conflicts must be resolved first. */
export interface VacationCreateResult {
  created: boolean;
  vacation: Vacation | null;
  conflicts: AppointmentDetail[];
}

export type RescheduleStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface RescheduleProposalOption {
  index: number;
  startAt: string;
  endAt: string;
}

export type BookingFrequency = "WEEKLY" | "BIWEEKLY";

export interface BookingSeries {
  id: number;
  patientId: number;
  requestedPsychologistId: number | null;
  requestedPsychologistName: string | null;
  /** null for basket-created groups (V56). */
  frequency: BookingFrequency | null;
  totalCount: number;
  cancelledAt: string | null;
  cancelRequestedAt?: string | null;
  cancelRequestReasonCode?: string | null;
  cancelRequestReasonText?: string | null;
  createdAt: string;
  createdAppointments: number;
  skippedOccurrences: number;
  appointmentIds: number[];
  skippedDates: string[];
}

// ─── Basket booking (FAZA B1) ────────────────────────────────────────────────

export interface BasketSlotConflict {
  slot: string;
  /** Up to 3 free slots within ±2 days, closest first. */
  alternatives: string[];
}

export interface BasketResult {
  seriesId: number | null;
  createdAppointmentIds: number[];
  createdSlots: string[];
  conflicts: BasketSlotConflict[];
}

export interface RepeatCheckEntry {
  date: string;
  free: boolean;
  alternatives: string[];
}

export interface SessionFeedback {
  id: number;
  appointmentId: number;
  psychologistId: number | null;
  psychologistName: string | null;
  patientId: number;
  patientName: string;
  rating: number;
  comment: string | null;
  followUpNeeded: boolean;
  operatorSeenAt: string | null;
  createdAt: string;
  appointmentStartAt: string | null;
}

export interface FeedbackTriageResponse {
  content: SessionFeedback[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  unseenFollowUpCount: number;
  lowRatingCount: number;
}

export interface PsychologistFeedbackSummary {
  psychologistId: number;
  psychologistName: string;
  totalCount: number;
  avgRating: number;
  unseenFollowUpCount: number;
  lowRatingCount: number;
  lastFeedbackAt: string | null;
}

export interface RescheduleProposal {
  id: number;
  appointmentId: number;
  psychologistId: number;
  psychologistName: string | null;
  patientUserId: number | null;
  reason: string | null;
  status: RescheduleStatus;
  initiator: "PSYCHOLOGIST" | "PATIENT";
  expiresAt: string;
  acceptedOption: number | null;
  decidedAt: string | null;
  newAppointmentId: number | null;
  createdAt: string;
  options: RescheduleProposalOption[];
  originalStartAt: string | null;
  originalEndAt: string | null;
  patientName: string | null;
}

// ─── Operator API (also accessible to ADMIN) ──────────────────────────────────
export interface OperatorAssignPayload {
  psychologistId: number;
  startAt: string; // ISO
  endAt: string;   // ISO
  operatorNote?: string | null;
}

export interface SlotAllowance {
  maxSlots: number;            // neçə slot seçilə bilər (paket yoxdursa 1)
  packageName: string | null;  // paket adı (varsa)
  remainingSessions: number | null;
}

export interface PsychologistSuggestion {
  psychologistId: number;
  name: string;
  title: string;
  score: number;
  reasons: string[];
  upcomingLoad: number;
}

export interface PatientHistory {
  patientId: number;
  userId?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  blocked: boolean;
  blockReason?: string | null;
  totalAppointments: number;
  rejectedCount: number;
  cancelledCount: number;
  // OP-1: reputation counters from the user account
  noShowCount: number;
  lateCancelCount: number;
  autoFlag?: "HIGH_NO_SHOW" | "HIGH_LATE_CANCEL" | "HIGH_REJECT" | null;
  registeredAt?: string | null;
  recent: { id: number; status: string; psychologistName?: string | null; startAt?: string | null; createdAt?: string | null; note?: string | null }[];
  // Modul G — təcili əlaqə + yaşayış ünvanı (decrypt olunmuş, operator/admin)
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  residentialAddress?: string | null;
}

export interface ContactLog {
  id: number;
  appointmentId: number;
  channel: "CALL" | "SMS" | "EMAIL" | "WHATSAPP" | "OTHER";
  outcome: "ANSWERED" | "NO_ANSWER" | "BUSY" | "REFUSED" | "RESCHEDULED" | "OTHER";
  note?: string | null;
  operatorName: string;
  createdAt: string;
}

export interface OperatorStats {
  pendingNow: number;
  unansweredOver24h: number;
  slaOverdueCount: number;
  slaHours: number;
  staleDisputedCount: number;
  disputeTimeoutHours: number;
  crisisUnackedCount: number;
  assignedToday: number;
  completedThisMonth: number;
  rejectedThisMonth: number;
  totalThisMonth: number;
  assignedThisMonth: number;
  avgResponseMinutes: number | null;
  rejectionRatePct: number | null;
  conversionRatePct: number | null;
  last30Days: { date: string; incoming: number; assigned: number; rejected: number }[];
  psyConcerns: PsychologistConcern[];
  patientsNeedingAttention: PatientFlagged[];
  perOperator: OperatorBreakdown[];
}
export interface PsychologistConcern {
  psychologistId: number;
  name: string;
  received: number;
  rejected: number;
  rejectionRatePct: number | null;
  avgConfirmMinutes: number | null;
}
export interface PatientFlagged {
  patientId: number;
  name: string;
  reason: string;
  noShowCount: number;
  lateCancelCount: number;
  rejectCount: number;
  lastIncidentAt: string | null;
}
export interface OperatorBreakdown {
  operatorId: number;
  name: string;
  assignedCount: number;
  avgResponseMinutes: number | null;
}

// ─── OP-1/OP-2: operator ticket detail page + soft-lock claim ─────────────────

/** One row of the unified activity feed (audit + contact logs + notes). */
export interface OperatorActivityItem {
  kind: "CREATED" | "AUDIT" | "NOTE" | "CONTACT";
  action?: string | null;
  channel?: ContactLog["channel"] | null;
  outcome?: ContactLog["outcome"] | null;
  text?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface SeriesSibling {
  id: number;
  seriesIndex?: number | null;
  status: string;
  startAt?: string | null;
}

export interface ClaimState {
  appointmentId: number;
  claimedByUserId?: number | null;
  claimedByName?: string | null;
  claimedAt?: string | null;
  mine: boolean;
  ttlMinutes: number;
}

export interface ClaimEvent {
  event: "CLAIMED" | "RELEASED" | "STOLEN";
  appointmentId: number;
  claimedByUserId?: number | null;
  claimedByName?: string | null;
  claimedAt?: string | null;
}

export interface OperatorAppointmentFull {
  appointment: AppointmentDetail;
  patientHistory?: PatientHistory | null;
  activity: OperatorActivityItem[];
  seriesSiblings: SeriesSibling[];
  suggestions: PsychologistSuggestion[];
  slaHours: number;
  claim: ClaimState;
}

// Modul H — operator müştəri profili + psixoloq statistikası + analitika
export interface CustomerProfile {
  history: PatientHistory;
  lastLogin?: string | null;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  appointments: PatientHistory["recent"];
  payments: { id: number; amount: number; currency: string; status: string; method: string; paidAt?: string | null; createdAt?: string | null; patientPackageId?: number | null; appointmentId?: number | null; patientName?: string | null; refundedAmount?: number | null; statusNote?: string | null }[];
  packages: { id: number; psychologistId?: number | null; psychologistName?: string | null; packageName: string; total: number; remaining: number; status: string; pricePaid?: number | null; currency?: string | null; purchasedAt?: string | null }[];
  testResults: { assignmentId: number; resultId?: number | null; testTitle: string; status: string; totalScore?: number | null; maxScore?: number | null; percentage?: number | null; scaleLabel?: string | null; submittedAt?: string | null }[];
  reviewsGiven: { id: number; psychologistName?: string | null; rating: number; comment?: string | null; status: string; createdAt?: string | null }[];
  activity: { type: "AUDIT" | "SUPPORT" | "APPOINTMENT" | "TEST"; action?: string | null; summary?: string | null; at: string }[];
}
/** Operator müştəri qeydi — zəng/izləmə/müşahidə (Müştəri 360 "Operator qeydləri"). */
export interface CustomerNote {
  id: number;
  text: string;
  authorName?: string | null;
  createdAt: string;
}
export interface OperatorPsychologistStat {
  psychologistId: number;
  name: string;
  totalSessions: number;
  fanusSessions: number;
  currentMonthSessions: number;
  completedCount: number;
  cancelledCount: number;
  activePatients: number;
  newPatientsThisMonth: number;
  averageRating?: number | null;
  totalReviews: number;
  packagesSold: number;
  revenue?: number | null;
  joinedAt?: string | null;
  rankingScore?: number | null;
  psychologistType?: string | null;
  statsSource?: string | null;
  monthlyDynamics: { month: string; total: number; completed: number; cancelled: number }[];
  // ─── Operator idarəetməsi: əlaqə + status + qiymət + risk + əlçatanlıq ───
  phone?: string | null;
  email?: string | null;
  active: boolean;
  suspendedAt?: string | null;
  suspendReason?: string | null;
  individualPrice?: number | null;
  currency?: string | null;
  commissionPercent?: number | null;
  rejectionRatePct?: number | null;
  avgConfirmMinutes?: number | null;
  next7FullnessPct?: number | null;
  next7Booked: number;
  next7FreeSlots: number;
}
/** Operator psixoloq qeydi — zəng/izləmə/müşahidə (Psixoloq 360 "Operator qeydləri"). */
export interface PsychologistNote {
  id: number;
  text: string;
  authorName?: string | null;
  createdAt: string;
}
export interface PsychologistVacation {
  id: number;
  psychologistId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
  notifyPatients: boolean;
  cancelledAt?: string | null;
  createdAt: string;
}
export interface AnalyticsTimePoint { bucket: string; incoming: number; assigned: number; completed: number; cancelled: number; revenue?: number | null }
export interface RevenueBreakdown {
  packageRevenue: number;
  singleRevenue: number;
  byPsychologist: { psychologistId: number; name: string; revenue: number }[];
}
export interface PsychologistRankItem {
  psychologistId: number; name: string; completedSessions: number; fanusSessions: number;
  activePatients: number; rankingScore?: number | null; psychologistType?: string | null;
  phone?: string | null; email?: string | null;
  individualPrice?: number | null; currency?: string | null;
  active: boolean; suspendedAt?: string | null;
  rejectionRatePct?: number | null; onVacationToday: boolean;
}
export type AnalyticsPeriod = "daily" | "weekly" | "monthly" | "yearly";

export const operatorApi = {
  listAppointments: () => authedRequest<AppointmentDetail[]>("GET", "/operator/appointments"),
  /** Səhifələnmiş triyaj siyahısı — status (tək) + q (pasiyent/psixoloq adı). */
  listAppointmentsPaged: (opts: { page?: number; size?: number; status?: string; q?: string } = {}) =>
    authedRequest<Paged<AppointmentDetail>>("GET", `/operator/appointments/paged${pagedQuery(opts)}`),
  /** Pool — sahibsiz yeni müraciətlər (tam siyahı əvəzinə məqsədli sorğu). */
  listPoolAppointments: () =>
    authedRequest<AppointmentDetail[]>("GET", "/operator/appointments/pool"),
  /** Müştərilər səhifəsi — son aktiv N pasiyentin randevuları. */
  listRecentCustomerAppointments: (patients = 30) =>
    authedRequest<AppointmentDetail[]>("GET", `/operator/appointments/recent-customers?patients=${patients}`),
  // ─── Psixoloqlar arası yönləndirmə təsdiqi ───────────────────────────────
  pendingReferrals: () => authedRequest<Referral[]>("GET", "/operator/referrals"),
  referral: (id: number) => authedRequest<Referral>("GET", `/operator/referrals/${id}`),
  approveReferral: (id: number) =>
    authedRequest<Referral>("POST", `/operator/referrals/${id}/approve`),
  rejectReferral: (id: number, note?: string) =>
    authedRequest<Referral>("POST", `/operator/referrals/${id}/reject`, { note }),
  /** OP-1: everything the detail page needs in one request. */
  fullAppointment: (id: number) =>
    authedRequest<OperatorAppointmentFull>("GET", `/operator/appointments/${id}/full`),
  /** OP-1: operator note → activity feed. */
  addNote: (appointmentId: number, text: string) =>
    authedRequest<OperatorActivityItem>("POST", `/operator/appointments/${appointmentId}/notes`, { text }),
  // Pool sahibliyi: pooldan götür / pool-a burax / (admin) başqasına keçir
  claim: (id: number) =>
    authedRequest<ClaimState>("POST", `/operator/appointments/${id}/claim`),
  claimRelease: (id: number) =>
    authedRequest<ClaimState>("POST", `/operator/appointments/${id}/claim/release`),
  /** Status dəyişikliyi aparılmış müraciət üçün hovuza buraxma tələbi (Admin təsdiqinə gedir). */
  releaseRequest: (id: number, reason?: string) =>
    authedRequest<PoolReleaseRequestItem>("POST", `/operator/appointments/${id}/release-request`, { reason }),
  reassignAppointment: (id: number, operatorId: number) =>
    authedRequest<ClaimState>("POST", `/operator/appointments/${id}/reassign`, { operatorId }),
  /** Admin reassign dropdown üçün operator siyahısı. */
  listOperators: () =>
    authedRequest<{ id: number; name: string }[]>("GET", "/operator/operators"),
  // Çoxlu vaxt (paket / seriya) təyini + paket balansı
  slotAllowance: (id: number, psychologistId: number) =>
    authedRequest<SlotAllowance>("GET", `/operator/appointments/${id}/slot-allowance?psychologistId=${psychologistId}`),
  assignSlots: (id: number, data: { psychologistId: number; slots: { startAt: string; endAt: string }[]; operatorNote?: string | null; sessionPrice?: number | null }) =>
    authedRequest<AppointmentDetail[]>("POST", `/operator/appointments/${id}/assign-slots`, data),
  // Modul B: seans görüş linki idarəetməsi
  pendingMeetingLinks: () =>
    authedRequest<AppointmentDetail[]>("GET", "/operator/meeting-links/pending"),
  setMeetingLink: (id: number, meetingLink: string) =>
    authedRequest<AppointmentDetail>("PUT", `/operator/appointments/${id}/meeting-link`, { meetingLink }),
  revokeMeetingLink: (id: number) =>
    authedRequest<AppointmentDetail>("DELETE", `/operator/appointments/${id}/meeting-link`),
  sendMeetingLink: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/meeting-link/send`),
  meetingLinkHistory: (id: number) =>
    authedRequest<MeetingLinkLogItem[]>("GET", `/operator/appointments/${id}/meeting-link/history`),
  // Modul A — manual ödəniş idarəsi. Sahiblik ödənişin bağlı olduğu seansdan/paketdən
  // törəyir (ayrıca ödəniş pool-u yoxdur) — mine=true → yalnız mənim götürdüklərim.
  listPendingPayments: (status = "PENDING", mine = false) =>
    authedRequest<PaymentItem[]>("GET", `/operator/payments?status=${status}${mine ? "&mine=true" : ""}`),
  listPaymentsPaged: (opts: { page?: number; size?: number; status?: string; mine?: boolean } = {}) =>
    authedRequest<Paged<PaymentItem>>("GET",
      `/operator/payments/paged${pagedQuery({ page: opts.page, size: opts.size, status: opts.status, mine: opts.mine ? "true" : undefined })}`),
  markPaymentPaid: (id: number) =>
    authedRequest<PaymentItem>("POST", `/operator/payments/${id}/mark-paid`),
  paymentsSummary: () =>
    authedRequest<PaymentSummary>("GET", "/operator/payments/summary"),
  cancelPayment: (id: number, reason: string) =>
    authedRequest<PaymentItem>("POST", `/operator/payments/${id}/cancel`, { reason }),
  /** İadə tələbi yaradır — icra Admin təsdiqindən sonra (OP-BR-07). */
  refundPayment: (id: number, amount: number, reason: string) =>
    authedRequest<RefundRequestItem>("POST", `/operator/payments/${id}/refund`, { amount, reason }),
  listRefundRequests: (status?: string) =>
    authedRequest<RefundRequestItem[]>("GET", `/operator/refund-requests${status ? `?status=${status}` : ""}`),
  listRefundRequestsPaged: (opts: { page?: number; size?: number; status?: string } = {}) =>
    authedRequest<Paged<RefundRequestItem>>("GET", `/operator/refund-requests/paged${pagedQuery(opts)}`),
  // Randevuya bağlı ödəniş qeydi yoxdursa (təyin zamanı qiymət daxil edilməyib) əl ilə yarat
  createManualPayment: (appointmentId: number, amount: number, currency = "AZN") =>
    authedRequest<PaymentItem>("POST", `/operator/appointments/${appointmentId}/payment`, { amount, currency }),
  // Operator paket satışı (kataloq + xüsusi) → PENDING ödəniş
  psychologistPackages: (psychologistId: number) =>
    authedRequest<PackageDto[]>("GET", `/operator/psychologists/${psychologistId}/packages`),
  sellPackage: (patientId: number, data: {
    sessionPackageId?: number | null;
    psychologistId?: number | null;
    packageName?: string | null;
    sessionCount?: number | null;
    price?: number | null;
    currency?: string | null;
    patientChoseDirectly?: boolean;
  }) => authedRequest<PatientPackageItem>("POST", `/operator/patients/${patientId}/packages`, data),
  // Operator tək seans satışı (paketsiz) → seans bron + PENDING ödəniş (seansa bağlı)
  sellSingleSession: (patientId: number, data: {
    psychologistId: number;
    price: number;
    startAt: string;
    endAt: string;
    currency?: string | null;
    note?: string | null;
    patientChoseDirectly?: boolean;
  }) => authedRequest<{ paymentId: number; amount: number; currency: string; status: string }>(
    "POST", `/operator/patients/${patientId}/single-session`, data),
  // Operator paket seansını pasiyent adına planlayır (balansdan sərf → CONFIRMED seans)
  schedulePackageSession: (patientId: number, packageId: number, data: { startAt: string; endAt?: string | null; note?: string | null; psychologistId?: number | null }) =>
    authedRequest<AppointmentDetail>("POST", `/operator/patients/${patientId}/packages/${packageId}/schedule`, data),
  cancel: (id: number, reasonCode: string, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/cancel`, { reasonCode, note }),
  approveCancelRequest: (id: number, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/approve-cancel`, { note }),
  rejectCancelRequest: (id: number, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/reject-cancel`, { note }),
  approveSeriesCancelRequest: (id: number, note?: string) =>
    authedRequest<BookingSeries>("POST", `/operator/booking-series/${id}/approve-cancel`, { note }),
  rejectSeriesCancelRequest: (id: number, note?: string) =>
    authedRequest<BookingSeries>("POST", `/operator/booking-series/${id}/reject-cancel`, { note }),
  // Operator seriyanı bütöv idarə edir
  cancelSeries: (id: number, note?: string) =>
    authedRequest<BookingSeries>("POST", `/operator/booking-series/${id}/cancel`, { note }),
  rescheduleSeries: (id: number, newFirstStartAt: string) =>
    authedRequest<BookingSeries>("POST", `/operator/booking-series/${id}/reschedule`, { newFirstStartAt }),
  resolveDispute: (
    id: number,
    decision: "COMPLETE" | "CANCEL",
    note?: string,
    blameSide?: "PATIENT" | "PSYCHOLOGIST"
  ) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/resolve-dispute`, { decision, note, blameSide }),

  /** Retroactively mark a held/auto-completed session as a no-show (bumps the
   *  no-show counter for the blamed side). Replaces the old dispute flow. */
  markNoShow: (
    id: number,
    blameSide: "PATIENT" | "PSYCHOLOGIST",
    note?: string
  ) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/no-show`, { blameSide, note }),

  // Session feedback triage
  feedbackTriage: (params: {
    onlyFollowUp?: boolean; onlyUnseen?: boolean;
    minRating?: number; maxRating?: number;
    page?: number; size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.onlyFollowUp) q.set("onlyFollowUp", "true");
    if (params.onlyUnseen)   q.set("onlyUnseen", "true");
    if (params.minRating !== undefined) q.set("minRating", String(params.minRating));
    if (params.maxRating !== undefined) q.set("maxRating", String(params.maxRating));
    if (params.page !== undefined) q.set("page", String(params.page));
    if (params.size !== undefined) q.set("size", String(params.size));
    const qs = q.toString();
    return authedRequest<FeedbackTriageResponse>("GET", `/operator/feedback${qs ? `?${qs}` : ""}`);
  },
  feedbackMarkSeen: (id: number) =>
    authedRequest<SessionFeedback>("POST", `/operator/feedback/${id}/seen`),
  feedbackByPsychologist: () =>
    authedRequest<PsychologistFeedbackSummary[]>("GET", "/operator/feedback/by-psychologist"),
  feedbackForPsychologist: (psychologistId: number) =>
    authedRequest<SessionFeedback[]>("GET", `/operator/feedback/psychologist/${psychologistId}`),

  listPsychologists: () => authedRequest<Psychologist[]>("GET", "/operator/psychologists"),
  availability: (psychologistId: number, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return authedRequest<AvailableSlot[]>(
      "GET", `/operator/psychologists/${psychologistId}/availability${qs ? "?" + qs : ""}`);
  },

  // Slots management for any psychologist (also used by /admin pages)
  psyTimeSlots: (psychologistId: number) =>
    authedRequest<TimeSlot[]>("GET", `/operator/psychologists/${psychologistId}/time-slots`),
  createPsyTimeSlot: (psychologistId: number, data: { dayOfWeek: number; startTime: string; endTime: string; active?: boolean }) =>
    authedRequest<TimeSlot>("POST", `/operator/psychologists/${psychologistId}/time-slots`, data),
  updatePsyTimeSlot: (psychologistId: number, slotId: number, data: { dayOfWeek: number; startTime: string; endTime: string; active?: boolean }) =>
    authedRequest<TimeSlot>("PUT", `/operator/psychologists/${psychologistId}/time-slots/${slotId}`, data),
  deletePsyTimeSlot: (psychologistId: number, slotId: number) =>
    authedRequest<void>("DELETE", `/operator/psychologists/${psychologistId}/time-slots/${slotId}`),

  psyOverrides: (psychologistId: number) =>
    authedRequest<TimeSlotOverride[]>("GET", `/operator/psychologists/${psychologistId}/time-slot-overrides`),
  createPsyOverride: (psychologistId: number, data: {
    overrideDate: string; overrideType: "BLOCK" | "EXTRA";
    startTime?: string; endTime?: string; note?: string;
  }) => authedRequest<TimeSlotOverride>("POST", `/operator/psychologists/${psychologistId}/time-slot-overrides`, data),
  deletePsyOverride: (psychologistId: number, overrideId: number) =>
    authedRequest<void>("DELETE", `/operator/psychologists/${psychologistId}/time-slot-overrides/${overrideId}`),

  // Bulk + suggest + history + contact log + block + stats
  bulkAssign: (appointmentIds: number[], assignment: OperatorAssignPayload) =>
    authedRequest<AppointmentDetail[]>("POST", "/operator/appointments/bulk-assign", { appointmentIds, assignment }),
  suggest: (appointmentId: number, limit = 5) =>
    authedRequest<PsychologistSuggestion[]>("GET", `/operator/appointments/${appointmentId}/suggest?limit=${limit}`),
  patientHistory: (patientId: number) =>
    authedRequest<PatientHistory>("GET", `/operator/patients/${patientId}/history`),
  // Modul H — analitika
  customerProfile: (patientId: number) =>
    authedRequest<CustomerProfile>("GET", `/operator/customers/${patientId}`),
  customerActivity: (patientId: number) =>
    authedRequest<CustomerProfile["activity"]>("GET", `/operator/customers/${patientId}/activity`),
  customerNotes: (patientId: number) =>
    authedRequest<CustomerNote[]>("GET", `/operator/customers/${patientId}/notes`),
  addCustomerNote: (patientId: number, text: string) =>
    authedRequest<CustomerNote>("POST", `/operator/customers/${patientId}/notes`, { text }),
  psychologistStats: (id: number) =>
    authedRequest<OperatorPsychologistStat>("GET", `/operator/psychologists/${id}/stats`),
  psychologistVacations: (id: number) =>
    authedRequest<PsychologistVacation[]>("GET", `/operator/psychologists/${id}/vacations`),
  setPsychologistPricing: (id: number, individualPrice: number) =>
    authedRequest<{ individualPrice: number | null; currency: string }>("PUT", `/operator/psychologists/${id}/pricing`, { individualPrice }),
  createPsychologistPackage: (id: number, data: PackageReq) =>
    authedRequest<PackageDto>("POST", `/operator/psychologists/${id}/packages`, data),
  updatePsychologistPackage: (id: number, packageId: number, data: PackageReq) =>
    authedRequest<PackageDto>("PUT", `/operator/psychologists/${id}/packages/${packageId}`, data),
  deletePsychologistPackage: (id: number, packageId: number) =>
    authedRequest<void>("DELETE", `/operator/psychologists/${id}/packages/${packageId}`),
  psychologistPriceHistory: (id: number) =>
    authedRequest<PriceChangeLogItem[]>("GET", `/operator/psychologists/${id}/price-history`),
  psychologistNotes: (id: number) =>
    authedRequest<PsychologistNote[]>("GET", `/operator/psychologists/${id}/notes`),
  addPsychologistNote: (id: number, text: string) =>
    authedRequest<PsychologistNote>("POST", `/operator/psychologists/${id}/notes`, { text }),
  analyticsSessions: (period: AnalyticsPeriod = "daily") =>
    authedRequest<AnalyticsTimePoint[]>("GET", `/operator/analytics/sessions?period=${period}`),
  psychologistRanking: () =>
    authedRequest<PsychologistRankItem[]>("GET", "/operator/analytics/psychologists/ranking"),
  analyticsRevenue: () =>
    authedRequest<RevenueBreakdown>("GET", "/operator/analytics/revenue"),
  contactLogs: (appointmentId: number) =>
    authedRequest<ContactLog[]>("GET", `/operator/appointments/${appointmentId}/contact-logs`),
  addContactLog: (appointmentId: number, data: { channel: string; outcome: string; note?: string }) =>
    authedRequest<ContactLog>("POST", `/operator/appointments/${appointmentId}/contact-logs`, data),
  blockUser: (userId: number, reason?: string) =>
    authedRequest<void>("POST", `/operator/users/${userId}/block`, { reason }),
  unblockUser: (userId: number) =>
    authedRequest<void>("POST", `/operator/users/${userId}/unblock`),
  stats: () => authedRequest<OperatorStats>("GET", "/operator/stats"),
  crisisCheckIns: () => authedRequest<OperatorCrisisCheckIn[]>("GET", "/operator/crisis/check-ins"),
  /** GAP-07: mark a high-risk check-in as seen (idempotent). */
  acknowledgeCrisisCheckIn: (id: number) =>
    authedRequest<OperatorCrisisCheckIn>("POST", `/operator/crisis/check-ins/${id}/acknowledge`),
  search: (q: string, limit = 10) =>
    authedRequest<OperatorSearchResponse>(
      "GET",
      `/operator/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  /** On-behalf booking: create (or reuse) a patient by email, then book directly. */
  createPatient: (data: { firstName?: string; lastName?: string; phone?: string; email: string }) =>
    authedRequest<{ patientId: number }>("POST", "/operator/patients", data),
  createOnBehalf: (data: {
    patientId: number; psychologistId: number; startAt: string; endAt: string; note?: string;
    patientPackageId?: number | null; patientChoseDirectly?: boolean;
    sessionKind?: "STANDARD" | "INTRO" | null;
  }) =>
    authedRequest<AppointmentDetail>("POST", "/operator/appointments/on-behalf", data),

  // ─── Pulsuz tanışlıq (INTRO) görüşü — 2-ci seans icazəsi ─────────────────
  freeIntroStatus: (patientId: number) =>
    authedRequest<IntroEligibility>("GET", `/operator/patients/${patientId}/free-intro-status`),
  setFreeIntroPermission: (patientId: number, allowed: boolean) =>
    authedRequest<IntroEligibility>("PUT", `/operator/patients/${patientId}/free-intro-permission`, { allowed }),

  // ─── Seans müraciətləri ───────────────────────────────────────────────────
  listSessionRequests: (status?: string) =>
    authedRequest<SessionRequest[]>("GET", `/operator/session-requests${status ? `?status=${status}` : ""}`),
  sessionRequestCountNew: () =>
    authedRequest<{ count?: number }>("GET", "/operator/session-requests/count-new").then(r => r?.count ?? 0),
  getSessionRequest: (id: number) =>
    authedRequest<SessionRequest>("GET", `/operator/session-requests/${id}`),
  scheduleSessionRequest: (id: number, data: {
    psychologistId: number;
    scheduledDate: string;
    scheduledTime?: string | null;
    sessionPackage?: string | null;
    operatorNote?: string | null;
  }) => authedRequest<SessionRequest>("POST", `/operator/session-requests/${id}/schedule`, data),
  updateSessionRequestStatus: (id: number, data: { status: string; operatorNote?: string | null }) =>
    authedRequest<SessionRequest>("PATCH", `/operator/session-requests/${id}/status`, data),
  sessionRequestsPoolPaged: (opts: { status?: string; page?: number; size?: number } = {}) =>
    authedRequest<Paged<SessionRequest>>("GET", `/operator/session-requests/pool/paged${pagedQuery(opts)}`),
  sessionRequestsMinePaged: (opts: { status?: string; page?: number; size?: number } = {}) =>
    authedRequest<Paged<SessionRequest>>("GET", `/operator/session-requests/mine/paged${pagedQuery(opts)}`),
  claimSessionRequest: (id: number) =>
    authedRequest<SessionRequestClaimState>("POST", `/operator/session-requests/${id}/claim`),
  releaseSessionRequest: (id: number) =>
    authedRequest<SessionRequestClaimState>("POST", `/operator/session-requests/${id}/release`),
  convertSessionRequestToAppointment: (id: number, data: {
    psychologistId: number; startAt: string; endAt?: string | null; note?: string | null;
    patientChoseDirectly?: boolean;
  }) => authedRequest<SessionRequest>("POST", `/operator/session-requests/${id}/convert-to-appointment`, data),
  convertSessionRequestToPackage: (id: number, data: {
    sessionPackageId?: number | null; psychologistId?: number | null; packageName?: string | null;
    sessionCount?: number | null; price?: number | null; currency?: string | null;
    patientChoseDirectly?: boolean;
  }) => authedRequest<SessionRequest>("POST", `/operator/session-requests/${id}/convert-to-package`, data),

  // ─── Tələblər modulu: Rəy Silmə Tələbləri (Operator BRD §10) ──────────────
  listReviewDeletionRequests: (status?: string) =>
    authedRequest<ReviewDeletionRequestItem[]>("GET", `/operator/review-deletion-requests${status ? `?status=${status}` : ""}`),
  listReviewDeletionRequestsPaged: (opts: { page?: number; size?: number; status?: string } = {}) =>
    authedRequest<Paged<ReviewDeletionRequestItem>>("GET", `/operator/review-deletion-requests/paged${pagedQuery(opts)}`),
  reviewDeletionCountPending: () =>
    authedRequest<{ count?: number }>("GET", "/operator/review-deletion-requests/count-pending")
      .then(r => r?.count ?? 0),
  approveReviewDeletion: (id: number, note?: string) =>
    authedRequest<ReviewDeletionRequestItem>("POST", `/operator/review-deletion-requests/${id}/approve`, { note }),
  rejectReviewDeletion: (id: number, note?: string) =>
    authedRequest<ReviewDeletionRequestItem>("POST", `/operator/review-deletion-requests/${id}/reject`, { note }),

  // ─── Hesabat exportu (OP-FR-14/15) ────────────────────────────────────────
  downloadReport: async (format: "xlsx" | "pdf", from?: string, to?: string) => {
    const q = new URLSearchParams({ format });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const res = await fetch(`${BASE}/operator/reports/export?${q}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Hesabat yüklənmədi (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operator-hesabat.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export interface SessionRequest {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  reason: string;
  preferredDate: string | null;
  preferredTime: string | null;
  notes: string | null;
  budget: string | null;
  priority: boolean;
  crisisDetected: boolean;
  status: "NEW" | "IN_REVIEW" | "SCHEDULED" | "CANCELLED" | "CONVERTED";
  assignedPsychologistId: number | null;
  assignedPsychologistName: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  sessionPackage: string | null;
  operatorNote: string | null;
  handledAt: string | null;
  claimedByUserId: number | null;
  claimedByName: string | null;
  claimedAt: string | null;
  convertedPatientId: number | null;
  convertedAppointmentId: number | null;
  convertedPackageId: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SessionRequestClaimState {
  requestId: number;
  claimedByUserId: number | null;
  claimedByName: string | null;
  claimedAt: string | null;
  mine: boolean;
}

export async function submitSessionRequest(data: {
  name: string;
  phone: string;
  email?: string;
  age?: number;
  reason: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  budget?: string;
}): Promise<SessionRequest> {
  const res = await fetch(`${BASE}/session-requests`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const msg = (e as { message?: string; error?: string }).message ?? (e as { error?: string }).error;
    throw new Error(msg ?? `Müraciət göndərilmədi (${res.status})`);
  }
  return res.json();
}

export interface OperatorSearchHit {
  type: "PATIENT" | "PSYCHOLOGIST" | "APPOINTMENT";
  id: number;
  title: string;
  subtitle: string;
  href: string;
}
export interface OperatorSearchResponse {
  patients: OperatorSearchHit[];
  psychologists: OperatorSearchHit[];
  appointments: OperatorSearchHit[];
}

export interface CrisisCheckIn {
  id: number;
  moodScore: number;
  note: string | null;
  createdAt: string;
}
export interface CrisisHotline {
  name: string;
  description: string;
  phone: string;
  hours: string;
  alwaysOpen: boolean;
}
export interface CrisisContactPsy {
  userId: number | null;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}
export interface CrisisStatus {
  riskLevel: PatientRiskLevel | null;
  recentCheckIns: CrisisCheckIn[];
  hotlines: CrisisHotline[];
  myPsychologist: CrisisContactPsy | null;
  supportOperator: CrisisContactPsy;
}
export interface OperatorCrisisCheckIn {
  id: number;
  patientId: number;
  patientName: string;
  riskLevel: PatientRiskLevel | null;
  moodScore: number;
  note: string | null;
  createdAt: string;
  // GAP-07: quick contact + acknowledgement state
  patientPhone: string | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
}
