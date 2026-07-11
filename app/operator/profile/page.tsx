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
            <div className="uprof-side-link-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div className="uprof-side-link-text">
              <strong>Dashboard</strong>
              <small>Triage queue və KPI-lər</small>
            </div>
            <span className="uprof-side-link-arrow">›</span>
          </Link>
          <Link href="/operator/appointments" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
            <div className="uprof-side-link-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
            </div>
            <div className="uprof-side-link-text">
              <strong>Randevular</strong>
              <small>Randevuları psixoloqlara təyin et</small>
            </div>
            <span className="uprof-side-link-arrow">›</span>
          </Link>
          <Link href="/operator/analytics" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
            <div className="uprof-side-link-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
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
