import { storeUser, clearUser, isTokenExpiringSoon, isTokenExpired, getMainSiteUrl } from "./auth";

let API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
if (API_URL.endsWith("/")) API_URL = API_URL.slice(0, -1);
if (!API_URL.endsWith("/api")) API_URL += "/api";

const BASE = API_URL;

async function get<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 30 },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

function readTokenCookie(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)_ft=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
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
  document.cookie = "_ft=; domain=localhost; path=/; max-age=0";
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
      // Another tab may have already rotated the token — check before treating as fatal
      const existing = getAccessToken();
      if (existing && !isTokenExpired(existing)) return "ok";
      return "auth_failure";
    }
    if (!res.ok) return "network_error";

    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      document.cookie = `_ft=${encodeURIComponent(data.accessToken)}; domain=localhost; path=/; SameSite=Lax; max-age=900`;
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

// Singleton — prevents parallel refresh races
let _refreshPromise: Promise<RefreshOutcome> | null = null;

export async function tryRefresh(): Promise<RefreshOutcome> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

function buildHeaders(token: string | null, isJson = true) {
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
export interface UserRecord {
  id: number; email: string; role: string;
  firstName?: string; lastName?: string; phone?: string;
  emailVerified: boolean; inPsychologistList: boolean; active: boolean;
  lastLogin?: string; createdAt: string;
}

export interface PsychologistApplication {
  id: number; firstName: string; lastName: string; email: string; phone?: string;
  university: string; degree: string; graduationYear: string;
  specializations?: string; sessionTypes?: string; experienceYears?: string;
  bio?: string; certifications?: string; languages?: string; activityFormat?: string;
  diplomaFileUrl?: string; certificateFileUrls?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote?: string; createdAt: string; reviewedAt?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const getPsychologists = () => get<Psychologist[]>("/psychologists");
export const getStats = () => get<Stat[]>("/stats");
export const getAnnouncements = () => get<Announcement[]>("/announcements");
export const getBlogPosts = () => get<BlogPost[]>("/blog-posts");
export const getBlogPostBySlug = (slug: string) => get<BlogPost>(`/blog-posts/${slug}`);
export const getFaqs = () => get<Faq[]>("/faqs");
export const getTestimonials = () => get<Testimonial[]>("/testimonials");
export const getSiteConfig = () => get<SiteConfig>("/site-config");

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
    headers: { "Content-Type": "application/json" },
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
  // Set a Lax cookie readable across *.localhost so middleware can verify the session
  // on cross-subdomain navigation. In production the backend's HttpOnly cookie covers this.
  if (data.accessToken) {
    document.cookie = `_ft=${encodeURIComponent(data.accessToken)}; domain=localhost; path=/; SameSite=Lax; max-age=900`;
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
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
}).then(async r => {
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? "Qeydiyyat uğursuz oldu");
  return body;
});

export const registerPsychologist = (
  data: {
    email: string; password: string; firstName: string; lastName: string; phone?: string;
    languages: string[];
    university: string; degree: string; graduationYear: string;
    specializations: string[]; sessionTypes: string[]; experienceYears: string;
    activityFormat: string;
    bio: string; certifications: string[];
  },
  diplomaFile?: File | null,
  certificateFiles?: File[],
  photoFile?: File | null
) => {
  const form = new FormData();
  form.append("email", data.email);
  form.append("password", data.password);
  form.append("firstName", data.firstName);
  form.append("lastName", data.lastName);
  if (data.phone) form.append("phone", data.phone);
  data.languages.forEach(l => form.append("languages", l));
  form.append("university", data.university);
  form.append("degree", data.degree);
  form.append("graduationYear", data.graduationYear);
  data.specializations.forEach(s => form.append("specializations", s));
  data.sessionTypes.forEach(s => form.append("sessionTypes", s));
  if (data.experienceYears) form.append("experienceYears", data.experienceYears);
  if (data.activityFormat) form.append("activityFormat", data.activityFormat);
  if (data.bio) form.append("bio", data.bio);
  data.certifications.forEach(c => form.append("certifications", c));
  if (diplomaFile) form.append("diplomaFile", diplomaFile);
  certificateFiles?.forEach(f => form.append("certificateFiles", f));
  if (photoFile) form.append("photoFile", photoFile);

  return fetch(`${BASE}/auth/register/psychologist`, {
    method: "POST",
    credentials: "include",
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

export const adminApi = {
  getDashboard: () => authedRequest<Record<string, number>>("GET", "/admin/dashboard"),
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
};
