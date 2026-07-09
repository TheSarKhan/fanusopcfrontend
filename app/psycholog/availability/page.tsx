"use client";

import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type AppointmentDetail, type TimeSlot, type TimeSlotOverride, type Vacation } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import RescheduleComposeModal from "@/components/RescheduleComposeModal";
import { useT } from "@/lib/i18n/LocaleProvider";

const WEEKDAYS_AZ = [
  { iso: 1, label: "Bazar ertəsi", short: "B.e" },
  { iso: 2, label: "Çərşənbə axşamı", short: "Ç.a" },
  { iso: 3, label: "Çərşənbə", short: "Ç" },
  { iso: 4, label: "Cümə axşamı", short: "C.a" },
  { iso: 5, label: "Cümə", short: "C" },
  { iso: 6, label: "Şənbə", short: "Ş" },
  { iso: 7, label: "Bazar", short: "B" },
];

function trimSeconds(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function fmtHours(min: number): string {
  if (min <= 0) return "0 saat";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} dəq`;
  if (m === 0) return `${h} saat`;
  return `${h} saat ${m} dəq`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const months = ["Yan","Fev","Mart","Apr","May","İyun","İyul","Avq","Sen","Okt","Noy","Dek"];
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PsychologistAvailabilityPage() {
  const { t } = useT();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [overrides, setOverrides] = useState<TimeSlotOverride[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);

  // Session minutes
  const [sessionMinutes, setSessionMinutes] = useState<number>(50);
  const [savedMinutes, setSavedMinutes] = useState<number>(50);
  const [savingMinutes, setSavingMinutes] = useState(false);

  // Add slot modal
  const [slotModal, setSlotModal] = useState<{ day: number | null } | null>(null);

  // Add override modal
  const [overrideModal, setOverrideModal] = useState(false);

  // Add vacation modal
  const [vacationModal, setVacationModal] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.listSlots().catch(() => []),
      psychologistApi.listOverrides().catch(() => []),
      psychologistApi.me().catch(() => null),
      psychologistApi.listVacations().catch(() => [] as Vacation[]),
    ]).then(([s, o, me, v]) => {
      setSlots(s); setOverrides(o); setVacations(v);
      const m = me?.defaultSessionMinutes && me.defaultSessionMinutes > 0 ? me.defaultSessionMinutes : 50;
      setSessionMinutes(m); setSavedMinutes(m);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map: Record<number, TimeSlot[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    for (const s of slots) {
      if (map[s.dayOfWeek]) map[s.dayOfWeek].push(s);
    }
    Object.values(map).forEach(list => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [slots]);

  const stats = useMemo(() => {
    const activeDays = WEEKDAYS_AZ.filter(d => slotsByDay[d.iso].some(s => s.active)).length;
    const totalMinutes = slots
      .filter(s => s.active)
      .reduce((sum, s) => sum + diffMinutes(trimSeconds(s.startTime), trimSeconds(s.endTime)), 0);
    const activeVacations = vacations.filter(v => v.endDate >= todayIso()).length;
    return { activeDays, totalMinutes, activeVacations };
  }, [slots, slotsByDay, vacations]);

  const saveSessionMinutes = async () => {
    setError(null);
    if (sessionMinutes < 15 || sessionMinutes > 240) {
      setError("Sessiya müddəti 15–240 dəqiqə aralığında olmalıdır");
      return;
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

  const onSlotCreated = (created: TimeSlot[]) => {
    setSlots(prev => [...prev, ...created].sort((a, b) =>
      a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    setSlotModal(null);
  };

  const deleteSlot = async (id: number) => {
    if (!confirm("Bu vaxt aralığını silmək istəyirsiniz?")) return;
    try {
      await psychologistApi.deleteSlot(id);
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  const toggleSlot = async (s: TimeSlot) => {
    try {
      const updated = await psychologistApi.updateSlot(s.id, {
        dayOfWeek: s.dayOfWeek,
        startTime: trimSeconds(s.startTime),
        endTime: trimSeconds(s.endTime),
        active: !s.active,
      });
      setSlots(prev => prev.map(x => x.id === s.id ? updated : x));
    } catch (e) { alert((e as Error).message); }
  };

  const onOverrideCreated = (created: TimeSlotOverride) => {
    setOverrides(prev => [created, ...prev]);
    setOverrideModal(false);
  };

  const deleteOverride = async (id: number) => {
    if (!confirm("Bu istisnanı silmək istəyirsiniz?")) return;
    try {
      await psychologistApi.deleteOverride(id);
      setOverrides(prev => prev.filter(o => o.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  const onVacationCreated = (created: Vacation) => {
    setVacations(prev => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    setVacationModal(false);
  };

  const cancelVacation = async (id: number) => {
    if (!confirm("Məzuniyyəti ləğv edirsiniz?")) return;
    try {
      await psychologistApi.cancelVacation(id);
      setVacations(prev => prev.filter(v => v.id !== id));
    } catch (e) { alert((e as Error).message); }
  };

  /* ─── Render ───────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ background: "#fff", padding: 60, borderRadius: 14, textAlign: "center", color: "var(--oxford-60)" }}>
        Yüklənir…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)", margin: "0 0 6px" }}>
          {t("staff.psyAvailTitle")}
        </h1>
        <p style={{ fontSize: 15, color: "var(--oxford-60)", fontWeight: 500, margin: 0 }}>
          Həftəlik iş vaxtları, tarix istisnaları və məzuniyyət — bir səhifədə.
        </p>
      </div>

      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
          padding: "10px 14px", borderRadius: 10, fontSize: 13,
        }}>{error}</div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 13 }}>
        <StatCell label="Aktiv günlər"      value={`${stats.activeDays}/7`}              tone="brand" />
        <StatCell label="Həftəlik iş saatı" value={fmtHours(stats.totalMinutes)}         tone="good"  />
        <StatCell label="Seans müddəti"     value={`${savedMinutes} dəq`}                tone="muted" />
        <StatCell label="Aktiv məzuniyyət"  value={stats.activeVacations}                tone={stats.activeVacations > 0 ? "warn" : "muted"} />
      </div>

      {/* Session minutes card */}
      <SessionMinutesCard
        sessionMinutes={sessionMinutes}
        savedMinutes={savedMinutes}
        savingMinutes={savingMinutes}
        setSessionMinutes={setSessionMinutes}
        save={saveSessionMinutes}
      />

      {/* Weekly schedule */}
      <section style={cardStyle}>
        <div style={cardHeadStyle}>
          <div>
            <h2 style={cardTitleStyle}>Həftəlik cədvəl</h2>
            <p style={cardSubStyle}>
              Hər gün üçün açıq vaxt aralıqlarını qurun. Müştərilər bu pəncərələrdə {savedMinutes} dəqiqəlik slotlara rezerv edə biləcəklər.
            </p>
          </div>
          <button onClick={() => setSlotModal({ day: null })} style={primaryBtn}>
            <IconPlus /> Vaxt əlavə et
          </button>
        </div>

        <div className="psy-week-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 11,
        }}>
          {WEEKDAYS_AZ.map(d => (
            <DayColumn key={d.iso}
              day={d}
              slots={slotsByDay[d.iso] ?? []}
              onAdd={() => setSlotModal({ day: d.iso })}
              onDelete={deleteSlot}
              onToggle={toggleSlot}
            />
          ))}
        </div>
      </section>

      {/* Overrides + Vacation side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="psy-avail-bottom">
        <OverridesCard
          overrides={overrides}
          onAdd={() => setOverrideModal(true)}
          onDelete={deleteOverride}
        />
        <VacationsCard
          vacations={vacations}
          onAdd={() => setVacationModal(true)}
          onCancel={cancelVacation}
        />
      </div>

      {slotModal && (
        <AddSlotModal
          initialDay={slotModal.day}
          existingSlots={slots}
          onClose={() => setSlotModal(null)}
          onCreated={onSlotCreated}
        />
      )}

      {overrideModal && (
        <AddOverrideModal
          onClose={() => setOverrideModal(false)}
          onCreated={onOverrideCreated}
        />
      )}

      {vacationModal && (
        <AddVacationModal
          onClose={() => setVacationModal(false)}
          onCreated={onVacationCreated}
        />
      )}

      <style>{`
        @media (max-width: 860px) {
          .psy-week-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .psy-avail-bottom { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ─── Session minutes card ────────────────────────────────────────────────── */

function SessionMinutesCard({ sessionMinutes, savedMinutes, savingMinutes, setSessionMinutes, save }: {
  sessionMinutes: number; savedMinutes: number; savingMinutes: boolean;
  setSessionMinutes: (m: number) => void; save: () => void;
}) {
  const dirty = sessionMinutes !== savedMinutes;
  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <h2 style={cardTitleStyle}>Bir seansın müddəti</h2>
          <p style={{ ...cardSubStyle, maxWidth: 430 }}>
            Açıq aralıqlar bu müddətə görə slotlara bölünür. Məsələn 09:00–12:00 + 50 dəq → 09:00, 09:50, 10:40 slotları.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 7 }}>
            {[30, 45, 50, 60, 90].map(m => {
              const on = sessionMinutes === m;
              return (
                <button key={m} type="button" onClick={() => setSessionMinutes(m)}
                  style={{
                    padding: "9px 13px", fontSize: 14, fontWeight: 700, borderRadius: 10,
                    border: `1.5px solid ${on ? "var(--brand)" : "#D6E2F7"}`,
                    background: on ? "var(--brand-50)" : "#fff",
                    color: on ? "var(--brand-700)" : "var(--oxford)",
                    boxShadow: on ? "0 0 0 3px rgba(16,81,183,.14)" : "none",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{m}</button>
              );
            })}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            border: "1px solid #D6E2F7", borderRadius: 10, padding: "6px 10px",
          }}>
            <input type="number" min={15} max={240} step={5} value={sessionMinutes}
              onChange={e => setSessionMinutes(Number(e.target.value) || 0)}
              style={{ width: 46, padding: 0, border: "none", outline: "none", fontSize: 14, fontWeight: 700, textAlign: "right", color: "var(--oxford)", fontFamily: "inherit" }} />
            <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>dəq</span>
          </div>
          <button onClick={save} disabled={savingMinutes || !dirty}
            style={{
              padding: "10px 16px", borderRadius: 10,
              border: dirty ? "none" : "1px solid #E5E7EB",
              background: dirty ? "var(--brand)" : "#F3F4F6",
              color: dirty ? "#fff" : "#9CA3AF",
              fontSize: 14, fontWeight: 600,
              cursor: savingMinutes || !dirty ? "default" : "pointer",
              fontFamily: "inherit",
            }}>
            {savingMinutes ? "Saxlanılır…" : dirty ? "Saxla" : "Saxlanılıb"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Day column ──────────────────────────────────────────────────────────── */

function DayColumn({ day, slots, onAdd, onDelete, onToggle }: {
  day: { iso: number; label: string; short: string };
  slots: TimeSlot[];
  onAdd: () => void;
  onDelete: (id: number) => void;
  onToggle: (s: TimeSlot) => void;
}) {
  const minutes = slots
    .filter(s => s.active)
    .reduce((sum, s) => sum + diffMinutes(trimSeconds(s.startTime), trimSeconds(s.endTime)), 0);
  const isWeekend = day.iso === 6 || day.iso === 7;
  const empty = slots.length === 0;

  return (
    <div style={{
      background: empty ? "#F7FAFE" : "#fff",
      border: `1px solid ${empty ? "#E8EFF9" : "#EDF1F8"}`,
      borderRadius: 12, padding: 12,
      display: "flex", flexDirection: "column",
      minHeight: 150,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 11 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: isWeekend ? "#A9B8CC" : "var(--oxford)" }}>{day.short}</span>
        {/* Show the count only when 2+ slots — a single pill below already conveys "1". */}
        {slots.length >= 2 && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
            background: "var(--brand-100)", color: "var(--brand-700)",
            fontSize: 10.5, fontWeight: 700,
          }}>{slots.length}</span>
        )}
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 600, color: minutes > 0 ? "var(--oxford-60)" : "#A9B8CC", marginBottom: 10 }}>
        {minutes > 0 ? fmtHours(minutes) : "Boş"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        {empty ? (
          <div style={{ fontSize: 11, color: "#A9B8CC", fontWeight: 500, textAlign: "center", padding: "14px 0" }}>
            Vaxt aralığı yoxdur
          </div>
        ) : (
          slots.map(s => (
            <SlotPill key={s.id} slot={s} onDelete={() => onDelete(s.id)} onToggle={() => onToggle(s)} />
          ))
        )}
      </div>

      <button onClick={onAdd}
        style={{
          marginTop: 9, padding: 7, borderRadius: 8,
          border: "1.5px dashed #C7D3E6", background: "none",
          color: "var(--oxford-60)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          width: "100%", fontFamily: "inherit",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.color = "var(--brand)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#C7D3E6"; e.currentTarget.style.color = "var(--oxford-60)"; }}>
        <IconPlus /> Vaxt
      </button>
    </div>
  );
}

function SlotPill({ slot, onDelete, onToggle }: { slot: TimeSlot; onDelete: () => void; onToggle: () => void }) {
  const start = trimSeconds(slot.startTime);
  const end = trimSeconds(slot.endTime);
  const minutes = diffMinutes(start, end);
  const active = slot.active;
  return (
    <div style={{
      padding: "8px 9px", borderRadius: 9,
      background: active ? "var(--brand-50)" : "#F3F4F6",
      border: `1px solid ${active ? "#D9E6FA" : "#E5E7EB"}`,
      opacity: active ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? "var(--brand-700)" : "#9CA3AF" }}>{start}–{end}</span>
        <div style={{ display: "flex", gap: 3, flex: "none" }}>
          <button onClick={onToggle} title={active ? "Deaktiv et" : "Aktivləşdir"}
            style={pillBtn(active ? "var(--brand)" : "#9CA3AF")}>
            {active ? <IconEye /> : <IconEyeOff />}
          </button>
          <button onClick={onDelete} title="Sil"
            style={pillBtn("#C08A8A")}>
            <IconTrash />
          </button>
        </div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? "var(--brand)" : "#9CA3AF" }}>{fmtHours(minutes)}</span>
    </div>
  );
}

