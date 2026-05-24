"use client";

import { useEffect } from "react";
import { buildPanelUrl, storeUser } from "@/lib/auth";
import { tryGetMe, clearSession } from "@/lib/api";

export default function AuthRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("_logout") === "1") {
      clearSession();
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    let cancelled = false;
    (async () => {
      const me = await tryGetMe();
      if (cancelled || !me) return;
      storeUser({
        userId: me.id,
        email: me.email,
        role: me.role,
        firstName: me.firstName ?? undefined,
        lastName: me.lastName ?? undefined,
      });
      window.location.href = buildPanelUrl(me.role);
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
