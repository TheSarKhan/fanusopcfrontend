"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  operatorApi,
  type Psychologist,
  type TimeSlot,
  type TimeSlotOverride,
} from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";

const WEEKDAYS_AZ = [
  { iso: 1, label: "Bazar ertəsi" },
  { iso: 2, label: "Çərşənbə axşamı" },
  { iso: 3, label: "Çərşənbə" },
  { iso: 4, label: "Cümə axşamı" },
  { iso: 5, label: "Cümə" },
  { iso: 6, label: "Şənbə" },
  { iso: 7, label: "Bazar" },
];

const dayLabel = (iso: number) => WEEKDAYS_AZ.find(d => d.iso === iso)?.label ?? `Gün ${iso}`;
const trimSec = (t: string) => t?.length >= 5 ? t.slice(0, 5) : t;

export default function AdminPsychologistAvailabilityPage() {
  const params = useParams<{ id: string }>();
  const psyId = Number(params.id);

  const [psy, setPsy] = useState<Psychologist | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [overrides, setOverrides] = useState<TimeSlotOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [oDate, setODate] = useState("");
  const [oType, setOType] = useState<"BLOCK" | "EXTRA">("BLOCK");
  const [oStart, setOStart] = useState("");
  const [oEnd, setOEnd] = useState("");
  const [oNote, setONote] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      operatorApi.listPsychologists().then(list => list.find(p => p.id === psyId) ?? null).catch(() => null),
      operatorApi.psyTimeSlots(psyId).catch(() => []),
      operatorApi.psyOverrides(psyId).catch(() => []),
    ]).then(([p, s, o]) => {
      setPsy(p); setSlots(s); setOverrides(o);
    }).finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load identity changes every render; re-fetch only on psyId change
  useEffect(() => { if (Number.isFinite(psyId)) load(); }, [psyId]);

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newStart >= newEnd) { setError("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }
    try {
      const created = await operatorApi.createPsyTimeSlot(psyId, { dayOfWeek: newDay, startTime: newStart, endTime: newEnd, active: true });
      setSlots(prev => [...prev, created].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    } catch (e2) { setError((e2 as Error).message); }
  };

  const deleteSlot = async (id: number) => {
    if (!confirm("Bu vaxtı silmək istəyirsiniz?")) return;
    try {
      await operatorApi.deletePsyTimeSlot(psyId, id);
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  const addOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!oDate) { setError("Tarix seçin"); return; }
    if (oType === "EXTRA" && (!oStart || !oEnd)) { setError("EXTRA üçün başlama və bitiş tələb olunur"); return; }
    try {
      const data: { overrideDate: string; overrideType: "BLOCK" | "EXTRA"; startTime?: string; endTime?: string; note?: string } = {
        overrideDate: oDate, overrideType: oType, note: oNote || undefined,
      };
      if (oStart) data.startTime = oStart;
      if (oEnd) data.endTime = oEnd;
      const created = await operatorApi.createPsyOverride(psyId, data);
      setOverrides(prev => [created, ...prev]);
      setODate(""); setOStart(""); setOEnd(""); setONote("");
    } catch (e2) { setError((e2 as Error).message); }
  };

  const deleteOverride = async (id: number) => {
    if (!confirm("Bu istisnanı silmək istəyirsiniz?")) return;
    try {
      await operatorApi.deletePsyOverride(psyId, id);
      setOverrides(prev => prev.filter(o => o.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{psy ? `${psy.name} – Açıq vaxtlar` : "Psixoloq vaxtları"}</h1>
          <p className="page-sub">Həftəlik cədvəl və konkret tarix istisnaları</p>
        </div>
        <a href="/admin/psychologists" className="btn">Psixoloqlara qayıt</a>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ background: "var(--surface)", padding: 40, borderRadius: 12, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Həftəlik vaxtlar</h2>
            <form onSubmit={addSlot} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
              <select value={newDay} onChange={e => setNewDay(Number(e.target.value))}
                style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
                {WEEKDAYS_AZ.map(d => <option key={d.iso} value={d.iso}>{d.label}</option>)}
              </select>
              <div style={{ width: 120 }}>
                <TimePicker value={newStart} onChange={setNewStart} theme="light" size="sm" />
              </div>
              <div style={{ width: 120 }}>
                <TimePicker value={newEnd} onChange={setNewEnd} theme="light" size="sm" />
              </div>
              <button type="submit" className="btn" style={{ background: "var(--ox)", color: "#fff" }}>+ Əlavə et</button>
            </form>

            {slots.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: 12, textAlign: "center" }}>Hələ vaxt yoxdur.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {slots.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <strong>{dayLabel(s.dayOfWeek)}</strong> · {trimSec(s.startTime)}–{trimSec(s.endTime)}
                      {!s.active && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)" }}>(deaktiv)</span>}
                    </div>
                    <button onClick={() => deleteSlot(s.id)} className="btn" style={{ fontSize: 11, color: "var(--rose)" }}>Sil</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Tarix istisnaları</h2>
            <form onSubmit={addOverride} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <DatePicker theme="light" size="sm" style={{ width: "100%" }} value={oDate} onChange={setODate} />
                <select value={oType} onChange={e => setOType(e.target.value as "BLOCK" | "EXTRA")}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
                  <option value="BLOCK">BLOCK</option>
                  <option value="EXTRA">EXTRA</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <TimePicker value={oStart} onChange={setOStart} placeholder="Başlama" theme="light" size="sm" />
                <TimePicker value={oEnd} onChange={setOEnd} placeholder="Bitiş" theme="light" size="sm" />
              </div>
              <input type="text" value={oNote} onChange={e => setONote(e.target.value)} placeholder="Qeyd"
                style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
              <button type="submit" className="btn" style={{ background: "var(--ox)", color: "#fff" }}>+ Əlavə et</button>
            </form>

            {overrides.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: 12, textAlign: "center" }}>İstisna yoxdur.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {overrides.map(o => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: o.overrideType === "BLOCK" ? "#FEF2F2" : "#ECFDF5", color: o.overrideType === "BLOCK" ? "#991B1B" : "#065F46", fontWeight: 600 }}>
                      {o.overrideType}
                    </span>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <strong>{o.overrideDate}</strong>
                      {o.startTime && o.endTime && <span> · {trimSec(o.startTime)}–{trimSec(o.endTime)}</span>}
                      {o.note && <span style={{ color: "var(--muted)", marginLeft: 6 }}>· {o.note}</span>}
                    </div>
                    <button onClick={() => deleteOverride(o.id)} className="btn" style={{ fontSize: 11, color: "var(--rose)" }}>Sil</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
