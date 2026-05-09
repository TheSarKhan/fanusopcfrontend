import { storeUser, clearUser, isTokenExpiringSoon, isTokenExpired, getMainSiteUrl, decodeAccessToken } from "./auth";
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

async function get<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 30 },
    credentials: "include",
    headers: { ...localeHeaders(), ...(opts?.headers as Record<string, string> | undefined) },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

function cookieDomain(): string {
  if (typeof window === "undefined") return "localhost";
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return "localhost";
  const parts = hostname.split(".");
  return parts.length >= 2 ? `.${parts.slice(-2).join(".")}` : hostname;
}

function readTokenCookie(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setTokenCookie(token: string) {
  const domain = cookieDomain();
  // Match cookie lifetime to actual JWT lifetime (with a tiny safety floor).
  const payload = decodeAccessToken(token);
  const nowSec = Math.floor(Date.now() / 1000);
  const maxAge = payload?.exp ? Math.max(60, payload.exp - nowSec) : 3600;
  document.cookie = `accessToken=${encodeURIComponent(token)}; domain=${domain}; path=/; SameSite=Lax; max-age=${maxAge}`;
}

function clearTokenCookie() {
  const domain = cookieDomain();
  document.cookie = `accessToken=; domain=${domain}; path=/; max-age=0`;
}

function getAccessToken(): string | null {
  return (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null)
    ?? readTokenCookie();
}

// "ok"         — refreshed successfully
// "auth_failure" — refresh token invalid/expired → must log out
// "network_error" — server unreachable, transient → do NOT log out
export type RefreshOutcome = "ok" | "auth_failure" | "network_error";

export function clearSession() {
  clearUser();
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  clearTokenCookie();
  // Notify module-level caches (favourites, etc.) to drop user-scoped state.
  try { window.dispatchEvent(new Event("fanus:session-cleared")); } catch { /* ignore */ }
}

export function redirectToLogin() {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = `${getMainSiteUrl()}/login?session=expired`;
  }
}

async function _doRefresh(): Promise<RefreshOutcome> {
  const storedRefresh = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // Send body token if available; backend falls back to HTTP-only cookie otherwise
      body: storedRefresh ? JSON.stringify({ refreshToken: storedRefresh }) : JSON.stringify({}),
    });

    if (res.status === 401 || res.status === 403) {
      // Another tab may have already rotated the token. Check localStorage first,
      // then briefly poll (up to 1s) in case the other tab's response is in-flight.
      for (let i = 0; i < 5; i++) {
        const existing = getAccessToken();
        if (existing && !isTokenExpired(existing)) return "ok";
        await new Promise(r => setTimeout(r, 200));
      }
      return "auth_failure";
    }
    if (!res.ok) return "network_error";

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      setTokenCookie(data.accessToken);
    }
    if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
    if (data.userId) {
      storeUser({ userId: data.userId, email: data.email, role: data.role, firstName: data.firstName, lastName: data.lastName });
    }
    return "ok";
  } catch {
    return "network_error";
  }
}

// In-tab singleton — first line of defence against parallel refresh in the same tab.
let _refreshPromise: Promise<RefreshOutcome> | null = null;

// Cross-tab mutex via the Web Locks API. Only one tab refreshes at a time;
// other tabs wait, then read the freshly-stored token. Falls back to the
// in-tab singleton on browsers without navigator.locks.
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
  return locks.request("fanus-refresh-token", async () => {
    // Inside the lock — re-check, in case another tab just rotated for us.
    const t = getAccessToken();
    if (t && !isTokenExpiringSoon(t, 30)) return "ok" as RefreshOutcome;
    return _doRefresh();
  });
}

export async function tryRefresh(): Promise<RefreshOutcome> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _refreshWithCrossTabLock().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

function buildHeaders(token: string | null, isJson = true) {
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...localeHeaders(),
  };
}