/* ─── Overrides card ──────────────────────────────────────────────────────── */

function OverridesCard({ overrides, onAdd, onDelete }: {
  overrides: TimeSlotOverride[];
  onAdd: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={cardHeadStyle}>
        <div>
          <h2 style={cardTitleStyle}>Tarix istisnaları</h2>
          <p style={cardSubStyle}>Konkret gün üçün cədvəli ləğv edin və ya əlavə açıq vaxt əlavə edin.</p>
        </div>
        <button onClick={onAdd} style={ghostBtn}>
          <IconPlus /> Əlavə et
        </button>
      </div>

      {overrides.length === 0 ? (
        <EmptyState
          icon={<IconCalendarOff />}
          title="İstisna yoxdur"
          body="Bayram günü, dəyişdirilmiş cədvəl və ya birdəfəlik əlavə saat üçün istisna əlavə edə bilərsiniz."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {overrides.map(o => {
            const block = o.overrideType === "BLOCK";
            return (
              <div key={o.id} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: 13, borderRadius: 11,
                background: block ? "#FEF2F2" : "#ECFDF5",
                border: `1px solid ${block ? "#FECACA" : "#A7F3D0"}`,
                borderLeft: `3px solid ${block ? "#991B1B" : "#065F46"}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "inline-block", padding: "3px 8px", borderRadius: 999,
                    fontSize: 10, fontWeight: 800, letterSpacing: ".06em", marginBottom: 7,
                    background: block ? "#FEE2E2" : "#D1FAE5",
                    color: block ? "#991B1B" : "#065F46",
                  }}>
                    {block ? "BAĞLI" : "ƏLAVƏ VAXT"}
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>
                    {fmtDate(o.overrideDate)}
                    {o.startTime && o.endTime && (
                      <span style={{ fontWeight: 600, color: "var(--oxford-60)" }}>
                        {` · ${trimSeconds(o.startTime)}–${trimSeconds(o.endTime)}`}
                      </span>
                    )}
                  </div>
                  {o.note && (
                    <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 2 }}>{o.note}</div>
                  )}
                </div>
                <button onClick={() => onDelete(o.id)} style={smallDangerBtn}>Sil</button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─── Vacations card ──────────────────────────────────────────────────────── */

function VacationsCard({ vacations, onAdd, onCancel }: {
  vacations: Vacation[];
  onAdd: () => void;
  onCancel: (id: number) => void;
}) {
  const today = todayIso();
  return (
    <section style={cardStyle}>
      <div style={cardHeadStyle}>
        <div>
          <h2 style={cardTitleStyle}>Məzuniyyət</h2>
          <p style={cardSubStyle}>
            Bu dövrdə yeni rezervasiyalar bağlanır və mövcud randevular operator komandasına ötürülür.
          </p>
        </div>
        <button onClick={onAdd} style={ghostBtn}>
          <IconPlus /> Əlavə et
        </button>
      </div>

      {vacations.length === 0 ? (
        <EmptyState
          icon={<IconPalm />}
          title="Aktiv məzuniyyət yoxdur"
          body="İstirahət, konfrans və ya sağlamlıq səbəbi ilə bu modulu istifadə edə bilərsiniz."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {vacations.map(v => {
            const isUpcoming = v.startDate > today;
            const isOngoing = v.startDate <= today && v.endDate >= today;
            const tone = isOngoing ? "ongoing" : isUpcoming ? "upcoming" : "past";
            const tints: Record<string, { bg: string; border: string; tileBg: string; tileFg: string }> = {
              ongoing:  { bg: "#F2F6FD", border: "#D9E6FA", tileBg: "var(--brand-100)", tileFg: "var(--brand)" },
              upcoming: { bg: "#FFFBEB", border: "#FDE68A", tileBg: "#FEF3C7",          tileFg: "#92400E" },
              past:     { bg: "#F7FAFE", border: "#E8EFF9", tileBg: "#F3F4F6",          tileFg: "#9CA3AF" },
            };
            const ts = tints[tone];
            return (
              <div key={v.id} style={{
                background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 11, padding: 14,
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 11, flex: "none",
                  background: ts.tileBg, color: ts.tileFg,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconPalm />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    {isOngoing && <Pill bg="var(--brand-100)" fg="var(--brand-700)">Davam edir</Pill>}
                    {isUpcoming && <Pill bg="#FEF3C7" fg="#92400E">Yaxınlaşan</Pill>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>
                      {fmtDate(v.startDate)} → {fmtDate(v.endDate)}
                    </span>
                  </div>
                  {v.reason && (
                    <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{v.reason}</div>
                  )}
                  <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                    {v.affectedAppointments > 0 ? (
                      <Pill bg="#FEE2E2" fg="#991B1B">
                        {v.affectedAppointments} randevu təsirlənib
                      </Pill>
                    ) : (
                      <Pill bg="#D1FAE5" fg="#065F46">münaqişə yoxdur</Pill>
                    )}
                    {v.notifyPatients && (
                      <Pill bg="var(--brand-100)" fg="var(--brand-700)">pasiyentlərə bildiriş</Pill>
                    )}
                  </div>
                </div>
                <button onClick={() => onCancel(v.id)} style={smallDangerBtn}>Ləğv et</button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─── Add slot modal ──────────────────────────────────────────────────────── */

function AddSlotModal({ initialDay, existingSlots, onClose, onCreated }: {
  initialDay: number | null;
  existingSlots: TimeSlot[];
  onClose: () => void;
  onCreated: (created: TimeSlot[]) => void;
}) {
  const [days, setDays] = useState<number[]>(initialDay != null ? [initialDay] : [1]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (iso: number) => {
    setDays(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort());
  };
  const selectWeekdays = () => setDays([1, 2, 3, 4, 5]);
  const selectAll = () => setDays([1, 2, 3, 4, 5, 6, 7]);
  const clearDays = () => setDays([]);

  const submit = async () => {
    if (days.length === 0) { setErr("Ən azı bir gün seçin"); return; }
    if (start >= end) { setErr("Başlama vaxtı bitişdən əvvəl olmalıdır"); return; }

    const conflictDay = days.find(day =>
      existingSlots.some(s =>
        s.dayOfWeek === day && rangesOverlap(start, end, trimSeconds(s.startTime), trimSeconds(s.endTime))
      )
    );
    if (conflictDay != null) {
      const dayLabel = WEEKDAYS_AZ.find(d => d.iso === conflictDay)?.label ?? "";
      setErr(`${dayLabel} günü üçün bu vaxt aralığı artıq mövcud olan bir vaxt aralığı ilə üst-üstə düşür`);
      return;
    }

    setSaving(true); setErr(null);
    try {
      const created: TimeSlot[] = [];
      for (const day of days) {
        const slot = await psychologistApi.createSlot({
          dayOfWeek: day, startTime: start, endTime: end, active: true,
        });
        created.push(slot);
      }
      onCreated(created);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} title="Vaxt aralığı əlavə et"
      subtitle="Bir və ya bir neçə günə eyni vaxt aralığını tətbiq edin">
      <Section label="Günlər" right={
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={selectWeekdays} style={miniBtn}>İş günləri</button>
          <button onClick={selectAll} style={miniBtn}>Hamısı</button>
          <button onClick={clearDays} style={miniBtn}>Təmizlə</button>
        </div>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {WEEKDAYS_AZ.map(d => {
            const active = days.includes(d.iso);
            return (
              <button key={d.iso} onClick={() => toggleDay(d.iso)}
                style={{
                  padding: "10px 4px", borderRadius: 9,
                  border: active ? "1.5px solid var(--brand)" : "1px solid #D6E2F7",
                  background: active ? "var(--brand-50)" : "#fff",
                  color: active ? "var(--brand-700)" : "var(--oxford-60)",
                  boxShadow: active ? "0 0 0 3px rgba(16,81,183,.14)" : "none",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                }}>
                <span>{d.short}</span>
                {active && <IconCheck color="var(--brand)" size={9} />}
              </button>
            );
          })}
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section label="Başlama">
          <TimePicker value={start} onChange={setStart} theme="light" size="sm" />
        </Section>
        <Section label="Bitiş">
          <TimePicker value={end} onChange={setEnd} theme="light" size="sm" />
        </Section>
      </div>

      {start < end && (
        <div style={{
          padding: "8px 12px", borderRadius: 8,
          background: "var(--brand-50)", border: "1px solid var(--brand-100)",
          fontSize: 11.5, color: "var(--brand-700)",
        }}>
          Müddət: <b>{fmtHours(diffMinutes(start, end))}</b>
          {days.length > 1 && <> · Cəmi: <b>{fmtHours(diffMinutes(start, end) * days.length)}</b> ({days.length} gün)</>}
        </div>
      )}

      {err && <ErrorBox message={err} />}

      <ModalActions onCancel={onClose} onSubmit={submit} submitDisabled={saving || days.length === 0}
        submitLabel={saving ? "Saxlanılır…" : "Saxla"} />
    </Modal>
  );
}

/* ─── Add override modal ──────────────────────────────────────────────────── */

function AddOverrideModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (created: TimeSlotOverride) => void;
}) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<"BLOCK" | "EXTRA">("BLOCK");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!date) { setErr("Tarix seçin"); return; }
    if (type === "EXTRA" && (!start || !end)) {
      setErr("Əlavə vaxt üçün başlama və bitiş tələb olunur"); return;
    }
    if (start && end && start >= end) { setErr("Bitiş başlamadan sonra olmalıdır"); return; }
    setSaving(true); setErr(null);
    try {
      const data: { overrideDate: string; overrideType: "BLOCK" | "EXTRA"; startTime?: string; endTime?: string; note?: string } = {
        overrideDate: date, overrideType: type, note: note || undefined,
      };
      if (start) data.startTime = start;
      if (end) data.endTime = end;
      const created = await psychologistApi.createOverride(data);
      onCreated(created);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} title="Tarix istisnası" subtitle="Birdəfəlik dəyişiklik üçün konkret günü qurun">
      <Section label="Tarix">
        <DatePicker value={date} min={todayIso()} onChange={setDate} theme="light" size="sm" style={{ width: "100%" }} />
      </Section>

      <Section label="Tip">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <TypeCard active={type === "BLOCK"} onClick={() => setType("BLOCK")}
            color="#DC2626" title="Bağlı"
            hint="Bütün gün və ya seçilmiş saatlar rezervasiyaya bağlanır" />
          <TypeCard active={type === "EXTRA"} onClick={() => setType("EXTRA")}
            color="#10B981" title="Əlavə vaxt"
            hint="Normal cədvəldən kənar əlavə açıq saat" />
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section label={
          <>
            Başlama {type === "BLOCK" && <span style={{ fontWeight: 400, color: "var(--oxford-60)" }}>(boş = bütün gün)</span>}
          </>
        }>
          <TimePicker value={start} onChange={setStart} theme="light" size="sm" clearable />
        </Section>
        <Section label="Bitiş">
          <TimePicker value={end} onChange={setEnd} theme="light" size="sm" clearable />
        </Section>
      </div>

      <Section label="Qeyd (məcburi deyil)">
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Məs. konfrans iştirakı"
          style={{ ...timeInputStyle, width: "100%" }} />
      </Section>

      {err && <ErrorBox message={err} />}

      <ModalActions onCancel={onClose} onSubmit={submit} submitDisabled={saving}
        submitLabel={saving ? "Saxlanılır…" : "Saxla"} />
    </Modal>
  );
}

function TypeCard({ active, onClick, color, title, hint }: {
  active: boolean; onClick: () => void; color: string; title: string; hint: string;
}) {
  return (
    <button onClick={onClick}
      style={{
        padding: "12px 14px", borderRadius: 10,
        border: active ? `1.5px solid ${color}` : "1px solid var(--oxford-10)",
        background: active ? `${color}10` : "#fff",
        cursor: "pointer", textAlign: "left",
        transition: "all 0.12s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: active ? color : "var(--oxford)" }}>{title}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>{hint}</div>
    </button>
  );
}

/* ─── Add vacation modal ──────────────────────────────────────────────────── */

function AddVacationModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (created: Vacation) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // GAP-05: unresolved bookings in the range block activation — resolve each, then retry.
  const [conflicts, setConflicts] = useState<AppointmentDetail[] | null>(null);
  const [proposeFor, setProposeFor] = useState<AppointmentDetail | null>(null);
  const [handingOffId, setHandingOffId] = useState<number | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());

  const submit = async () => {
    if (!start || !end) { setErr("Tarixləri seçin"); return; }
    if (end < start) { setErr("Bitiş başlanğıcdan sonra olmalıdır"); return; }
    setSaving(true); setErr(null);
    try {
      const result = await psychologistApi.createVacation({
        startDate: start, endDate: end,
        reason: reason.trim() || undefined,
        notifyPatients: notify,
      });
      if (result.created && result.vacation) {
        onCreated(result.vacation);
      } else {
        setConflicts(result.conflicts);
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const handoff = async (a: AppointmentDetail) => {
    setHandingOffId(a.id); setErr(null);
    try {
      await psychologistApi.handoffToOperator(a.id, "psixoloq məzuniyyəti");
      setResolvedIds(prev => new Set(prev).add(a.id));
    } catch (e) { setErr((e as Error).message); }
    finally { setHandingOffId(null); }
  };

  // ── Conflict resolution step ──────────────────────────────────────────────
  if (conflicts !== null) {
    const open = conflicts.filter(c => !resolvedIds.has(c.id));
    return (
      <>
        <Modal onClose={onClose} title="Bu tarixlərdə randevularınız var"
          subtitle="Məzuniyyət yalnız bütün konfliktlər həll olunandan sonra aktivləşəcək">
          <div style={{ display: "grid", gap: 10 }}>
            {conflicts.map(a => {
              const resolved = resolvedIds.has(a.id);
              return (
                <div key={a.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                  padding: "10px 14px", borderRadius: 10,
                  border: resolved ? "1px solid #BBF7D0" : "1px solid #FECACA",
                  background: resolved ? "#F0FDF4" : "#FEF2F2",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>
                      {a.patientName ?? "Pasient"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--oxford-60)" }}>
                      {a.startAt ? new Date(a.startAt).toLocaleString("az-AZ") : "—"} · {a.status}
                    </div>
                  </div>
                  {resolved ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>✓ operatora ötürüldü</span>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => setProposeFor(a)}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--brand-100)", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Yeni vaxt təklif et
                      </button>
                      <button type="button" onClick={() => handoff(a)} disabled={handingOffId === a.id}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#1A2535", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {handingOffId === a.id ? "…" : "Operatora ötür"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 12 }}>
            Qeyd: «Yeni vaxt təklif et» pasiyentin qəbuluna qədər randevunu aktiv saxlayır —
            təklif qəbul olunandan sonra «Yenidən cəhd et» düyməsi ilə məzuniyyəti aktivləşdirin.
          </p>

          {err && <ErrorBox message={err} />}

          <ModalActions onCancel={onClose} onSubmit={submit} submitDisabled={saving}
            submitLabel={saving ? "Yoxlanılır…"
              : open.length > 0 ? `Yenidən cəhd et (${open.length} konflikt)` : "Yenidən cəhd et"} />
        </Modal>
        {proposeFor && (
          <RescheduleComposeModal
            appointment={proposeFor}
            onClose={() => setProposeFor(null)}
            onCreated={() => setProposeFor(null)}
          />
        )}
      </>
    );
  }

  return (
    <Modal onClose={onClose} title="Məzuniyyət əlavə et"
      subtitle="Bu dövrdə bağlı qalacaqsız — mövcud randevular operator komandasına ötürüləcək">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section label="Başlanğıc">
          <DatePicker value={start} min={todayIso()} onChange={setStart} theme="light" size="sm" style={{ width: "100%" }} />
        </Section>
        <Section label="Bitiş">
          <DatePicker value={end} min={start || todayIso()} onChange={setEnd} theme="light" size="sm" style={{ width: "100%" }} />
        </Section>
      </div>

      <Section label="Səbəb (məcburi deyil)">
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Məs. illik məzuniyyət, konfrans, sağlamlıq…" maxLength={255}
          style={{ ...timeInputStyle, width: "100%" }} />
      </Section>

      <label style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 10,
        background: "var(--brand-50)", border: "1px solid var(--brand-100)",
        cursor: "pointer",
      }}>
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>
            Təsirlənən pasiyentlərə bildiriş göndər
          </div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)" }}>
            Sənin məzuniyyət dövrünə düşən randevuları olan pasiyentlər avtomatik bildiriş alacaq.
          </div>
        </div>
      </label>

      {err && <ErrorBox message={err} />}

      <ModalActions onCancel={onClose} onSubmit={submit} submitDisabled={saving}
        submitLabel={saving ? "Əlavə olunur…" : "Əlavə et"} />
    </Modal>
  );
}

/* ─── Shared modal scaffolding ────────────────────────────────────────────── */

function Modal({ onClose, title, subtitle, children }: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(10, 22, 51, 0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "5vh 16px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%",
        boxShadow: "0 30px 80px rgba(8, 22, 49, 0.25)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "90vh",
      }}>
        <div style={{
          padding: "16px 22px",
          background: "linear-gradient(135deg, var(--brand-50) 0%, #fff 70%)",
          borderBottom: "1px solid var(--oxford-10)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: "3px 0 0" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid var(--oxford-10)", background: "#fff",
              color: "var(--oxford-60)", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} title="Bağla (Esc)">×</button>
        </div>
        <div style={{ overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Section({ label, right, children }: {
  label: React.ReactNode; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onSubmit, submitDisabled, submitLabel }: {
  onCancel: () => void; onSubmit: () => void; submitDisabled: boolean; submitLabel: string;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "flex-end", gap: 8,
      marginTop: 4, paddingTop: 14, borderTop: "1px solid var(--oxford-10)",
    }}>
      <button onClick={onCancel}
        style={{
          padding: "9px 16px", borderRadius: 8, border: "1px solid var(--oxford-10)",
          background: "#fff", color: "var(--oxford)", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>Ləğv</button>
      <button onClick={onSubmit} disabled={submitDisabled}
        style={{
          padding: "9px 22px", borderRadius: 8, border: "none",
          background: submitDisabled ? "var(--oxford-10)" : "var(--brand)",
          color: submitDisabled ? "var(--oxford-60)" : "#fff",
          fontSize: 13, fontWeight: 700,
          cursor: submitDisabled ? "not-allowed" : "pointer",
        }}>{submitLabel}</button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      padding: "9px 12px", borderRadius: 8,
      background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
      fontSize: 12.5,
    }}>{message}</div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{
      padding: "28px 20px", borderRadius: 12,
      border: "1px dashed var(--oxford-10)", background: "var(--brand-50)",
      textAlign: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "#fff", color: "var(--brand-700)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 10, border: "1px solid var(--brand-100)",
      }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)", marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--oxford-60)", maxWidth: 360, margin: "0 auto" }}>{body}</div>
    </div>
  );
}

function StatCell({ label, value, tone }: {
  label: string;
  value: number | string;
  tone: "brand" | "good" | "warn" | "muted";
}) {
  const palette: Record<typeof tone, { accent: string; bg: string; border: string; label: string; num: string }> = {
    brand: { accent: "var(--brand)", bg: "#fff",     border: "#EDF1F8", label: "var(--oxford-60)", num: "var(--oxford)" },
    good:  { accent: "#065F46",      bg: "#fff",     border: "#EDF1F8", label: "var(--oxford-60)", num: "var(--oxford)" },
    warn:  { accent: "#B45309",      bg: "#FFFBEB",  border: "#FDE68A", label: "#92400E",          num: "#92400E" },
    muted: { accent: "#9CA3AF",      bg: "#fff",     border: "#EDF1F8", label: "var(--oxford-60)", num: "var(--oxford)" },
  };
  const p = palette[tone];
  return (
    <div style={{
      background: p.bg, borderRadius: 14, padding: "15px 17px",
      boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      border: `1px solid ${p.border}`,
      borderLeft: `3px solid ${p.accent}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: p.label, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: p.num }}>{value}</div>
    </div>
  );
}

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      background: bg, color: fg,
      fontSize: 10.5, fontWeight: 700,
    }}>{children}</span>
  );
}

