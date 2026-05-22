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

/**
 * Synchronously consume any `#_auth=…&_refresh=…` hash dropped on us by a
 * cross-subdomain redirect. Runs once on first render so we don't paint a
 * loader before the token has been written to localStorage.
 */
function consumeAuthHash() {
  if (typeof window === "undefined") return;
  if (!window.location.hash.includes("_auth=")) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const authParam = params.get("_auth");
  const refreshParam = params.get("_refresh");
  if (authParam) localStorage.setItem("accessToken", decodeURIComponent(authParam));
  if (refreshParam) localStorage.setItem("refreshToken", decodeURIComponent(refreshParam));
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
}

/**
 * Returns true if we have a fresh, role-matching token in localStorage right
 * now. Allows us to skip the "Yüklənir…" loader entirely on the happy path
 * (which is by far the most common case after login or page refresh).
 */
function hasValidLocalToken(requiredRole: string): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("accessToken");
  if (!token || isTokenExpired(token)) return false;
  const payload = decodeAccessToken(token);
  return payload?.role === requiredRole;
}

export default function PanelAuthGuard({
  requiredRole,
  children,
}: {
  requiredRole: string;
  children: ReactNode;
}) {
  // First render: synchronously pull tokens out of the redirect hash and
  // decide whether we already have a usable session. If yes, skip the loader.
  const [ready, setReady] = useState(() => {
    consumeAuthHash();
    return hasValidLocalToken(requiredRole);
  });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<(token: string) => void>(() => {});

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
    // Hash already consumed in the initial-state factory; nothing else to do
    // synchronously here. Async work (refresh, role mismatch handling) below.

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
  }, [requiredRole]);

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

  // Cross-tab token sync: when another tab rotates the access token, reschedule
  // this tab's proactive timer against the new expiry. Prevents a stale tab
  // from racing into a 401 with the about-to-be-replaced token.
  useEffect(() => {
    if (!ready) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "accessToken") return;
      const next = e.newValue;
      if (!next) { redirectToLogin(); return; }
      if (isTokenExpired(next)) return;
      scheduleRef.current(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ready]);

  if (!ready) {
    return (
      <div suppressHydrationWarning style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA" }}>
        <div suppressHydrationWarning style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: "0.9rem", color: "#52718F" }}>
          <span
            suppressHydrationWarning
            style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid #C7D6E5", borderTopColor: "#1051B7",
              animation: "fanus-spin 0.7s linear infinite",
              display: "inline-block",
            }}
          />
          Yüklənir...
        </div>
        <style>{`
          @keyframes fanus-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}
