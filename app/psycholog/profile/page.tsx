"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileShell from "@/components/ProfileShell";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
import { psychologistApi, type Psychologist } from "@/lib/api";

export default function PsychologProfilePage() {
  const [me, setMe] = useState<Psychologist | null>(null);

  useEffect(() => {
    psychologistApi.me().then(setMe).catch(() => setMe(null));
  }, []);

  return (
    <ProfileShell
      title="Profilim"
      subtitle="Şəxsi məlumatlarınızı və psixoloq profilinizi idarə edin"
      sideExtras={
        me?.slug ? (
          <div className="uprof-card uprof-side-card">
            <div className="uprof-side-card-head">
              <h3>Sürətli giriş</h3>
            </div>
            <Link href={`/psychologists/${me.slug}`} target="_blank" className="uprof-side-link">
              <div className="uprof-side-link-icon">👤</div>
              <div className="uprof-side-link-text">
                <strong>Public profilim</strong>
                <small>Pasiyentlərə görünən səhifə</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
            <Link href="/psycholog/availability" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
              <div className="uprof-side-link-icon">🕓</div>
              <div className="uprof-side-link-text">
                <strong>İş vaxtları</strong>
                <small>Həftəlik cədvəl və istisnalar</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
            <Link href="/psycholog/calendar" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
              <div className="uprof-side-link-icon">📅</div>
              <div className="uprof-side-link-text">
                <strong>Cədvəl</strong>
                <small>Həftəlik randevu izləməsi</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
          </div>
        ) : null
      }
      extras={
        me ? (
          <>
          <GoogleCalendarCard />
          <div className="uprof-card">
            <div className="uprof-card-head">
              <h2>Public psixoloq profili</h2>
              <p>Pasiyentlərin gördüyü məlumatlar</p>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "var(--brand-50)", color: "var(--brand-700)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 22, flexShrink: 0,
                  border: "1px solid var(--brand-100)", overflow: "hidden",
                }}>
                  {me.photoUrl ? (
                     
                    <img src={me.photoUrl} alt={me.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    me.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{me.name}</div>
                  <div style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 2 }}>{me.title}</div>
                </div>
              </div>

              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: 0, fontSize: 13 }}>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>İxtisaslar</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>
                    {me.specializations?.slice(0, 4).join(" · ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Dillər</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>{me.languages || "—"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Təcrübə</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>{me.experience ?? "—"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Seans müddəti</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>{me.defaultSessionMinutes ?? 50} dəq</dd>
                </div>
              </dl>

              <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.6, padding: "10px 12px", background: "var(--brand-50)", borderRadius: 8, borderLeft: "3px solid var(--brand-200)" }}>
                Bio, ixtisas və sertifikat dəyişiklikləri üçün admin komandasıyla əlaqə saxlayın —
                hər güncəlləmə pasiyentlər tərəfindən görünür və yoxlanılır.
              </p>
            </div>
          </div>
          </>
        ) : null
      }
    />
  );
}
