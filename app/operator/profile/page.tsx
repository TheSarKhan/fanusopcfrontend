"use client";

import Link from "next/link";
import ProfileShell from "@/components/ProfileShell";

export default function OperatorProfilePage() {
  return (
    <ProfileShell
      title="Profil"
      subtitle="Operator hesabınız və əlaqə məlumatları"
      sideExtras={
        <div className="uprof-card uprof-side-card">
          <div className="uprof-side-card-head">
            <h3>Sürətli giriş</h3>
          </div>
          <Link href="/operator" className="uprof-side-link">
            <div className="uprof-side-link-icon">📊</div>
            <div className="uprof-side-link-text">
              <strong>Dashboard</strong>
              <small>Triage queue və KPI-lər</small>
            </div>
            <span className="uprof-side-link-arrow">›</span>
          </Link>
          <Link href="/operator/appointments" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
            <div className="uprof-side-link-icon">📋</div>
            <div className="uprof-side-link-text">
              <strong>Müraciətlər</strong>
              <small>Müraciətləri psixoloqlara təyin et</small>
            </div>
            <span className="uprof-side-link-arrow">›</span>
          </Link>
          <Link href="/operator/analytics" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
            <div className="uprof-side-link-icon">📈</div>
            <div className="uprof-side-link-text">
              <strong>Analitika</strong>
              <small>Performans və trendlər</small>
            </div>
            <span className="uprof-side-link-arrow">›</span>
          </Link>
        </div>
      }
    />
  );
}
