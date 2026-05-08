"use client";

import { useEffect, useState } from "react";
import { patientApi, type SharedResource } from "@/lib/api";

export default function PatientLibraryPage() {
  const [items, setItems] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    patientApi.library().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = async (s: SharedResource) => {
    if (!s.viewedAt) {
      try { await patientApi.markLibraryViewed(s.shareId); } catch { /* ignore */ }
      setItems(prev => prev.map(x => x.shareId === s.shareId ? { ...x, viewedAt: new Date().toISOString() } : x));
    }
    const url = s.fileUrl || s.externalUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>Resurslar</h1>
      <p style={{ fontSize: 13, color: "#52718F", marginTop: 4, marginBottom: 20 }}>
        Psixoloqunuzun sizə paylaşdığı materiallar
      </p>

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
          <div style={{ fontWeight: 600, color: "#1A2535" }}>Hələ resurs yoxdur</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {items.map(s => (
            <div key={s.shareId} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: !s.viewedAt ? "2px solid var(--brand)" : "1px solid #EFF2F7", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 20 }}>{s.resourceType === "FILE" ? "📄" : s.resourceType === "ARTICLE" ? "📝" : "🔗"}</span>
                <div style={{ flex: 1, fontWeight: 700, color: "#1A2535" }}>{s.title}</div>
                {!s.viewedAt && <span style={{ background: "#DC2626", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999 }}>YENİ</span>}
              </div>
              {s.description && <div style={{ fontSize: 12, color: "#52718F", lineHeight: 1.4 }}>{s.description}</div>}
              {s.note && (
                <div style={{ fontSize: 11, color: "var(--brand-700)", padding: "6px 10px", background: "#EEF2FF", borderRadius: 6 }}>
                  💬 {s.note}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#8AAABF", marginTop: "auto" }}>
                {s.psychologistName} · {new Date(s.sharedAt).toLocaleDateString("az-AZ")}
              </div>
              <button onClick={() => open(s)}
                style={{ padding: "8px 12px", border: "none", borderRadius: 8, background: "var(--brand)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Aç →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
