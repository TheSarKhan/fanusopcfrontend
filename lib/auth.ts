"use client";

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
}

export function decodeAccessToken(
  token: string
): { role?: string; exp?: number; userId?: number } | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeAccessToken(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now();
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

// Token always passed via URL hash — never sent to server, never in logs.
export function buildPanelUrl(role: string, token?: string): string {
  if (typeof window === "undefined") return "/";
  const sub = ROLE_SUBDOMAIN[role];
  if (!sub) return "/";
  const { protocol } = window.location;
  const { mainHost, port } = getMainHost();
  const portStr = port ? `:${port}` : "";
  const base = `${protocol}//${sub}.${mainHost}${portStr}`;
  if (token) {
    return `${base}#_auth=${encodeURIComponent(token)}`;
  }
  return base;
}

export function getMainSiteUrl(): string {
  if (typeof window === "undefined") return "/";
  const { protocol } = window.location;
  const { mainHost, port } = getMainHost();
  const portStr = port ? `:${port}` : "";
  return `${protocol}//${mainHost}${portStr}`;
}
