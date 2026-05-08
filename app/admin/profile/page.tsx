"use client";

import Link from "next/link";
import ProfileShell from "@/components/ProfileShell";

export default function AdminProfilePage() {
  return (
    <ProfileShell
      title="Profil"
      subtitle="Admin hesabınız və əlaqə məlumatları"
      extras={
        <div className="uprof-card">
          <div className="uprof-card-head">
            <h2>Admin əməliyyatları</h2>
            <p>İdarə paneli sürətli giriş</p>
          </div>
          <div style={{ padding: 20, display: "grid", gap: 8 }}>
            <Link href="/admin/users" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>👥</span>
              <div>
                <strong>İstifadəçilər</strong>
                <small>Pasiyent, psixoloq, operator idarəsi</small>
              </div>
            </Link>
            <Link href="/admin/psychologists" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>🧠</span>
              <div>
                <strong>Psixoloqlar</strong>
                <small>Profil və ərizələr</small>
              </div>
            </Link>
            <Link href="/admin/blog" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>📝</span>
              <div>
                <strong>Məqalələr</strong>
                <small>Blog kontentinin idarəsi</small>
              </div>
            </Link>
            <Link href="/admin/reviews" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>⭐</span>
              <div>
                <strong>Rəylər</strong>
                <small>Moderasiya növbəsi</small>
              </div>
            </Link>
            <Link href="/admin/settings" style={cardLinkStyle}>
              <span style={{ fontSize: 20 }}>⚙</span>
              <div>
                <strong>Parametrlər</strong>
                <small>Sistem konfiqurasiyası</small>
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
