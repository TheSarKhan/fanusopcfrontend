"use client";

/**
 * Paket detal səhifəsi — Randevular siyahısındakı paket kartından açılır.
 * Paketin seansları kart kimi: təyin edilmiş seans → solid kart (klik → randevu
 * bileti); təyin edilməmiş seans və paket balansının qalan yerləri → "+" kartı
 * (klik → təyinat / planlama). Geri düyməsi Randevular siyahısına qaytarır.
 */

import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type AppointmentDetail, type AvailableSlot, type Psychologist } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import { statusMeta } from "@/lib/appointmentStatus";
import { azLocalToISO, azFormatDate, azFormatTime, azFormatDateTime, isoToAzLocal } from "@/lib/datetime";

const PKG_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: "Aktiv",       bg: "#D1FAE5", color: "#065F46" },
  EXHAUSTED: { label: "Tamamlanıb",  bg: "#F3F4F6", color: "#374151" },
  EXPIRED:   { label: "Vaxtı keçib", bg: "#FEF3C7", color: "#92400E" },
  CANCELLED: { label: "Ləğv",        bg: "#FEE2E2", color: "#991B1B" },
};

function Svg({ d, w = 16, sw = 2, stroke = "currentColor", style }: { d: ReactNode; w?: number; sw?: number; stroke?: string; style?: React.CSSProperties }) {
  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>{d}</svg>;
}

function fmtDateTime(iso?: string | null) {
  return iso ? azFormatDateTime(iso) : "—";
}

