"use client";

import { useEffect } from "react";
import { buildPanelUrl, decodeAccessToken, isTokenExpired } from "@/lib/auth";

function clearAuthKeys() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authUser");
}

export default function AuthRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("_logout") === "1") {
      clearAuthKeys();
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    if (isTokenExpired(token)) {
      clearAuthKeys();
      return;
    }

    const payload = decodeAccessToken(token);
    if (payload?.role) {
      window.location.href = buildPanelUrl(payload.role, token);
    }
  }, []);

  return null;
}
