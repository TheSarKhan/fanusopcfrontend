"use client";

/**
 * Standalone yönləndirmə səhifəsi. Modul kilidlidir (modules.ts → referrals:false),
 * ona görə əsas giriş Görüşlər səhifəsinin "Yönləndirmələr" tabıdır; bu fayl yalnız
 * paneli tək mənbədən (PsyReferralsView) render edir.
 */

import PsyReferralsView from "@/components/PsyReferralsView";

export default function PsychologReferralsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Yönləndirmələr</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
          Randevu və ya paketi həmkarınıza yönləndirin — operator təsdiqi ilə.
        </p>
      </div>
      <PsyReferralsView />
    </div>
  );
}
