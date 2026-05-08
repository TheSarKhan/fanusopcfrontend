"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileShell from "@/components/ProfileShell";
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
      extras={
        <div className="uprof-card">
          <div className="uprof-card-head">
            <h2>Psixoloq profili</h2>
            <p>Pasiyentlərə görünən public profiliniz</p>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {me ? (
              <>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "var(--brand-50)", color: "var(--brand-700)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 18, flexShrink: 0,
                    border: "1px solid var(--brand-100)",
                    overflow: "hidden",
                  }}>
                    {me.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={me.photoUrl} alt={me.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      me.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{me.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--oxford-60)", marginTop: 2 }}>{me.title}</div>
                  </div>
                </div>

                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: 0, fontSize: 12.5 }}>
                  <div>
                    <dt style={{ color: "var(--oxford-60)", fontWeight: 600 }}>İxtisaslar</dt>
                    <dd style={{ margin: "2px 0 0", color: "var(--oxford)" }}>
                      {me.specializations?.slice(0, 3).join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--oxford-60)", fontWeight: 600 }}>Dillər</dt>
                    <dd style={{ margin: "2px 0 0", color: "var(--oxford)" }}>{me.languages || "—"}</dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--oxford-60)", fontWeight: 600 }}>Təcrübə</dt>
                    <dd style={{ margin: "2px 0 0", color: "var(--oxford)" }}>{me.experience ?? "—"}</dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--oxford-60)", fontWeight: 600 }}>Seans müddəti</dt>
                    <dd style={{ margin: "2px 0 0", color: "var(--oxford)" }}>{me.defaultSessionMinutes ?? 50} dəq</dd>
                  </div>
                </dl>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {me.slug && (
                    <Link
                      href={`/psychologists/${me.slug}`}
                      target="_blank"
                      className="uprof-btn"
                      style={{
                        background: "var(--brand-50)", color: "var(--brand-700)",
                        border: "1px solid var(--brand-200)", textDecoration: "none",
                      }}>
                      Public profilə bax →
                    </Link>
                  )}
                  <Link
                    href="/psycholog/availability"
                    className="uprof-btn"
                    style={{
                      background: "var(--brand-50)", color: "var(--brand-700)",
                      border: "1px solid var(--brand-200)", textDecoration: "none",
                    }}>
                    Açıq vaxtlarımı redaktə et
                  </Link>
                </div>

                <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.5 }}>
                  Bio, ixtisas və sertifikat dəyişiklikləri üçün admin komandasıyla əlaqə saxlayın —
                  hər güncəlləmə pasiyentlər tərəfindən görünür və yoxlanılır.
                </p>
              </>
            ) : (
              <div style={{ color: "var(--oxford-60)", fontSize: 13, textAlign: "center", padding: 12 }}>
                Psixoloq profili yüklənmədi
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
