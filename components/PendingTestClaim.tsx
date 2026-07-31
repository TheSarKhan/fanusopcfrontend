"use client";

import { useEffect } from "react";
import { patientApi } from "@/lib/api";
import { toast } from "@/components/Toast";

/**
 * Saytda anonim doldurulmuş testin nəticəsini hesaba bağlayır.
 *
 * <p>Ziyarətçi testi bitirəndə `pendingTestClaim` tokeni brauzerdə saxlanılır. O,
 * qeydiyyatdan keçib pasiyent panelinə düşəndə nəticə səhifəsinə qayıtmaya bilər —
 * bu komponent panel açılan kimi tokeni "claim" edir ki, nəticə itməsin.
 */
export default function PendingTestClaim() {
  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem("pendingTestClaim"); } catch { return; }
    if (!token) return;

    let alive = true;
    patientApi.claimPublicTestResult(token)
      .then((r) => {
        if (!alive) return;
        try { localStorage.removeItem("pendingTestClaim"); } catch { /* ignore */ }
        toast(`Test nəticəniz hesabınıza əlavə olundu${r.testTitle ? ` — ${r.testTitle}` : ""}`, "success");
      })
      .catch(() => {
        // Token köhnəlib və ya başqa hesaba bağlanıb — səssizcə təmizlə.
        try { localStorage.removeItem("pendingTestClaim"); } catch { /* ignore */ }
      });
    return () => { alive = false; };
  }, []);

  return null;
}
