"use client";

// Access/refresh tokens live in HTTP-only cookies set by the backend (Domain=.fanus.com).
// JS never touches them. What lives here is a tiny non-sensitive user record used
// to render the UI immediately on page load — the cookie carries the real auth.

export interface AuthUser {
  userId: number;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("authUser");
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("authUser", JSON.stringify(user));
}

export function clearUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("authUser");
  // Also wipe any tokens that older builds may have stashed; harmless if missing.
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

const ROLE_SUBDOMAIN: Record<string, string> = {
  PATIENT: "patient",
  PSYCHOLOGIST: "psycholog",
  OPERATOR: "operator",
  ADMIN: "admin",
};

function getMainHost(): { mainHost: string; port: string } {
  const { host } = window.location;
  const hostname = host.split(":")[0];
  const port = host.split(":")[1] || "";
  const parts = hostname.split(".");
  let mainHost: string;
  if (parts.length >= 3) {
    mainHost = parts.slice(1).join(".");
  } else if (parts.length === 2 && parts[1] === "localhost") {
    mainHost = "localhost";
  } else {
    mainHost = hostname.replace(/^www\./, "");
  }
  return { mainHost, port };
}

// Cross-subdomain auth rides on the HTTP-only cookie. In prod that cookie is
// Domain=.fanus.com; in dev it's Domain=localhost and modern browsers do send
// it to `<sub>.localhost`. Either way we just navigate to the subdomain URL
// and the browser carries the cookie for us.
export function buildPanelUrl(role: string): string {
  if (typeof window === "undefined") return "/";
  const sub = ROLE_SUBDOMAIN[role];
  if (!sub) return "/";
  const { protocol } = window.location;
  const { mainHost, port } = getMainHost();
  const portStr = port ? `:${port}` : "";
  return `${protocol}//${sub}.${mainHost}${portStr}/${sub}`;
}

export function getMainSiteUrl(): string {
  if (typeof window === "undefined") return "/";
  const { protocol } = window.location;
  const { mainHost, port } = getMainHost();
  const portStr = port ? `:${port}` : "";
  return `${protocol}//${mainHost}${portStr}`;
}
