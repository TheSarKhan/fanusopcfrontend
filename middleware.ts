import { NextRequest, NextResponse } from "next/server";

const SUBDOMAIN_TO_PATH: Record<string, string> = {
  admin: "/admin",
  psycholog: "/psycholog",
  patient: "/patient",
  operator: "/operator",
};

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const subdomain = hostname.split(".")[0].split(":")[0];

  const panelPath = SUBDOMAIN_TO_PATH[subdomain];
  if (!panelPath) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname === "/" || !pathname.startsWith(panelPath)) {
    const url = request.nextUrl.clone();
    url.pathname = panelPath;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/).*)"],
};
