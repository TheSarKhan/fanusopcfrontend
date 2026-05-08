"use client";

import Link from "next/link";
import ProfileShell from "@/components/ProfileShell";

export default function OperatorProfilePage() {
  return (
    <ProfileShell
      title="Profil"
      subtitle="Operator hesabınız və əlaqə məlumatları"
      extras={
        <div className="uprof-card">
          <div className="uprof-card-head">
            <h2>Operator imkanları</h2>
            <p>Sürətli giriş nöqtələri</p>
          </div>
          <div style={{ padding: 20, display: "grid", gap: 8 }}>
            <Link href="/operator" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>📊</span>
              <div>
                <strong>Dashboard</strong>
                <small>Triage queue və KPI-lər</small>
              </div>
            </Link>
            <Link href="/operator/appointments" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div>
                <strong>Müraciətlər</strong>
                <small>Müraciətləri psixoloqlara təyin et</small>
              </div>
            </Link>
            <Link href="/operator/analytics" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>📈</span>
              <div>
                <strong>Analitika</strong>
                <small>Performans və trendlər</small>
              </div>
            </Link>
          </div>
        </div>
      }
    />
  );
}

const cardLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--brand-50)",
  textDecoration: "none",
  color: "var(--oxford)",
  transition: "background 0.15s ease",
};
