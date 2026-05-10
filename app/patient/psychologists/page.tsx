"use client";

import { useEffect, useMemo, useState } from "react";
import { getPsychologists, patientApi, type Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PatientPsychologistsPage() {
  const { t } = useT();
  const [items, setItems] = useState<Psychologist[]>([]);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busyFav, setBusyFav] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getPsychologists(), patientApi.favorites()])
      .then(([all, favs]) => {
        setItems(all);
        setFavIds(new Set(favs.map(f => f.id)));
      })
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const itemsWithSlug = useMemo(() => withSlugs(items), [items]);

  const filtered = useMemo(() => {
    if (!q.trim()) return itemsWithSlug;
    const s = q.toLowerCase();
    return itemsWithSlug.filter(p =>
      p.name.toLowerCase().includes(s)
      || p.title?.toLowerCase().includes(s)
      || (p.specializations || []).some(x => x.toLowerCase().includes(s))
    );
  }, [itemsWithSlug, q]);

  const toggleFav = async (psyId: number) => {
    setBusyFav(psyId);
    try {
      await patientApi.toggleFavorite(psyId);
      setFavIds(prev => {
        const next = new Set(prev);
        if (next.has(psyId)) next.delete(psyId);
        else next.add(psyId);
        return next;
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyFav(null);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A2535" }}>{t("patPsy.pageTitle")}</h1>
      <p style={{ color: "#52718F", fontSize: 14, marginTop: 4, marginBottom: 20 }}>
        {t("patPsy.pageSub")}
      </p>

      <input
        type="search"
        placeholder={t("patPsy.searchPh")}
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{
          width: "100%", maxWidth: 360,
          padding: "10px 14px", marginBottom: 18,
          borderRadius: 10, border: "1.5px solid var(--brand-100)",
          fontSize: 14, color: "#1A2535", background: "#fff",
        }}
      />

      {err && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {t("common.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {t("patPsy.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.map(p => {
            const isFav = favIds.has(p.id);
            return (
              <div key={p.id} style={{
                background: "#fff", borderRadius: 14, padding: 18,
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "var(--brand-50)", color: "var(--brand)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 18, overflow: "hidden",
                    border: "1px solid var(--brand-100)",
                  }}>
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : p.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#1A2535", fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#52718F" }}>{p.title}</div>
                  </div>
                  <button
                    onClick={() => toggleFav(p.id)}
                    disabled={busyFav === p.id}
                    aria-label={isFav ? t("patPsy.unfav") : t("patPsy.fav")}
                    style={{
                      width: 34, height: 34, borderRadius: "50%",
                      border: "none", cursor: busyFav === p.id ? "default" : "pointer",
                      background: isFav ? "#FEE2E2" : "var(--brand-50)",
                      color: isFav ? "#DC2626" : "#52718F",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>
                    {isFav ? "♥" : "♡"}
                  </button>
                </div>
                {p.specializations && p.specializations.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {p.specializations.slice(0, 3).map(s => (
                      <span key={s} style={{
                        fontSize: 11, padding: "3px 8px", borderRadius: 999,
                        background: "var(--brand-50)", color: "var(--brand-700)",
                        fontWeight: 600, border: "1px solid var(--brand-100)",
                      }}>{s}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#52718F" }}>
                  {p.experience && <span>⏱ {p.experience} {t("patPsy.years")}</span>}
                  {p.defaultSessionMinutes && <span>· {p.defaultSessionMinutes} {t("patPsy.min")}</span>}
                  {p.rating && <span>· ★ {p.rating}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <a href={`/patient/psychologists/${p.slug}`} style={{
                    padding: "9px 14px",
                    border: "1.5px solid var(--brand-200)",
                    color: "#1A2535", background: "transparent",
                    borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none",
                  }}>
                    {t("patPsy.viewProfile")}
                  </a>
                  <a href={`/patient/book/${p.slug}`} style={{
                    flex: 1, textAlign: "center",
                    background: "var(--brand)", color: "#fff",
                    padding: "9px 14px", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}>
                    {t("patPsy.book")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
