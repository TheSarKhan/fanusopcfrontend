"use client";

/**
 * Standalone operator yönləndirmə təsdiq səhifəsi (modules.ts → referrals:true).
 * Eyni görünüş Randevular səhifəsinin "Yönləndirmələr" tabında da mövcuddur;
 * hər ikisi OperatorReferralsView-u tək mənbə kimi işlədir.
 */

import OperatorReferralsView from "@/components/OperatorReferralsView";

export default function OperatorReferralsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: 0 }}>Yönləndirmələr</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0 }}>
          Psixoloqlar arası randevu/paket yönləndirmələri — təsdiq gözləyənlər.
        </p>
      </div>
      <OperatorReferralsView />
    </div>
  );
}
