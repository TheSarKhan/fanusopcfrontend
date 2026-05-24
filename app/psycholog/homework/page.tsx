"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type ClientSummary, type Homework } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

type Filter = "ALL" | "OVERDUE" | "PENDING" | "COMPLETED" | "SKIPPED";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysOverdue(dueDate?: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T23:59:59");
  const diffMs = Date.now() - due.getTime();
  if (diffMs <= 0) return null;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isOverdue(h: Homework): boolean {
  return h.status === "PENDING" && daysOverdue(h.dueDate) !== null;
}

export default function PsychologHomeworkPage() {
  const { t } = useT();
  const [items, setItems] = useState<Homework[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.homework().catch(() => []),
      psychologistApi.clients().catch(() => []),
    ]).then(([h, c]) => { setItems(h); setClients(c); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const counts = useMemo(() => ({
    all: items.length,
    overdue: items.filter(isOverdue).length,
    pending: items.filter(h => h.status === "PENDING").length,
    completed: items.filter(h => h.status === "COMPLETED").length,
    skipped: items.filter(h => h.status === "SKIPPED").length,
  }), [items]);

  const visible = useMemo(() => {
    if (filter === "ALL") {
      // Overdue first, then by dueDate ascending (closest deadline next), then no due-date
      return [...items].sort((a, b) => {
        const aOver = isOverdue(a) ? 1 : 0;
        const bOver = isOverdue(b) ? 1 : 0;
        if (aOver !== bOver) return bOver - aOver;
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    if (filter === "OVERDUE") return items.filter(isOverdue);
    return items.filter(h => h.status === filter);
  }, [items, filter]);

  const reset = () => { setShowForm(false); setPatientId(""); setTitle(""); setDescription(""); setDueDate(""); setErr(null); };

  const save = async () => {
    if (!patientId) { setErr("Müştəri seçin"); return; }
    if (!title.trim()) { setErr("Başlıq lazımdır"); return; }
    setSaving(true); setErr(null);
    try {
      const created = await psychologistApi.createHomework({
        patientId: Number(patientId), title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      });
      setItems(prev => [created, ...prev]);
      reset();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Tapşırığı silmək istəyirsiniz?")) return;
    try { await psychologistApi.deleteHomework(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <div>
      <div className="psy-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535" }}>{t("staff.psyHomeworkTitle")}</h1>
          <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>{t("staff.psyHomeworkSub")}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {t("staff.psyHomeworkNew")}
        </button>
      </div>

      {/* Filter strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
        <FilterChip label="Hamısı"     value={counts.all}       active={filter === "ALL"}       tone="brand"   onClick={() => setFilter("ALL")} />
        <FilterChip label="Gecikən"    value={counts.overdue}   active={filter === "OVERDUE"}   tone="danger"  onClick={() => setFilter("OVERDUE")} highlight={counts.overdue > 0} />
        <FilterChip label="Gözləyir"   value={counts.pending}   active={filter === "PENDING"}   tone="warn"    onClick={() => setFilter("PENDING")} />
        <FilterChip label="Tamamlandı" value={counts.completed} active={filter === "COMPLETED"} tone="good"    onClick={() => setFilter("COMPLETED")} />
        <FilterChip label="Atlandı"    value={counts.skipped}   active={filter === "SKIPPED"}   tone="muted"   onClick={() => setFilter("SKIPPED")} />
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Yeni tapşırıq</h3>
          <select value={patientId} onChange={e => setPatientId(e.target.value ? Number(e.target.value) : "")}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }}>
            <option value="">— Müştəri seç —</option>
            {clients.map(c => <option key={c.patientId} value={c.patientId}>{c.name}</option>)}
          </select>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Başlıq"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Təsvir / Təlimat"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8, fontFamily: "inherit", resize: "vertical" }} />
          <input type="date" value={dueDate} min={todayIso()} onChange={e => setDueDate(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 8 }} />
          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Ləğv</button>
            <button onClick={save} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saxlanılır…" : "Saxla"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {filter === "ALL" ? "Hələ tapşırıq yoxdur." : "Bu filtrdə tapşırıq yoxdur."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visible.map(h => {
            const overdue = isOverdue(h);
            const overdueBy = overdue ? daysOverdue(h.dueDate) : null;
            return (
              <div key={h.id} style={{
                background: "#fff",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                border: overdue ? "1px solid #FCA5A5" : "1px solid #EFF2F7",
                borderLeft: overdue ? "4px solid #DC2626" : "1px solid #EFF2F7",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, fontSize: 11, color: "#52718F", flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: h.status === "COMPLETED" ? "#D1FAE5" : h.status === "SKIPPED" ? "#E5E7EB" : "#FEF3C7", color: h.status === "COMPLETED" ? "#065F46" : h.status === "SKIPPED" ? "#52718F" : "#92400E", fontWeight: 700 }}>
                        {h.status === "COMPLETED" ? "Tamamlandı" : h.status === "SKIPPED" ? "Atlandı" : "Gözləyir"}
                      </span>
                      {overdue && (
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#FEE2E2", color: "#991B1B", fontWeight: 700 }}>
                          ⚠ {overdueBy} gün gecikib
                        </span>
                      )}
                      <span>{h.patientName}</span>
                      {h.dueDate && <span>· son tarix: {h.dueDate}</span>}
                    </div>
                    <div style={{ fontWeight: 700, color: "#1A2535", fontSize: 14 }}>{h.title}</div>
                    {h.description && <div style={{ fontSize: 12, color: "#52718F", marginTop: 4, whiteSpace: "pre-wrap" }}>{h.description}</div>}
                    {h.completionNote && (
                      <div style={{ fontSize: 12, color: "#1A2535", marginTop: 6, padding: "6px 10px", background: "#EEF2FF", borderRadius: 6 }}>
                        Müştəri qeydi: {h.completionNote}
                      </div>
                    )}
                  </div>
                  <button onClick={() => remove(h.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Sil</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label, value, active, tone, onClick, highlight,
}: {
  label: string;
  value: number;
  active: boolean;
  tone: "brand" | "good" | "warn" | "danger" | "muted";
  onClick: () => void;
  highlight?: boolean;
}) {
  const colors: Record<typeof tone, { fg: string; bg: string; activeBg: string }> = {
    brand:  { fg: "#1A2535", bg: "#EEF5FF", activeBg: "var(--brand)" },
    good:   { fg: "#065F46", bg: "#D1FAE5", activeBg: "#10B981" },
    warn:   { fg: "#92400E", bg: "#FEF3C7", activeBg: "#F59E0B" },
    danger: { fg: "#991B1B", bg: "#FEE2E2", activeBg: "#DC2626" },
    muted:  { fg: "#52718F", bg: "#F3F4F6", activeBg: "#6B7280" },
  };
  const c = colors[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "10px 14px",
        borderRadius: 12,
        border: highlight && !active ? `1.5px solid ${c.activeBg}` : "1px solid #E5E7EB",
        background: active ? c.activeBg : "#fff",
        color: active ? "#fff" : c.fg,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.9 : 0.7 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800 }}>{value}</span>
    </button>
  );
}
