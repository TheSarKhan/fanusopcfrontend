"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type TimeSlot, type TimeSlotOverride } from "@/lib/api";

const WEEKDAYS_AZ = [
  { iso: 1, label: "Bazar ertəsi" },
  { iso: 2, label: "Çərşənbə axşamı" },
  { iso: 3, label: "Çərşənbə" },
  { iso: 4, label: "Cümə axşamı" },
  { iso: 5, label: "Cümə" },
  { iso: 6, label: "Şənbə" },
  { iso: 7, label: "Bazar" },
];

function dayLabel(iso: number) {
  return WEEKDAYS_AZ.find(d => d.iso === iso)?.label ?? `Gün ${iso}`;
}

function trimSeconds(t: string) {
  // Backend returns "HH:mm:ss"; HTML time input wants "HH:mm"
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

export default function PsychologistAvailabilityPage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [overrides, setOverrides] = useState<TimeSlotOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Session length
  const [sessionMinutes, setSessionMinutes] = useState<number>(50);
  const [savedMinutes, setSavedMinutes] = useState<number>(50);
  const [savingMinutes, setSavingMinutes] = useState(false);

  // New slot form
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [savingSlot, setSavingSlot] = useState(false);

  // New override form
  const [oDate, setODate] = useState("");
  const [oType, setOType] = useState<"BLOCK" | "EXTRA">("BLOCK");
  const [oStart, setOStart] = useState("");
  const [oEnd, setOEnd] = useState("");
  const [oNote, setONote] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.listSlots().catch(() => []),
      psychologistApi.listOverrides().catch(() => []),
      psychologistApi.me().catch(() => null),
    ]).then(([s, o, me]) => {
      setSlots(s); setOverrides(o);
      const m = me?.defaultSessionMinutes && me.defaultSessionMinutes > 0 ? me.defaultSessionMinutes : 50;
      setSessionMinutes(m); setSavedMinutes(m);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const saveSessionMinutes = async () => {
    setError(null);
    if (sessionMinutes < 15 || sessionMinutes > 240) {
      setError("Sessiya müddəti 15–240 dəqiqə aralığında olmalıdır"); return;
    }
    setSavingMinutes(true);
    try {
      const updated = await psychologistApi.updateSessionMinutes(sessionMinutes);
      const m = updated.defaultSessionMinutes ?? sessionMinutes;
      setSavedMinutes(m); setSessionMinutes(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingMinutes(false);
    }
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newStart >= newEnd) { setError("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }
    setSavingSlot(true);
    try {
      const created = await psychologistApi.createSlot({ dayOfWeek: newDay, startTime: newStart, endTime: newEnd, active: true });
      setSlots(prev => [...prev, created].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setSavingSlot(false);
    }
  };

  const deleteSlot = async (id: number) => {
    if (!confirm("Bu vaxt aralığını silmək istədiyinizə əminsiniz?")) return;
    try {
      await psychologistApi.deleteSlot(id);
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  const toggleSlot = async (s: TimeSlot) => {
    try {
      const updated = await psychologistApi.updateSlot(s.id, {
        dayOfWeek: s.dayOfWeek, startTime: trimSeconds(s.startTime), endTime: trimSeconds(s.endTime),
        active: !s.active,
      });
      setSlots(prev => prev.map(x => x.id === s.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
  };

  const addOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!oDate) { setError("Tarix seçin"); return; }
    if (oType === "EXTRA" && (!oStart || !oEnd)) { setError("EXTRA üçün başlama və bitiş vaxtı tələb olunur"); return; }
    setSavingOverride(true);
    try {
      const data: { overrideDate: string; overrideType: "BLOCK" | "EXTRA"; startTime?: string; endTime?: string; note?: string } = {
        overrideDate: oDate, overrideType: oType, note: oNote || undefined,
      };
      if (oStart) data.startTime = oStart;
      if (oEnd) data.endTime = oEnd;
      const created = await psychologistApi.createOverride(data);
      setOverrides(prev => [created, ...prev]);
      setODate(""); setOStart(""); setOEnd(""); setONote("");
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setSavingOverride(false);
    }
  };

  const deleteOverride = async (id: number) => {
    if (!confirm("Bu istisnanı silmək istədiyinizə əminsiniz?")) return;
    try {
      await psychologistApi.deleteOverride(id);
      setOverrides(prev => prev.filter(o => o.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A2535]">Açıq vaxtlarım</h1>
        <p className="text-[#52718F] text-sm mt-1">Həftəlik təkrarlanan vaxtlar və konkret tarix istisnaları</p>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : (
        <>
        <section style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", marginBottom: 4 }}>Bir seansın müddəti</h2>
              <p style={{ fontSize: 12, color: "#52718F" }}>
                Açıq vaxt aralıqları bu müddətə görə müştərilərin görəcəyi slotlara bölünür (məsələn, 09:00–12:00 + 50 dəq → 09:00, 09:50, 10:40…).
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[30, 45, 50, 60, 90].map(m => (
                  <button key={m} type="button"
                    onClick={() => setSessionMinutes(m)}
                    style={{
                      padding: "6px 10px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                      border: sessionMinutes === m ? "2px solid var(--brand)" : "1px solid #E5E7EB",
                      background: sessionMinutes === m ? "var(--brand-50)" : "#fff",
                      color: sessionMinutes === m ? "var(--brand)" : "#1A2535",
                      cursor: "pointer",
                    }}>{m} dəq</button>
                ))}
              </div>
              <input type="number" min={15} max={240} step={5} value={sessionMinutes}
                onChange={e => setSessionMinutes(Number(e.target.value) || 0)}
                style={{ width: 80, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
              <span style={{ fontSize: 12, color: "#52718F" }}>dəq</span>
              <button onClick={saveSessionMinutes} disabled={savingMinutes || sessionMinutes === savedMinutes}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: sessionMinutes === savedMinutes ? "#E5E7EB" : "var(--brand)",
                  color: sessionMinutes === savedMinutes ? "#52718F" : "#fff",
                  fontSize: 13, fontWeight: 600,
                  cursor: savingMinutes || sessionMinutes === savedMinutes ? "default" : "pointer",
                }}>
                {savingMinutes ? "Saxlanılır…" : sessionMinutes === savedMinutes ? "Saxlanılıb" : "Yadda saxla"}
              </button>
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Weekly slots */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", marginBottom: 12 }}>Həftəlik vaxtlar</h2>

            <form onSubmit={addSlot} className="psy-avail-form" style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px auto", gap: 8, alignItems: "end", marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Gün</label>
                <select value={newDay} onChange={e => setNewDay(Number(e.target.value))}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}>
                  {WEEKDAYS_AZ.map(d => <option key={d.iso} value={d.iso}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Başlama</label>
                <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                  style={{ width: "100%", minWidth: 130, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Bitiş</label>
                <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                  style={{ width: "100%", minWidth: 130, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
              </div>
              <button type="submit" disabled={savingSlot}
                style={{ padding: "8px 14px", background: "var(--brand)", color: "#fff", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: savingSlot ? "wait" : "pointer" }}>
                + Əlavə et
              </button>
            </form>

            {slots.length === 0 ? (
              <div style={{ fontSize: 13, color: "#52718F", padding: 12, background: "#F9FAFB", borderRadius: 8, textAlign: "center" }}>
                Hələ heç bir vaxt göstərməmisiniz.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {slots.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid #EFF2F7", background: s.active ? "#fff" : "#F9FAFB", opacity: s.active ? 1 : 0.6 }}>
                    <div style={{ flex: 1, fontSize: 13, color: "#1A2535" }}>
                      <strong>{dayLabel(s.dayOfWeek)}</strong> · {trimSeconds(s.startTime)}–{trimSeconds(s.endTime)}
                    </div>
                    <button onClick={() => toggleSlot(s)} style={{ fontSize: 11, color: "#52718F", background: "transparent", border: "1px solid #E5E7EB", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                      {s.active ? "Deaktiv et" : "Aktivləşdir"}
                    </button>
                    <button onClick={() => deleteSlot(s.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Overrides */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", marginBottom: 4 }}>Tarix istisnaları</h2>
            <p style={{ fontSize: 12, color: "#52718F", marginBottom: 12 }}>BLOCK = bağla · EXTRA = əlavə vaxt</p>

            <form onSubmit={addOverride} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Tarix</label>
                  <input type="date" value={oDate} onChange={e => setODate(e.target.value)}
                    style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Tip</label>
                  <select value={oType} onChange={e => setOType(e.target.value as "BLOCK" | "EXTRA")}
                    style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}>
                    <option value="BLOCK">BLOCK</option>
                    <option value="EXTRA">EXTRA</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>
                    Başlama {oType === "BLOCK" && <span style={{ fontWeight: 400 }}>(boş = bütün gün)</span>}
                  </label>
                  <input type="time" value={oStart} onChange={e => setOStart(e.target.value)}
                    style={{ width: "100%", minWidth: 130, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F" }}>Bitiş</label>
                  <input type="time" value={oEnd} onChange={e => setOEnd(e.target.value)}
                    style={{ width: "100%", minWidth: 130, padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                </div>
              </div>
              <input type="text" value={oNote} onChange={e => setONote(e.target.value)} placeholder="Qeyd (məcburi deyil)"
                style={{ padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
              <button type="submit" disabled={savingOverride}
                style={{ padding: "8px 14px", background: "var(--brand)", color: "#fff", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: savingOverride ? "wait" : "pointer" }}>
                + Əlavə et
              </button>
            </form>

            {overrides.length === 0 ? (
              <div style={{ fontSize: 13, color: "#52718F", padding: 12, background: "#F9FAFB", borderRadius: 8, textAlign: "center" }}>
                İstisna yoxdur.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {overrides.map(o => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid #EFF2F7" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: o.overrideType === "BLOCK" ? "#FEF2F2" : "#ECFDF5", color: o.overrideType === "BLOCK" ? "#991B1B" : "#065F46", fontWeight: 600 }}>
                      {o.overrideType}
                    </span>
                    <div style={{ flex: 1, fontSize: 13, color: "#1A2535" }}>
                      <strong>{o.overrideDate}</strong>
                      {o.startTime && o.endTime && <span> · {trimSeconds(o.startTime)}–{trimSeconds(o.endTime)}</span>}
                      {o.note && <span style={{ color: "#52718F", marginLeft: 6 }}>· {o.note}</span>}
                    </div>
                    <button onClick={() => deleteOverride(o.id)} style={{ fontSize: 11, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        </>
      )}
    </div>
  );
}
