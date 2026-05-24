"use client";

import { useState, useEffect, ReactNode } from "react";
import { getMainSiteUrl, getStoredUser, storeUser } from "@/lib/auth";
import { tryGetMe, clearSession } from "@/lib/api";

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
  requiredRole: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const hadPrior = getStoredUser() !== null;

    const check = async () => {
      const me = await tryGetMe();
      if (cancelled) return;

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

      if (me.role !== requiredRole) {
        window.location.href = `${getMainSiteUrl()}/403`;
        return;
      }

      setReady(true);
    };

    check();
    return () => { cancelled = true; };
  }, [requiredRole, mounted]);

  // When the tab returns to focus, re-verify the session in case cookies expired
  // while we were idle. tryGetMe handles refresh internally.
  useEffect(() => {
    if (!ready) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const me = await tryGetMe();
      if (!me) bounceToLogin({ hadPriorSession: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready]);

  if (!mounted) return null;

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
