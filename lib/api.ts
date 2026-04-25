const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function get<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 30 },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function authedRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return authedRequest(method, path, body);
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Psychologist {
  id: number; name: string; title: string; specializations: string[];
  experience: string; sessionsCount: string; rating: string;
  photoUrl: string; accentColor: string; bgColor: string;
  displayOrder: number; active: boolean;
}
export interface Stat { id: number; statValue: number; suffix: string; label: string; subLabel: string; displayOrder: number; }
export interface Announcement { id: number; category: string; categoryColor: string; categoryBg: string; title: string; excerpt: string; publishedDate: string; iconType: string; active: boolean; }
export interface BlogPost { id: number; category: string; categoryColor: string; categoryBg: string; title: string; excerpt: string; readTimeMinutes: number; publishedDate: string; emoji: string; slug: string; featured: boolean; active: boolean; }
export interface Faq { id: number; question: string; answer: string; displayOrder: number; active: boolean; }
export interface Testimonial { id: number; quote: string; authorName: string; authorRole: string; initials: string; gradient: string; rating: number; active: boolean; }
export interface SiteConfig { [key: string]: string; }
export interface Appointment { id: number; patientName: string; phone: string; psychologistName?: string; note?: string; preferredDate?: string; status: string; createdAt: string; }

// ─── Public API ──────────────────────────────────────────────────────────────
export const getPsychologists = () => get<Psychologist[]>("/psychologists");
export const getStats = () => get<Stat[]>("/stats");
export const getAnnouncements = () => get<Announcement[]>("/announcements");
export const getBlogPosts = () => get<BlogPost[]>("/blog-posts");
export const getFaqs = () => get<Faq[]>("/faqs");
export const getTestimonials = () => get<Testimonial[]>("/testimonials");
export const getSiteConfig = () => get<SiteConfig>("/site-config");

export const bookAppointment = (data: {
  patientName: string; phone: string; psychologistName?: string; note?: string; preferredDate?: string;
}) => fetch(`${BASE}/appointments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
}).then(r => r.json());

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(async r => {
    if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Login failed"); }
    return r.json();
  });

export const logout = () => {
  const refreshToken = localStorage.getItem("refreshToken");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  if (refreshToken) fetch(`${BASE}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {});
};

// ─── Admin API ───────────────────────────────────────────────────────────────
export const adminApi = {
  getDashboard: () => authedRequest<Record<string, number>>("GET", "/admin/dashboard"),

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

  // Blog
  getBlogPosts: () => authedRequest<BlogPost[]>("GET", "/admin/blog-posts"),
  createBlogPost: (data: Omit<BlogPost, "id">) => authedRequest<BlogPost>("POST", "/admin/blog-posts", data),
  updateBlogPost: (id: number, data: Omit<BlogPost, "id">) => authedRequest<BlogPost>("PUT", `/admin/blog-posts/${id}`, data),
  deleteBlogPost: (id: number) => authedRequest<void>("DELETE", `/admin/blog-posts/${id}`),

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

  // Upload
  uploadFile: async (file: File): Promise<string> => {
    const token = localStorage.getItem("accessToken");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/admin/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.url;
  },
};
