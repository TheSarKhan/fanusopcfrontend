"use client";

import { useState, useLayoutEffect, useEffect, useRef, ReactNode } from "react";
import { getMainSiteUrl, decodeAccessToken, isTokenExpired, isTokenExpiringSoon, tokenExpiresInMs } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      document.cookie = `_ft=${encodeURIComponent(data.accessToken)}; domain=localhost; path=/; SameSite=Lax; max-age=900`;
    }
    if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

function clearAndRedirect() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authUser");
  document.cookie = "_ft=; domain=localhost; path=/; max-age=0";
  window.location.href = `${getMainSiteUrl()}/login?session=expired`;
}

export default function PanelAuthGuard({
  requiredRole,
  children,
}: {
  requiredRole: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scheduleProactiveRefresh = (token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiresInMs = tokenExpiresInMs(token);
    // Refresh 60 seconds before expiry, minimum 5 seconds from now
    const delay = Math.max(5_000, expiresInMs - 60_000);
    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await attemptRefresh();
      if (newToken) scheduleProactiveRefresh(newToken);
      else clearAndRedirect();
    }, delay);
  };

  useLayoutEffect(() => {
    if (!mounted) return;

    // Extract token from URL hash (cross-subdomain redirect flow)
    if (window.location.hash.includes("_auth=")) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const authParam = params.get("_auth");
      if (authParam) {
        localStorage.setItem("accessToken", decodeURIComponent(authParam));
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
      }
    }

    const run = async () => {
      let token = localStorage.getItem("accessToken");

      if (!token) {
        clearAndRedirect();
        return;
      }

      // Token expired — try to refresh before giving up
      if (isTokenExpired(token)) {
        token = await attemptRefresh();
        if (!token) {
          clearAndRedirect();
          return;
        }
      }

      // Token expires soon — refresh proactively (still render with current valid token)
      if (isTokenExpiringSoon(token, 120)) {
        attemptRefresh().then((newToken) => {
          if (newToken) scheduleProactiveRefresh(newToken);
        });
      } else {
        scheduleProactiveRefresh(token);
      }

      const payload = decodeAccessToken(token);
      if (!payload?.role || payload.role !== requiredRole) {
        window.location.href = payload?.role
          ? `${getMainSiteUrl()}/403`
          : `${getMainSiteUrl()}/login`;
        return;
      }

      setReady(true);
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredRole, mounted]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  if (!mounted) return null;

  if (!ready) {
    return (
      <div suppressHydrationWarning style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA" }}>
        <div suppressHydrationWarning style={{ fontSize: "0.9rem", color: "#52718F" }}>Yüklənir...</div>
      </div>
    );
  }

  return <>{children}</>;
}