async function authedRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  // Proactive refresh: token expiring within 60 s → refresh first
  const currentToken = getAccessToken();
  if (currentToken && isTokenExpiringSoon(currentToken, 60)) {
    const outcome = await tryRefresh();
    if (outcome === "auth_failure") {
      redirectToLogin();
      throw new Error("Session expired");
    }
    // network_error: proceed with current token, 401 handler below will catch if needed
  }

  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      const retryToken = getAccessToken();
      const retry = await fetch(`${BASE}${path}`, {
        method,
        credentials: "include",
        headers: buildHeaders(retryToken),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `API error ${retry.status}`);
      }
      if (retry.status === 204) return undefined as T;
      return retry.json();
    }
    if (outcome === "auth_failure") {
      redirectToLogin();
    }
    // network_error: don't logout, let caller handle
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function authedBlobRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Blob> {
  const currentToken = getAccessToken();
  if (currentToken && isTokenExpiringSoon(currentToken, 60)) {
    const outcome = await tryRefresh();
    if (outcome === "auth_failure") {
      redirectToLogin();
      throw new Error("Session expired");
    }
  }

  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      const retryToken = getAccessToken();
      const retry = await fetch(`${BASE}${path}`, {
        method,
        credentials: "include",
        headers: buildHeaders(retryToken),
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
  const currentToken = getAccessToken();
  if (currentToken && isTokenExpiringSoon(currentToken, 60)) {
    const outcome = await tryRefresh();
    if (outcome === "auth_failure") {
      redirectToLogin();
      throw new Error("Session expired");
    }
  }

  const makeReq = (token: string | null) => fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const res = await makeReq(getAccessToken());

  if (res.status === 401) {
    const outcome = await tryRefresh();
    if (outcome === "ok") {
      const retry = await makeReq(getAccessToken());
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
  languages?: string; sessionTypes?: string; activityFormat?: string;
  university?: string; degree?: string; graduationYear?: string;
  accentColor: string; bgColor: string;
  displayOrder: number; active: boolean;
  defaultSessionMinutes?: number;
  userId?: number | null;
  /** Computed client-side from name + collision suffix; safe to use in URLs. */
  slug?: string;
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
  sessionFormat?: string | null;
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
  certifications?: string; languages?: string; activityFormat?: string;
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
  const list = await get<Psychologist[]>("/psychologists");
  return withSlugs(list);
};
export const getStats = () => get<Stat[]>("/stats");
export const getAnnouncements = () => get<Announcement[]>("/announcements");
export const getBlogPosts = () => get<BlogPost[]>("/blog-posts");
export const getBlogPostBySlug = (slug: string) => get<BlogPost>(`/blog-posts/${slug}`);
export const getFaqs = () => get<Faq[]>("/faqs");
export const getTestimonials = () => get<Testimonial[]>("/testimonials");
export const getSiteConfig = () => get<SiteConfig>("/site-config");

export const getPsychologistAvailability = (id: number, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
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

// ─── Auth ─────────────────────────────────────────────────────────────────────
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
  if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  storeUser({
    userId: data.userId,
    email: data.email,
    role: data.role,
    firstName: data.firstName,
    lastName: data.lastName,
  });
  if (data.accessToken) {
    setTokenCookie(data.accessToken);
  }
  return data;
};

export const logout = async () => {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
  clearSession();
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });
  } catch { /* ignore */ }
};

// ─── Patient Auth ──────────────────────────────────────────────────────────────
export const registerPatient = (data: {
  email: string; password: string; firstName: string; lastName: string; phone?: string;
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
  activityFormat: "ONLINE" | "IN_PERSON" | "BOTH";
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
  if (data.activityFormat) form.append("activityFormat", data.activityFormat);
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
  createPsychologist: (data: Omit<Psychologist, "id">) => authedRequest<Psychologist>("POST", "/admin/psychologists", data),
  updatePsychologist: (id: number, data: Omit<Psychologist, "id">) => authedRequest<Psychologist>("PUT", `/admin/psychologists/${id}`, data),
  deletePsychologist: (id: number) => authedRequest<void>("DELETE", `/admin/psychologists/${id}`),

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
  createBlogPost: (data: Omit<BlogPost, "id">) => authedRequest<BlogPost>("POST", "/admin/blog-posts", data),
  updateBlogPost: (id: number, data: Omit<BlogPost, "id">) => authedRequest<BlogPost>("PUT", `/admin/blog-posts/${id}`, data),
  deleteBlogPost: (id: number) => authedRequest<void>("DELETE", `/admin/blog-posts/${id}`),
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
    authedRequest<any>("GET", `/admin/users/${id}/application`),

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
};

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
  sessionFormat?: "ONLINE" | "IN_PERSON" | null;
}

export const patientApi = {
  myAppointments: () => authedRequest<AppointmentDetail[]>("GET", "/patient/appointments"),
  book: (data: PatientBookingPayload) =>
    authedRequest<AppointmentDetail>("POST", "/patient/appointments", data),
  cancel: (id: number, reasonCode: string, reasonText?: string) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${id}/cancel`, { reasonCode, reasonText }),

  favorites: () => authedRequest<Psychologist[]>("GET", "/patient/favorites"),
  favoriteIds: () => authedRequest<number[]>("GET", "/patient/favorites/ids"),
  toggleFavorite: (psychologistId: number) =>
    authedRequest<{ favorite: boolean }>("POST", `/patient/favorites/${psychologistId}/toggle`),

  reschedule: (appointmentId: number, data: PatientBookingPayload) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${appointmentId}/reschedule`, data),

  // Reschedule proposals (psychologist → patient)
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
  createBookingSeries: (data: {
    firstBooking: PatientBookingPayload;
    frequency: "WEEKLY" | "BIWEEKLY";
    totalCount: number;
  }) => authedRequest<BookingSeries>("POST", "/patient/booking-series", data),
  myBookingSeries: () => authedRequest<BookingSeries[]>("GET", "/patient/booking-series"),

  confirmSession: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${id}/confirm-session`),
  disputeSession: (id: number, reason?: string) =>
    authedRequest<AppointmentDetail>("POST", `/patient/appointments/${id}/dispute-session`, { reason }),


  // Homework
  homework: () => authedRequest<Homework[]>("GET", "/patient/homework"),
  markHomework: (id: number, data: { status: "COMPLETED" | "SKIPPED" | "PENDING"; completionNote?: string }) =>
    authedRequest<Homework>("POST", `/patient/homework/${id}/mark`, data),

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
};

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
  list: (limit = 30) => authedRequest<NotificationItem[]>("GET", `/me/notifications?limit=${limit}`),
  unreadCount: () => authedRequest<{ count: number }>("GET", "/me/notifications/unread-count"),
  markRead: (id: number) => authedRequest<void>("POST", `/me/notifications/${id}/read`),
  markAllRead: () => authedRequest<{ updated: number }>("POST", "/me/notifications/read-all"),
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

export const meApi = {
  get: () => authedRequest<MeProfile>("GET", "/me"),
  update: (data: { firstName?: string | null; lastName?: string | null; phone?: string | null }) =>
    authedRequest<MeProfile>("PUT", "/me", data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    authedRequest<void>("POST", "/me/password", data),
  uploadPhoto: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/me/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Upload uğursuz oldu (${res.status})`);
    }
    return res.json();
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
  /** Triggers a browser download of the GDPR data export ZIP. */
  exportData: async (): Promise<void> => {
    const res = await fetch(`${BASE}/me/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Yükləmə uğursuz oldu (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("Content-Disposition") ?? "";
    const m  = /filename=("?)([^";]+)\1/.exec(cd);
    a.download = m ? m[2] : "fanus-export.zip";
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

// ─── Psychologist API ─────────────────────────────────────────────────────────
export const psychologistApi = {
  me: () => authedRequest<Psychologist>("GET", "/psychologist/me"),
  updateSessionMinutes: (minutes: number) =>
    authedRequest<Psychologist>("PUT", "/psychologist/me/session-minutes", { minutes }),

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
  confirm: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/confirm`),
  reject: (id: number, reasonCode: string, reasonText?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/reject`, { reasonCode, reasonText }),
  cancel: (id: number, reasonCode: string, reasonText?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/cancel`, { reasonCode, reasonText }),
  confirmSession: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/confirm-session`),
  disputeSession: (id: number, reason?: string) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/dispute-session`, { reason }),
  complete: (id: number) =>
    authedRequest<AppointmentDetail>("POST", `/psychologist/appointments/${id}/complete`),

  stats: () => authedRequest<PsychologistStats>("GET", "/psychologist/stats"),
  clients: () => authedRequest<ClientSummary[]>("GET", "/psychologist/clients"),
  notesForPatient: (patientId: number) =>
    authedRequest<ClientNote[]>("GET", `/psychologist/clients/${patientId}/notes`),
  createNote: (data: ClientNotePayload) =>
    authedRequest<ClientNote>("POST", "/psychologist/client-notes", data),
  updateNote: (id: number, data: ClientNotePayload) =>
    authedRequest<ClientNote>("PUT", `/psychologist/client-notes/${id}`, data),
  deleteNote: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/client-notes/${id}`),

  // Vacation / out-of-office
  listVacations: () =>
    authedRequest<Vacation[]>("GET", "/psychologist/vacations"),
  createVacation: (data: { startDate: string; endDate: string; reason?: string; notifyPatients?: boolean }) =>
    authedRequest<Vacation>("POST", "/psychologist/vacations", data),
  cancelVacation: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/vacations/${id}`),

  // Reschedule proposals (psy side)
  myRescheduleProposals: () =>
    authedRequest<RescheduleProposal[]>("GET", "/psychologist/reschedule-proposals"),
  proposeReschedule: (appointmentId: number, data: {
    options: { startAt: string; endAt: string; sessionFormat?: string }[];
    reason?: string;
    expiresInHours?: number;
  }) =>
    authedRequest<RescheduleProposal>("POST", `/psychologist/appointments/${appointmentId}/reschedule-proposals`, data),
  withdrawRescheduleProposal: (id: number) =>
    authedRequest<RescheduleProposal>("DELETE", `/psychologist/reschedule-proposals/${id}`),

  // Patient tags (private to the psychologist)
  patientTags: (patientId: number) =>
    authedRequest<PatientTag[]>("GET", `/psychologist/clients/${patientId}/tags`),
  allMyPatientTags: () =>
    authedRequest<PatientTag[]>("GET", "/psychologist/patient-tags"),
  createPatientTag: (patientId: number, data: { label: string; color?: string }) =>
    authedRequest<PatientTag>("POST", `/psychologist/clients/${patientId}/tags`, data),
  deletePatientTag: (tagId: number) =>
    authedRequest<void>("DELETE", `/psychologist/patient-tags/${tagId}`),


  // Homework
  homework: () => authedRequest<Homework[]>("GET", "/psychologist/homework"),
  createHomework: (data: { patientId: number; title: string; description?: string; dueDate?: string }) =>
    authedRequest<Homework>("POST", "/psychologist/homework", data),
  updateHomework: (id: number, data: { patientId: number; title: string; description?: string; dueDate?: string }) =>
    authedRequest<Homework>("PUT", `/psychologist/homework/${id}`, data),
  deleteHomework: (id: number) =>
    authedRequest<void>("DELETE", `/psychologist/homework/${id}`),

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
  replyToReview: (reviewId: number, reply: string) =>
    authedRequest<PsychologistReceivedReview>("POST", `/psychologist/reviews/${reviewId}/reply`, { reply }),
  deleteReviewReply: (reviewId: number) =>
    authedRequest<void>("DELETE", `/psychologist/reviews/${reviewId}/reply`),
};

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
export interface Homework {
  id: number;
  psychologistId: number;
  psychologistName: string;
  patientId: number;
  patientName: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: "PENDING" | "COMPLETED" | "SKIPPED";
  completedAt?: string | null;
  completionNote?: string | null;
  createdAt: string;
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

export type RescheduleStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface RescheduleProposalOption {
  index: number;
  startAt: string;
  endAt: string;
  sessionFormat: string | null;
}

export type BookingFrequency = "WEEKLY" | "BIWEEKLY";

export interface BookingSeries {
  id: number;
  patientId: number;
  requestedPsychologistId: number | null;
  requestedPsychologistName: string | null;
  frequency: BookingFrequency;
  totalCount: number;
  cancelledAt: string | null;
  createdAt: string;
  createdAppointments: number;
  skippedOccurrences: number;
  appointmentIds: number[];
  skippedDates: string[];
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

export interface RescheduleProposal {
  id: number;
  appointmentId: number;
  psychologistId: number;
  psychologistName: string | null;
  patientUserId: number | null;
  reason: string | null;
  status: RescheduleStatus;
  expiresAt: string;
  acceptedOption: number | null;
  decidedAt: string | null;
  newAppointmentId: number | null;
  createdAt: string;
  options: RescheduleProposalOption[];
  originalStartAt: string | null;
  originalEndAt: string | null;
}

// ─── Operator API (also accessible to ADMIN) ──────────────────────────────────
export interface OperatorAssignPayload {
  psychologistId: number;
  startAt: string; // ISO
  endAt: string;   // ISO
  sessionFormat?: "ONLINE" | "IN_PERSON" | null;
  operatorNote?: string | null;
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
  registeredAt?: string | null;
  recent: { id: number; status: string; psychologistName?: string | null; startAt?: string | null; createdAt?: string | null; note?: string | null }[];
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
  assignedToday: number;
  completedThisMonth: number;
  rejectedThisMonth: number;
  totalThisMonth: number;
  avgResponseMinutes: number | null;
  rejectionRatePct: number | null;
  last30Days: { date: string; incoming: number; assigned: number; rejected: number }[];
}

export const operatorApi = {
  listAppointments: () => authedRequest<AppointmentDetail[]>("GET", "/operator/appointments"),
  getAppointment: (id: number) => authedRequest<AppointmentDetail>("GET", `/operator/appointments/${id}`),
  assign: (id: number, data: OperatorAssignPayload) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/assign`, data),
  cancel: (id: number, reasonCode: string, note?: string) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/cancel`, { reasonCode, note }),
  resolveDispute: (
    id: number,
    decision: "COMPLETE" | "CANCEL",
    note?: string,
    blameSide?: "PATIENT" | "PSYCHOLOGIST"
  ) =>
    authedRequest<AppointmentDetail>("POST", `/operator/appointments/${id}/resolve-dispute`, { decision, note, blameSide }),

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
  contactLogs: (appointmentId: number) =>
    authedRequest<ContactLog[]>("GET", `/operator/appointments/${appointmentId}/contact-logs`),
  addContactLog: (appointmentId: number, data: { channel: string; outcome: string; note?: string }) =>
    authedRequest<ContactLog>("POST", `/operator/appointments/${appointmentId}/contact-logs`, data),
  blockUser: (userId: number, reason?: string) =>
    authedRequest<void>("POST", `/operator/users/${userId}/block`, { reason }),
  unblockUser: (userId: number) =>
    authedRequest<void>("POST", `/operator/users/${userId}/unblock`),
  stats: () => authedRequest<OperatorStats>("GET", "/operator/stats"),
};
