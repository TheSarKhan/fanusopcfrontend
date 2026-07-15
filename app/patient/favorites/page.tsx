"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { patientApi, type Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PatientFavoritesPage() {
  const { t } = useT();
  const [items, setItems] = useState<Psychologist[]>([]);
  // Psychologist ids the patient has already had a completed session with —
  // only these earn the "Yenidən randevu" (re-book) label. Merely favouriting
  // a psychologist does not.
  const [seenPsyIds, setSeenPsyIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.allSettled([patientApi.favorites(), patientApi.myAppointments()])
      .then(([favRes, apptRes]) => {
        if (favRes.status === "fulfilled") setItems(favRes.value);
        else setErr((favRes.reason as Error).message);
        if (apptRes.status === "fulfilled") {
          const seen = new Set<number>();
          for (const a of apptRes.value) {
            if (a.status === "COMPLETED" && a.psychologistId != null) seen.add(a.psychologistId);
          }
          setSeenPsyIds(seen);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const itemsWithSlug = useMemo(() => withSlugs(items), [items]);

  const remove = async (psyId: number) => {
    try {
      await patientApi.toggleFavorite(psyId);
      setItems(prev => prev.filter(p => p.id !== psyId));
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A2535" }}>{t("staff.patFavTitle")}</h1>
      <p style={{ color: "#52718F", fontSize: 14, marginTop: 4, marginBottom: 24 }}>
        {t("staff.patFavSub")}
      </p>

      {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16 }}>{err}</div>}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--brand-200)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1A2535", marginBottom: 4 }}>{t("staff.patFavEmpty")}</div>
          <p style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>{t("staff.patFavEmptySub")}</p>
          <Link href="/patient/psychologists" style={{ background: "var(--brand)", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            {t("staff.patFavBrowse")}
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
          {itemsWithSlug.map(p => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, overflow: "hidden", border: "1px solid var(--brand-100)" }}>
                  {p.photoUrl ? (
                     
                    <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : p.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#1A2535", fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#52718F" }}>{p.title}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.specializations.slice(0, 3).map(s => (
                  <span key={s} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "var(--brand-50)", color: "var(--brand-700)", fontWeight: 600, border: "1px solid var(--brand-100)" }}>{s}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center" }}>
                <a href={`/patient/book/${p.slug}`} style={{ flex: 1, textAlign: "center", background: "var(--brand)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  {t(seenPsyIds.has(p.id) ? "staff.patFavRebook" : "staff.patFavBook")}
                </a>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={t("staff.patFavRemove")}
                  title={t("staff.patFavRemove")}
                  style={{
                    flex: "0 0 auto",
                    width: 36, height: 36, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid #FECACA", background: "#fff",
                    cursor: "pointer", padding: 0,
                  }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="#DC2626" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
