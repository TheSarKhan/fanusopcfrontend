"use client";

import { useState, useLayoutEffect, ReactNode } from "react";
import { getMainSiteUrl, decodeAccessToken, isTokenExpired } from "@/lib/auth";

export default function PanelAuthGuard({
  requiredRole,
  children,
}: {
  requiredRole: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    // Extract token from URL hash (cross-subdomain redirect flow).
    // Hash is never sent to the server so it never appears in logs.
    if (window.location.hash.includes("_auth=")) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const authParam = params.get("_auth");
      if (authParam) {
        localStorage.setItem("accessToken", decodeURIComponent(authParam));
        // Clean hash from URL without triggering a navigation
        window.history.replaceState(
          {},
          "",
          window.location.pathname + window.location.search
        );
      }
    }

    const token = localStorage.getItem("accessToken");

    if (!token) {
      window.location.href = `${getMainSiteUrl()}/login`;
      return;
    }

    if (isTokenExpired(token)) {
      localStorage.clear();
      window.location.href = `${getMainSiteUrl()}/login`;
      return;
    }

    const payload = decodeAccessToken(token);
    if (!payload?.role || payload.role !== requiredRole) {
      window.location.href = payload?.role
        ? `${getMainSiteUrl()}/403`
        : `${getMainSiteUrl()}/login`;
      return;
    }

    setReady(true);
  }, [requiredRole]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F0F4FA",
        }}
      >
        <div style={{ fontSize: "0.9rem", color: "#52718F" }}>Yüklənir...</div>
      </div>
    );
  }

  return <>{children}</>;
}
