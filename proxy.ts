import { NextRequest, NextResponse } from "next/server";

function decodeJwtPayload(
  token: string
): { role?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts[0];
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];
  return null;
}

function getMainOrigin(request: NextRequest): string {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const port = host.split(":")[1];
  const parts = hostname.split(".");
  let mainHost: string;
  if (parts.length >= 3) {
    mainHost = parts.slice(1).join(".");
  } else if (parts.length === 2 && parts[1] === "localhost") {
    mainHost = "localhost";
  } else {
    mainHost = hostname;
  }
  const portStr = port ? `:${port}` : "";
  return `${request.nextUrl.protocol}//${mainHost}${portStr}`;
}

function isLocalhost(host: string): boolean {
  const h = host.split(":")[0];
  return h === "localhost" || h.endsWith(".localhost");
}

const SUBDOMAIN_ROLE: Record<string, string> = {
  patient: "PATIENT",
  psycholog: "PSYCHOLOGIST",
  operator: "OPERATOR",
  admin: "ADMIN",
};

const SUBDOMAIN_PATH: Record<string, string> = {
  patient: "/patient",
  psycholog: "/psycholog",
  operator: "/operator",
  admin: "/admin",
};

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const subdomain = getSubdomain(host);
  const { pathname } = request.nextUrl;

  const isInternal =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isInternal) return NextResponse.next();

  const targetPrefix = subdomain ? SUBDOMAIN_PATH[subdomain] : null;

  // No panel subdomain → main site, no auth needed
  if (!targetPrefix) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Production only: server-side auth via HttpOnly cookie ─────────────────
  // In dev (localhost) cookies can't cross subdomains so PanelAuthGuard
  // handles auth client-side. In prod the backend sets a cookie with
  // Domain=.fanusopc.com which the browser sends automatically.
  if (!isLocalhost(host)) {
    const token = request.cookies.get("accessToken")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", getMainOrigin(request)));
    }

    const payload = decodeJwtPayload(token);
    const requiredRole = SUBDOMAIN_ROLE[subdomain!];

    // Expired token
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.redirect(new URL("/login", getMainOrigin(request)));
    }

    // Wrong role
    if (!payload || payload.role !== requiredRole) {
      const url = request.nextUrl.clone();
      url.pathname = "/403";
      return NextResponse.rewrite(url);
    }
  }

  // ── Rewrite: operator.fanusopc.com/xyz → /operator/xyz ───────────────────
  if (!pathname.startsWith(targetPrefix)) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/" ? targetPrefix : `${targetPrefix}${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next).*)"],
};
