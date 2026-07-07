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
  ACTIVE:    { label: "Aktiv",       bg: "var(--status-paid-bg)",      color: "var(--status-paid-fg)" },
  EXHAUSTED: { label: "Tamamlanıb",  bg: "var(--status-cancelled-bg)", color: "var(--status-cancelled-fg)" },
  EXPIRED:   { label: "Vaxtı keçib", bg: "var(--status-pending-bg)",   color: "var(--status-pending-fg)" },
  CANCELLED: { label: "Ləğv",        bg: "var(--status-refunded-bg)",  color: "var(--status-refunded-fg)" },
};

function Svg({ d, w = 16, sw = 2, stroke = "currentColor", style }: { d: ReactNode; w?: number; sw?: number; stroke?: string; style?: React.CSSProperties }) {
  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>{d}</svg>;
}

function fmtDateTime(iso?: string | null) {
  return iso ? azFormatDateTime(iso) : "—";
}

// Appointment status → Fanus UI Kit pill variant (rənglər statusMeta() ilə eynidir).
function statusPillClass(status?: string | null): string {
  switch (status) {
    case "CONFIRMED": return "fx-pill--paid";
    case "ASSIGNED": return "fx-pill--info";
    case "DISPUTED":
    case "CANCELLED": return "fx-pill--refunded";
    case "COMPLETED": return "fx-pill--cancelled";
    default: return "fx-pill--pending"; // PENDING/NEW/REJECTED/IN_REVIEW/AWAITING_CONFIRMATION/CANCEL_REQUESTED
  }
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
    return (
      <div>
        <div className="fx-skeleton" style={{ width: 110, height: 14, borderRadius: 6, marginBottom: 16 }} />
        <div className="fx-card fx-card--lg" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="fx-skeleton" style={{ width: 46, height: 46, borderRadius: 12, flex: "none" }} />
            <div style={{ flex: 1 }}>
              <div className="fx-skeleton" style={{ width: "45%", height: 16, borderRadius: 6, marginBottom: 8 }} />
              <div className="fx-skeleton" style={{ width: "30%", height: 12, borderRadius: 6 }} />
            </div>
            <div className="fx-skeleton" style={{ width: 60, height: 22, borderRadius: 6, flex: "none" }} />
          </div>
          <div className="fx-skeleton" style={{ height: 6, borderRadius: 999, marginTop: 14 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="fx-skeleton" style={{ height: 118, borderRadius: 12 }} />)}
        </div>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div style={{ padding: "40px 0" }}>
        <div className="fx-card--empty" style={{ maxWidth: 420, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>Paket tapılmadı</div>
          <button onClick={backToList} className="fx-btn fx-btn--ghost fx-btn--sm">Randevulara qayıt</button>
        </div>
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
      <button onClick={backToList} className="fx-btn fx-btn--quiet fx-btn--sm" style={{ padding: 0, marginBottom: 16 }}>
        <Svg w={15} d={<path d="M15 18l-6-6 6-6" />} /> Randevular
      </button>

      {/* Paket başlığı */}
      <div className="fx-card fx-card--lg" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--lilac-bg)", color: "var(--lilac)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Svg w={22} d={<><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>} />
          </span>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
              <span className="fx-h3">{first.packageName ?? "Paket"}</span>
              <span className="fx-pill" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
              {first.patientName ?? "—"}{first.psychologistName ? ` · ${first.psychologistName}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div className="fx-num" style={{ fontSize: 22, fontWeight: 800, color: "var(--lilac)", lineHeight: 1 }}>{scheduledCount}/{total}</div>
            <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 3 }}>{scheduledCount} təyin · {emptyCount} boş</div>
          </div>
        </div>
        <div className="fx-progress" style={{ marginTop: 14 }}>
          <div className="fx-progress__fill" style={{ width: `${pct}%`, background: "var(--lilac)" }} />
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
      <div className="fx-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
        style={{ padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 7, minHeight: 118 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="fx-num" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
          <span className={`fx-pill ${statusPillClass(a.status)}`}>{meta.label}</span>
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
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 118, background: "var(--status-pending-bg)", border: "1.5px solid var(--amber)", borderRadius: 12, color: "var(--status-pending-fg)", cursor: "pointer", padding: 13, fontFamily: "inherit" }}>
        <Svg w={22} sw={2.2} d={<path d="M12 5v14M5 12h14" />} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>Təyin et</span>
        <span className="fx-num" style={{ fontSize: 11, color: "var(--status-pending-fg)", fontWeight: 600 }}>#FNS-{String(a.id).padStart(4, "0")}</span>
      </div>
    );
  }

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ background: "var(--amber-bg)", border: "1.5px solid var(--amber)", borderRadius: 12, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, minHeight: 118 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="fx-num" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--status-pending-fg)" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
        <span className="fx-pill" style={{ background: "var(--amber)", color: "var(--surface)" }}>Təyin edilməyib</span>
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {a.requestedStartAt && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
            <Svg w={13} stroke="var(--amber)" d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
            {fmtDateTime(a.requestedStartAt)}
          </div>
        )}
        {a.requestedPsychologistName && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
            <Svg w={13} stroke="var(--amber)" d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
            {a.requestedPsychologistName}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>Pasiyentin seçimi</div>
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--amber)" }}>
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
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 118, background: "var(--brand-50)", border: "1.5px dashed var(--brand-200)", borderRadius: 12, color: "var(--oxford-60)", cursor: "pointer", padding: 13, fontFamily: "inherit" }}>
      <Svg w={22} sw={2.2} d={<path d="M12 5v14M5 12h14" />} />
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>Yeni seans</span>
      <span style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>balansdan</span>
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
    <div onClick={onClose} className="fx-overlay fx-overlay--center" style={{ padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--hairline)" }}>
          <h3 className="fx-h3">Paket seansı əlavə et</h3>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>
            {first.packageName} · {first.packageRemaining ?? 0} seans qalıb{first.psychologistName ? ` · ${first.psychologistName}` : ""}
          </div>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto" }}>
          {/* Psixoloq seçimi — paketin psixoloqu varsa default, yoxdursa operator seçir. */}
          <div style={{ marginBottom: 16 }}>
            <span className="fx-label" style={{ display: "block", marginBottom: 7 }}>
              Psixoloq{pkgPsyId == null && <span style={{ color: "var(--amber)" }}> · pasiyent seçməyib</span>}
            </span>
            <select value={psyId ?? ""} onChange={e => selectPsy(e.target.value ? Number(e.target.value) : null)}
              className="fx-select" style={{ fontWeight: 600, cursor: "pointer" }}>
              <option value="">Psixoloq seçin…</option>
              {psychologists.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {psyId == null ? (
            <div style={{ fontSize: 12.5, color: "var(--status-pending-fg)", background: "var(--amber-bg)", border: "1px solid rgba(201,125,46,.3)", borderRadius: 10, padding: "10px 12px" }}>
              Boş saatları görmək üçün əvvəlcə psixoloq seçin.
            </div>
          ) : (
            <>
              <div className="fx-label" style={{ marginBottom: 10 }}>Boş saatlar</div>
              {slotsLoading ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[64, 56, 60, 52, 58].map((w, i) => <div key={i} className="fx-skeleton" style={{ width: w, height: 32, borderRadius: 9 }} />)}
                </div>
              ) : slots.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--status-pending-fg)", background: "var(--amber-bg)", border: "1px solid rgba(201,125,46,.3)", borderRadius: 10, padding: "10px 12px" }}>Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.</div>
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
                              style={{ border: `1.5px solid ${sel ? "var(--brand)" : "var(--brand-200)"}`, background: sel ? "var(--brand)" : "var(--surface)", color: sel ? "var(--surface)" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
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
            <div style={{ fontSize: 12.5, color: "var(--status-paid-fg)", fontWeight: 600, marginTop: 12, background: "var(--sage-bg)", border: "1px solid rgba(74,155,127,.35)", borderRadius: 9, padding: "9px 12px" }}>
              Seçilmiş vaxt: {azFormatDate(azLocalToISO(start))} · {azFormatTime(azLocalToISO(start))} – {azFormatTime(azLocalToISO(end))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--brand-50)", border: "1px solid var(--brand-200)", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.45 }}>
            <Svg w={14} stroke="var(--brand)" style={{ flex: "none", marginTop: 1 }} d={<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />} />
            Paket balansından 1 seans sərf olunacaq və seans təsdiqlənmiş (CONFIRMED) yaranacaq.
          </div>

          {err && <div style={{ background: "var(--rose-bg)", border: "1px solid rgba(201,125,125,.35)", color: "var(--status-refunded-fg)", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid var(--hairline)" }}>
          <button onClick={onClose} className="fx-btn fx-btn--ghost" style={{ flex: "none" }}>Ləğv</button>
          <button onClick={submit} disabled={saving} className="fx-btn fx-btn--primary" style={{ flex: 1, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Planlanır…" : "Seansı planla"}
          </button>
        </div>
      </div>
    </div>
  );
}
