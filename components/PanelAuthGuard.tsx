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
  const scheduleRef = useRef<(token: string) => void>(() => {});

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
        // Transient failure — always retry in 30 s, never logout on network error
        refreshTimerRef.current = setTimeout(() => {
          const t = localStorage.getItem("accessToken");
          if (t) scheduleProactiveRefresh(t);
        }, 30_000);
        return;
      }

      // auth_failure — but first check if another tab already rotated the token
      const latest = localStorage.getItem("accessToken");
      if (latest && !isTokenExpired(latest)) {
        scheduleProactiveRefresh(latest);
        return;
      }
      redirectToLogin();
    }, delay);
  };
  scheduleRef.current = scheduleProactiveRefresh;

  useLayoutEffect(() => {
    if (!mounted) return;

    // Extract tokens from URL hash (cross-subdomain redirect flow).
    // Hash is cleared immediately — tokens never stay in browser history.
    if (window.location.hash.includes("_auth=")) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const authParam = params.get("_auth");
      const refreshParam = params.get("_refresh");
      if (authParam) localStorage.setItem("accessToken", decodeURIComponent(authParam));
      if (refreshParam) localStorage.setItem("refreshToken", decodeURIComponent(refreshParam));
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
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
        let outcome = await tryRefresh();
        if (outcome === "network_error") {
          // Backend temporarily unreachable — wait 2 s and retry once
          await new Promise(r => setTimeout(r, 2_000));
          outcome = await tryRefresh();
        }
        if (outcome === "ok") {
          token = localStorage.getItem("accessToken");
          if (!token) { redirectToLogin(); return; }
        } else if (outcome === "auth_failure") {
          redirectToLogin();
          return;
        }
        // Still network_error after retry — proceed, API calls will handle recovery
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

  // When user returns to a tab that was idle for > 15 min, token may be expired.
  // The proactive timer was throttled/paused by the browser — refresh immediately.
  useEffect(() => {
    if (!ready) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const t = localStorage.getItem("accessToken");
      if (t && !isTokenExpired(t)) return;
      const outcome = await tryRefresh();
      if (outcome === "auth_failure") { redirectToLogin(); return; }
      if (outcome === "ok") {
        const newToken = localStorage.getItem("accessToken");
        if (newToken) scheduleRef.current(newToken);
      }
      // network_error: don't logout — proactive timer will retry when connectivity restores
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready]);

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
