"use client";

import { useMemo, useState } from "react";
import { psychologistApi, type ClientSummary } from "@/lib/api";

export default function AssignTestModal({
  testId,
  testTitle,
  clients,
  onClose,
  onAssigned,
}: {
  testId: number;
  testTitle: string;
  clients: ClientSummary[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      (c.name + " " + (c.email ?? "") + " " + (c.phone ?? "")).toLowerCase().includes(q)
    );
  }, [clients, search]);

  const submit = async () => {
    if (patientId === null) {
      setErr("Pasiyent seçin");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await psychologistApi.assignTest({ testId, patientId, note: note.trim() || undefined });
      onAssigned();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: 0 }}>Testi təyin et</h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            «{testTitle}» — pasiyent seçin, ona bildiriş gedəcək.
          </p>
        </div>

        <div style={{ padding: 22, overflowY: "auto" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pasiyent axtar (ad, email, telefon)…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", marginBottom: 14 }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 13, color: "#52718F", padding: "16px 4px", textAlign: "center" }}>Pasiyent tapılmadı.</div>
            ) : (
              filtered.map((c) => {
                const active = patientId === c.patientId;
                return (
                  <button
                    key={c.patientId}
                    type="button"
                    onClick={() => setPatientId(c.patientId)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      border: active ? "1.5px solid var(--brand)" : "1px solid #E5E7EB",
                      background: active ? "var(--brand-50)" : "#fff",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: "#52718F" }}>{c.email || c.phone || "—"}</span>
                  </button>
                );
              })
            )}
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Qeyd (məcburi deyil)
          </label>
          <textarea
            rows={3}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pasiyentə göstərilən qısa təlimat…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />

          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid #EFF2F7" }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: saving ? "wait" : "pointer" }}>
            Bağla
          </button>
          <button onClick={submit} disabled={saving || patientId === null} style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving || patientId === null ? 0.6 : 1 }}>
            {saving ? "Təyin edilir…" : "Təyin et"}
          </button>
        </div>
      </div>
    </div>
  );
}
