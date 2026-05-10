"use client";

import { useEffect, useMemo, useState } from "react";
import { patientApi, type Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PatientFavoritesPage() {
  const { t } = useT();
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.favorites()
      .then(setItems)
      .catch(e => setErr((e as Error).message))
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
          <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1A2535", marginBottom: 4 }}>{t("staff.patFavEmpty")}</div>
          <p style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>{t("staff.patFavEmptySub")}</p>
          <a href="/patient/psychologists" style={{ background: "var(--brand)", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            {t("staff.patFavBrowse")}
          </a>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {itemsWithSlug.map(p => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, overflow: "hidden", border: "1px solid var(--brand-100)" }}>
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
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
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <a href={`/patient/book/${p.slug}`} style={{ flex: 1, textAlign: "center", background: "var(--brand)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  {t("staff.patFavRebook")}
                </a>
                <button onClick={() => remove(p.id)}
                  style={{ padding: "8px 12px", border: "1px solid #FECACA", color: "#991B1B", background: "#fff", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