export default function OperatorPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const packageId = Number(idStr);
  const router = useRouter();

  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    operatorApi.listAppointments()
      .then(all => setItems(all.filter(a => a.patientPackageId === packageId)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [packageId]);

  useEffect(() => { load(); }, [load]);

  const sessions = useMemo(
    () => [...items].sort((x, y) => new Date(x.startAt ?? x.createdAt).getTime() - new Date(y.startAt ?? y.createdAt).getTime()),
    [items]);

  const backToList = () => router.push("/operator/appointments");

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>;
  }
  if (sessions.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", marginBottom: 8 }}>Paket tapılmadı</div>
        <button onClick={backToList} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 9, border: "1px solid #D6E2F7", background: "#fff", color: "var(--oxford)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Randevulara qayıt
        </button>
      </div>
    );
  }

  const first = sessions[0];
  const total = first.packageTotal ?? sessions.length;
  const remaining = first.packageRemaining ?? 0;
  const scheduledCount = sessions.filter(s => s.startAt).length;
  const emptyCount = Math.max(0, total - scheduledCount);
  const pct = total > 0 ? Math.round((scheduledCount / total) * 100) : 0;
  const st = PKG_STATUS[first.packageStatus ?? "ACTIVE"] ?? PKG_STATUS.ACTIVE;
  const active = first.packageStatus == null || first.packageStatus === "ACTIVE";
  // Balans "+" xanaları: mövcud seans sətirlərini ikiqat saymamaq üçün ümumi
  // seans sayından mövcud sətirləri çıxırıq (balansla məhdudlaşdırılmış).
  const balanceTiles = active ? Math.max(0, Math.min(remaining, total - sessions.length)) : 0;

  return (
    <div>
      <button onClick={backToList}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", color: "var(--oxford-60)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}>
        <Svg w={15} d={<path d="M15 18l-6-6 6-6" />} /> Randevular
      </button>

      {/* Paket başlığı */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EDF1F8", boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: "3px solid #B45309", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: "#FEF3C7", color: "#B45309", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Svg w={22} d={<><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>} />
          </span>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--oxford)" }}>{first.packageName ?? "Paket"}</span>
              <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
              {first.patientName ?? "—"}{first.psychologistName ? ` · ${first.psychologistName}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#B45309", lineHeight: 1 }}>{scheduledCount}/{total}</div>
            <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 3 }}>{scheduledCount} təyin · {emptyCount} boş</div>
          </div>
        </div>
        <div style={{ height: 6, background: "#EEF2F7", borderRadius: 999, marginTop: 14, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#B45309", borderRadius: 999 }} />
        </div>
      </div>

      {/* Seanslar — dolu kartlar + boş "+" xanalar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
        {sessions.map(a => (
          <SessionCard key={a.id} a={a} onOpen={() => router.push(`/operator/appointments/${a.id}?pkg=${packageId}`)} />
        ))}
        {Array.from({ length: balanceTiles }).map((_, i) => (
          <AddSlotCard key={`slot-${i}`} onClick={() => setScheduleOpen(true)} />
        ))}
      </div>

      {scheduleOpen && (
        <AddPackageSessionModal
          sessions={sessions}
          onClose={() => setScheduleOpen(false)}
          onDone={() => { setScheduleOpen(false); load(); }}
        />
      )}
    </div>
  );
}

/** Bir seans:
 *  · Təyin edilib (startAt var) → solid kart, klik → randevu bileti.
 *  · Təyin edilməyib, amma pasiyent vaxt/psixoloq seçib → seçimini göstərən kart + "Təyin et".
 *  · Heç nə seçilməyib → sadə "+" kartı. */
function SessionCard({ a, onOpen }: { a: AppointmentDetail; onOpen: () => void }) {
  const meta = statusMeta(a.status);
  const assigned = !!a.startAt;

  if (assigned) {
    return (
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
        style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 12, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 7, minHeight: 118 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5, fontWeight: 700, color: "#52718F" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
          <span style={{ background: meta.bg, color: meta.fg, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{meta.label}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{fmtDateTime(a.startAt)}</div>
        {a.psychologistName && <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{a.psychologistName}</div>}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>
          Aç <Svg w={13} sw={2.2} d={<path d="M9 18l6-6-6-6" />} />
        </div>
      </div>
    );
  }

  // Təyin edilməyib — pasiyentin seçdiyi vaxt/psixoloq varsa göstər.
  const hasPref = !!(a.requestedStartAt || a.requestedPsychologistName);

  // Təyin edilməyib kartları GÖZƏ BATAN kəhrəba rəngdədir — operator bunların
  // təyin edilməli olduğunu dərhal görsün (sakit ağ "təyin olunmuş" kartlardan
  // və solğun "balansdan" xanalarından açıq fərqlənir).
  if (!hasPref) {
    return (
      <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 118, background: "#FEF3C7", border: "1.5px solid #F59E0B", borderRadius: 12, color: "#B45309", cursor: "pointer", padding: 13, fontFamily: "inherit" }}>
        <Svg w={22} sw={2.2} d={<path d="M12 5v14M5 12h14" />} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>Təyin et</span>
        <span style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>#FNS-{String(a.id).padStart(4, "0")}</span>
      </div>
    );
  }

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ background: "#FFFBEB", border: "1.5px solid #F59E0B", borderRadius: 12, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, minHeight: 118 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5, fontWeight: 700, color: "#92400E" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
        <span style={{ background: "#F59E0B", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>Təyin edilməyib</span>
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {a.requestedStartAt && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
            <Svg w={13} stroke="#B45309" d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
            {fmtDateTime(a.requestedStartAt)}
          </div>
        )}
        {a.requestedPsychologistName && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
            <Svg w={13} stroke="#B45309" d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
            {a.requestedPsychologistName}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#B45309", fontWeight: 600 }}>Pasiyentin seçimi</div>
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#B45309" }}>
        <Svg w={14} sw={2.2} d={<path d="M12 5v14M5 12h14" />} /> Təyin et
      </div>
    </div>
  );
}

/** Paket balansının boş yeri — klik → planlama modalı. Neytral/solğun rəngdədir:
 *  "təyin edilməli" (kəhrəba) kartlardan fərqli, bu opsional əməliyyatdır. */
function AddSlotCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 118, background: "#F8FAFD", border: "1.5px dashed #D6E2F7", borderRadius: 12, color: "#52718F", cursor: "pointer", padding: 13, fontFamily: "inherit" }}>
      <Svg w={22} sw={2.2} d={<path d="M12 5v14M5 12h14" />} />
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>Yeni seans</span>
      <span style={{ fontSize: 11, color: "#9DB0CC", fontWeight: 600 }}>balansdan</span>
    </button>
  );
}

function addMinutesLocal(local: string, mins: number): string {
  const d = new Date(local);
  d.setMinutes(d.getMinutes() + mins);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function dateOnlyLocal(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Paket balansından 1 seans sərf edərək yeni CONFIRMED randevu yaradır. */
function AddPackageSessionModal({ sessions, onClose, onDone }: {
  sessions: AppointmentDetail[]; onClose: () => void; onDone: () => void;
}) {
  const first = sessions[0];
  const patientId = first.patientId as number;
  const packageId = first.patientPackageId as number;
  // Paketin psixoloqu: təyin olunmuş istənilən seans onu daşıyır. Heç bir seans
  // təyin olunmayıbsa (yeni paket) operator siyahıdan seçəcək.
  const pkgPsyId = (first.psychologistId ?? sessions.find(s => s.psychologistId != null)?.psychologistId ?? null) as number | null;
  // Psixoloq: paketin öz psixoloqu varsa default odur; yoxdursa (pasiyent
  // seçməyibsə) operator siyahıdan seçir.
  const [psyId, setPsyId] = useState<number | null>(pkgPsyId);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    operatorApi.listPsychologists().then(setPsychologists).catch(() => {});
  }, []);

  useEffect(() => {
    if (psyId == null) { setSlots([]); setSlotsLoading(false); return; }
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, dateOnlyLocal(today), dateOnlyLocal(to))
      .then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [psyId]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const submit = async () => {
    setErr(null);
    if (psyId == null) { setErr("Psixoloq seçin"); return; }
    if (!start || !end) { setErr("Vaxt seçin və ya əl ilə daxil edin"); return; }
    const startAt = azLocalToISO(start);
    const endAt = azLocalToISO(end);
    if (new Date(startAt) >= new Date(endAt)) { setErr("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }
    setSaving(true);
    try {
      await operatorApi.schedulePackageSession(patientId, packageId, { startAt, endAt, psychologistId: psyId });
      onDone();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  const selectPsy = (id: number | null) => {
    setPsyId(id);
    setStart(""); setEnd(""); setManualOpen(false);
  };

  const fieldLab: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>Paket seansı əlavə et</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>
            {first.packageName} · {first.packageRemaining ?? 0} seans qalıb{first.psychologistName ? ` · ${first.psychologistName}` : ""}
          </div>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto" }}>
          {/* Psixoloq seçimi — paketin psixoloqu varsa default, yoxdursa operator seçir. */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 7 }}>
              Psixoloq{pkgPsyId == null && <span style={{ color: "#B45309" }}> · pasiyent seçməyib</span>}
            </span>
            <select value={psyId ?? ""} onChange={e => selectPsy(e.target.value ? Number(e.target.value) : null)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #D6E2F7", background: "#fff", fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="">Psixoloq seçin…</option>
              {psychologists.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {psyId == null ? (
            <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>
              Boş saatları görmək üçün əvvəlcə psixoloq seçin.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 10 }}>Boş saatlar</div>
              {slotsLoading ? (
                <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Boş saatlar yüklənir…</div>
              ) : slots.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
                  {groupedSlots.map(([day, daySlots]) => (
                    <div key={day}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {daySlots.map(s => {
                          const sel = start === isoToAzLocal(s.startAt);
                          return (
                            <button key={s.startAt} type="button"
                              onClick={() => { setManualOpen(false); setStart(isoToAzLocal(s.startAt)); setEnd(isoToAzLocal(s.endAt)); }}
                              style={{ border: `1.5px solid ${sel ? "var(--brand)" : "#D6E2F7"}`, background: sel ? "var(--brand)" : "#fff", color: sel ? "#fff" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                              {azFormatTime(s.startAt)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button type="button" onClick={() => setManualOpen(o => !o)}
            style={{ marginTop: 10, background: "none", border: "none", color: "var(--brand-700)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            {manualOpen ? "Əl ilə daxiletməni gizlət" : "Və ya əl ilə daxil et"}
          </button>
          {manualOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <label style={{ display: "block" }}>
                <span style={fieldLab}>Başlama vaxtı</span>
                <DatePicker withTime theme="light" size="sm" value={start} onChange={v => { setStart(v); if (!end) setEnd(addMinutesLocal(v, 50)); }} style={{ width: "100%" }} />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLab}>Bitmə vaxtı</span>
                <DatePicker withTime theme="light" size="sm" value={end} onChange={setEnd} style={{ width: "100%" }} />
              </label>
            </div>
          )}

          {start && end && (
            <div style={{ fontSize: 12.5, color: "#065F46", fontWeight: 600, marginTop: 12, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 9, padding: "9px 12px" }}>
              Seçilmiş vaxt: {azFormatDate(azLocalToISO(start))} · {azFormatTime(azLocalToISO(start))} – {azFormatTime(azLocalToISO(end))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.45 }}>
            <Svg w={14} stroke="var(--brand)" style={{ flex: "none", marginTop: 1 }} d={<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />} />
            Paket balansından 1 seans sərf olunacaq və seans təsdiqlənmiş (CONFIRMED) yaranacaq.
          </div>

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid #F0F4FA" }}>
          <button onClick={onClose} style={{ flex: "none", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Planlanır…" : "Seansı planla"}
          </button>
        </div>
      </div>
    </div>
  );
}
