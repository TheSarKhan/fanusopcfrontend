"use client";

import { useState, useEffect, ReactNode } from "react";
import { getMainSiteUrl, getStoredUser, storeUser } from "@/lib/auth";
import { tryGetMe, tryRefresh, clearSession } from "@/lib/api";
import FanusLoader from "@/components/FanusLoader";

/** Proactively refresh the access cookie every 20 minutes. The default access
 *  token lifetime is 1 hour (legacy) or 7 days (current default); refreshing
 *  every 20 min keeps it well clear of expiry even in the legacy case and
 *  also serves as a heartbeat that rotates the Redis-backed refresh token.
 *
 *  Doing this proactively avoids the 401→refresh→retry round-trip on every
 *  authed request and prevents user-visible blips when the access cookie
 *  expires mid-action. */
const PROACTIVE_REFRESH_MS = 20 * 60 * 1000;

/** Send the user to the login page. If they had a session before (cached
 *  authUser in localStorage), we surface a "session expired" hint. If this
 *  is a fresh visit with no prior session, we just ask them to log in. */
function bounceToLogin(opts: { hadPriorSession: boolean }) {
  const hadPrior = opts.hadPriorSession;
  clearSession();
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  const params = new URLSearchParams();
  if (next && next !== "/") params.set("next", next);
  if (hadPrior) params.set("session", "expired");
  const qs = params.toString();
  window.location.href = `${getMainSiteUrl()}/login${qs ? `?${qs}` : ""}`;
}

export default function PanelAuthGuard({
  requiredRole,
  children,
}: {
  /** One role, or several allowed roles (e.g. operator panel allows OPERATOR + ADMIN,
   *  mirroring the backend's hasAnyRole('OPERATOR','ADMIN')). */
  requiredRole: string | string[];
  children: ReactNode;
}) {
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const hadPrior = getStoredUser() !== null;

    const check = async () => {
      // Cookies set by a cross-origin login response occasionally don't make
      // it into the jar before the next page's first request fires. Retry
      // once after a short delay before declaring the session dead.
      let me = await tryGetMe();
      if (cancelled) return;
      if (!me) {
        await new Promise(r => setTimeout(r, 250));
        if (cancelled) return;
        me = await tryGetMe();
        if (cancelled) return;
      }

      if (!me) {
        bounceToLogin({ hadPriorSession: hadPrior });
        return;
      }

      // Refresh the local user cache from the authoritative source.
      storeUser({
        userId: me.id,
        email: me.email,
        role: me.role,
        firstName: me.firstName ?? undefined,
        lastName: me.lastName ?? undefined,
      });

      if (!allowedRoles.includes(me.role)) {
        window.location.href = `${getMainSiteUrl()}/403`;
        return;
      }

      setReady(true);
    };

    check();
    return () => { cancelled = true; };
    // allowedRoles is derived from props each render; join() gives a stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedRoles.join(","), mounted]);

  // Proactive silent refresh — keep the access cookie fresh without waiting
  // for a 401. Runs in the background while the panel is mounted.
  useEffect(() => {
    if (!ready) return;
    const tick = async () => {
      const outcome = await tryRefresh();
      if (outcome === "auth_failure") {
        // Refresh token is genuinely dead (revoked / expired in Redis).
        // No way to recover silently — surface the expired-session UI.
        bounceToLogin({ hadPriorSession: true });
      }
      // "network_error" → leave alone; next attempt will retry.
    };
    const id = setInterval(tick, PROACTIVE_REFRESH_MS);
    // Also refresh whenever the tab returns to focus AFTER being hidden for
    // a while — covers laptop-sleep / long background tabs where setInterval
    // is throttled. Inline guard: only if last refresh was >10 min ago.
    let lastRefreshAt = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt < 10 * 60 * 1000) return;
      lastRefreshAt = Date.now();
      tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready]);

  if (!mounted) return null;

  if (!ready) {
    return (
      <div suppressHydrationWarning style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA" }}>
        <FanusLoader size={72} label="Yüklənir…" fullscreen />
      </div>
    );
  }

  return <>{children}</>;
}
