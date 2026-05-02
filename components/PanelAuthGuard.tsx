"use client";

import { useState, useLayoutEffect, useEffect, useRef, ReactNode } from "react";
import { getMainSiteUrl, decodeAccessToken, isTokenExpired, isTokenExpiringSoon, tokenExpiresInMs } from "@/lib/auth";
import { tryRefresh, clearSession } from "@/lib/api";

function redirectToLogin() {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = `${getMainSiteUrl()}/login?session=expired`;
  }
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

  useEffect(() => { setMounted(true); }, []);

  const scheduleProactiveRefresh = (token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const expiresInMs = tokenExpiresInMs(token);
    // Fire 90 s before expiry — comfortable window before the token actually expires
    const delay = Math.max(5_000, expiresInMs - 90_000);

    refreshTimerRef.current = setTimeout(async () => {
      const outcome = await tryRefresh();

      if (outcome === "ok") {
        const newToken = localStorage.getItem("accessToken");
        if (newToken) scheduleProactiveRefresh(newToken);
        return;
      }

      if (outcome === "network_error") {
        // Transient failure — check if the existing token is still usable
        const current = localStorage.getItem("accessToken");
        if (current && !isTokenExpired(current)) {
          // Token still valid: retry the refresh in 30 s
          refreshTimerRef.current = setTimeout(() => {
            const t = localStorage.getItem("accessToken");
            if (t) scheduleProactiveRefresh(t);
          }, 30_000);
        } else {
          // Token expired and network is down — cannot proceed
          redirectToLogin();
        }
        return;
      }

      // auth_failure → refresh token revoked or expired → log out
      redirectToLogin();
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
        // No local token — try cookie-based refresh before giving up
        const outcome = await tryRefresh();
        if (outcome !== "ok") { redirectToLogin(); return; }
        token = localStorage.getItem("accessToken");
        if (!token) { redirectToLogin(); return; }
      }

      if (isTokenExpired(token)) {
        const outcome = await tryRefresh();
        if (outcome === "ok") {
          token = localStorage.getItem("accessToken");
          if (!token) { redirectToLogin(); return; }
        } else {
          // auth_failure or network_error with an already-expired token → logout
          redirectToLogin();
          return;
        }
      }

      // Token expiring soon — refresh in background, don't block render
      if (isTokenExpiringSoon(token, 120)) {
        tryRefresh().then(outcome => {
          if (outcome === "ok") {
            const t = localStorage.getItem("accessToken");
            if (t) scheduleProactiveRefresh(t);
          } else if (outcome === "auth_failure") {
            redirectToLogin();
          } else {
            // network_error: schedule with current token, timer handles retry
            scheduleProactiveRefresh(token!);
          }
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
