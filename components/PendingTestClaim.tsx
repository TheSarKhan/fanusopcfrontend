"use client";

import { useEffect } from "react";
import { patientApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { readPendingClaim, clearPendingClaim } from "@/lib/pendingTestClaim";
import { useT } from "@/lib/i18n/LocaleProvider";

/**
 * Saytda anonim doldurulmuş testin nəticəsini hesaba bağlayır.
 *
 * <p>Ziyarətçi testi bitirəndə `pendingTestClaim` tokeni brauzerdə saxlanılır. O,
 * qeydiyyatdan keçib pasiyent panelinə düşəndə nəticə səhifəsinə qayıtmaya bilər —
 * bu komponent panel açılan kimi tokeni "claim" edir ki, nəticə itməsin.
 */
export default function PendingTestClaim() {
  const { t } = useT();
  useEffect(() => {
    const token = readPendingClaim();
    if (!token) return;

    let alive = true;
    patientApi.claimPublicTestResult(token)
      .then((r) => {
        if (!alive) return;
        clearPendingClaim();
        // Test siyahısı sahiblənmə bitməzdən əvvəl yüklənə bilər — səhifəyə
        // xəbər veririk ki, yeni nəticə refresh olmadan görünsün.
        window.dispatchEvent(new CustomEvent("fanus:test-claimed"));
        toast(
          r.testTitle
            ? t("pat.testClaimedNamed", { title: r.testTitle })
            : t("pat.testClaimed"),
          "success",
        );
      })
      .catch(() => {
        // Token köhnəlib və ya başqa hesaba bağlanıb — səssizcə təmizlə.
        clearPendingClaim();
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
