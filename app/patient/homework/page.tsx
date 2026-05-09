"use client";

import { useEffect, useState } from "react";
import { patientApi, type Homework } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const STATUS_BG: Record<string, string> = {
  PENDING: "#FEF3C7", COMPLETED: "#D1FAE5", SKIPPED: "#E5E7EB",
};
const STATUS_FG: Record<string, string> = {
  PENDING: "#92400E", COMPLETED: "#065F46", SKIPPED: "#52718F",
};

export default function PatientHomeworkPage() {
  const { t } = useT();
  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    patientApi.homework().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const mark = async (h: Homework, status: "COMPLETED" | "SKIPPED" | "PENDING") => {
    let note: string | undefined;
    if (status === "COMPLETED") {
      note = prompt("Tapşırığa dair qeyd (məcburi deyil):") ?? undefined;
    }
    try {
      const updated = await patientApi.markHomework(h.id, { status, completionNote: note });
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>{t("staff.patHwTitle")}</h1>
      <p style={{ fontSize: 13, color: "#52718F", marginTop: 4, marginBottom: 20 }}>
        {t("staff.patHwSub")}
      </p>

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
          <div style={{ fontWeight: 600, color: "#1A2535" }}>{t("staff.patHwEmpty")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map(h => (
            <div key={h.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid #EFF2F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ background: STATUS_BG[h.status], color: STATUS_FG[h.status], fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                      {h.status === "PENDING" ? "GÖZLƏNİR" : h.status === "COMPLETED" ? "TAMAMLANDI" : "ÖTÜRÜLDÜ"}
                    </span>
                    {h.dueDate && (
                      <span style={{ fontSize: 11, color: "#52718F" }}>Son tarix: {h.dueDate}</span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A2535", margin: "4px 0" }}>{h.title}</h3>
                  <div style={{ fontSize: 12, color: "#52718F" }}>{h.psychologistName}</div>
                </div>
              </div>
              {h.description && (
                <div style={{ fontSize: 13, color: "#1A2535", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                  {h.description}
                </div>
              )}
              {h.completionNote && (
                <div style={{ fontSize: 12, color: "#52718F", padding: "6px 10px", background: "#F9FAFB", borderRadius: 6 }}>
                  Sizin qeyd: {h.completionNote}
                </div>
              )}
              {h.status === "PENDING" && (
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button onClick={() => mark(h, "COMPLETED")}
                    style={{ flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, background: "#10B981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {t("staff.patHwDone")}
                  </button>
                  <button onClick={() => mark(h, "SKIPPED")}
                    style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#52718F", fontSize: 12, cursor: "pointer" }}>
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