/* ─── Styles + icons ──────────────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 20,
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  border: "1px solid #EDF1F8",
};
const cardHeadStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  gap: 12, marginBottom: 15, flexWrap: "wrap",
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15.5, fontWeight: 700, color: "var(--oxford)", margin: 0,
};
const cardSubStyle: React.CSSProperties = {
  fontSize: 13, color: "var(--oxford-60)", marginTop: 4, marginBottom: 0, lineHeight: 1.5, fontWeight: 500,
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "11px 16px", borderRadius: 10,
  border: "none", background: "var(--brand)", color: "#fff",
  fontSize: 14, fontWeight: 600, cursor: "pointer",
  boxShadow: "0 4px 12px rgba(16,81,183,.24)",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 13px", borderRadius: 9,
  border: "1px solid #D6E2F7", background: "#fff",
  color: "#082F6D", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

const miniBtn: React.CSSProperties = {
  padding: "3px 8px", borderRadius: 6,
  border: "1px solid var(--oxford-10)", background: "#fff",
  color: "var(--oxford-60)", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
};

const smallDangerBtn: React.CSSProperties = {
  padding: "7px 11px", borderRadius: 8,
  border: "1px solid #F3D6D6", background: "#fff",
  color: "#991B1B", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0,
};

const timeInputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--oxford-10)", fontSize: 13,
  color: "var(--oxford)", outline: "none", boxSizing: "border-box",
};

function pillBtn(color: string): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 6,
    border: "none", background: "transparent",
    color, cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

/* ─── Inline icons ────────────────────────────────────────────────────────── */

const sw = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

function IconPlus() {
  return (<svg width="12" height="12" {...sw}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
}
function IconTrash() {
  return (
    <svg width="11" height="11" {...sw}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="11" height="11" {...sw}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff() {
  return (
    <svg width="11" height="11" {...sw}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function IconCheck({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconCalendarOff() {
  return (
    <svg width="22" height="22" {...sw}>
      <path d="M4.18 4.18A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.83-1.18" />
      <path d="M21 15.5V6a2 2 0 0 0-2-2H9.5" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="10" y2="10" />
      <line x1="18" y1="10" x2="21" y2="10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function IconPalm() {
  return (
    <svg width="18" height="18" {...sw}>
      <path d="M12 22V12" />
      <path d="M12 12c-3-3-7-3-9-1 0 0 2-6 9-6" />
      <path d="M12 12c3-3 7-3 9-1 0 0-2-6-9-6" />
      <path d="M12 12c-2-4-6-5-9-3 0 0 1-4 4-5" />
      <path d="M12 12c2-4 6-5 9-3 0 0-1-4-4-5" />
    </svg>
  );
}
