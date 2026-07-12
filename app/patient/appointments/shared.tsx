"use client";

// ============================================================================
// Pasiyent randevu modulunun ortaq hissələri — əsas səhifə (page.tsx),
// tarixçə (history/) və paket detalı (packages/[id]/) arasında bölüşülür.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { getPsychologistAvailability, type AvailableSlot } from "@/lib/api";
import { azFormatDate, azFormatTime } from "@/lib/datetime";

export const STATUS: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  PENDING:                { label: "Gözlənilir",       color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:               { label: "Təyin edilib",     color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:              { label: "Təsdiqlənib",      color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION:  { label: "Təsdiq gözlənir",  color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:               { label: "Mübahisəli",       color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:              { label: "Tamamlandı",       color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:              { label: "Ləğv edildi",      color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  CANCEL_REQUESTED:       { label: "Ləğv gözlənir",    color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  REJECTED:               { label: "Yenidən təyin",    color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

export const PKG_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: "Aktiv",         color: "#065F46", bg: "#D1FAE5" },
  EXHAUSTED: { label: "Bitib",         color: "#374151", bg: "#F3F4F6" },
  EXPIRED:   { label: "Müddəti keçib", color: "#92400E", bg: "#FEF3C7" },
  CANCELLED: { label: "Ləğv edilib",   color: "#991B1B", bg: "#FEE2E2" },
};

// Modula xas animasiya + filter scrollbar gizlətməsi (media query inline ola bilmir).
export const PA_STYLE = `
@keyframes paFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes paSheet{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes paLive{0%,100%{opacity:1}50%{opacity:.45}}
.pa-filters::-webkit-scrollbar{height:0}
.pa-live{animation:paLive 1.4s ease-in-out infinite}
`;

export function pad2(n: number) { return String(n).padStart(2, "0"); }
export function isoDateOnly(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** Köhnə randevularda operatorNote-a yazılmış "[Vaxt dəyişikliyi istəyi]" sistem
 *  damğasını gizlədir — bu daxili işarədir, pasiyentə göstərilməli deyil. */
export function cleanOperatorNote(note?: string | null): string {
  if (!note) return "";
  return note.split("\n").filter(line => !line.trim().startsWith("[Vaxt dəyişikliyi istəyi]")).join("\n").trim();
}

/* Paket seansını adi seans siyahılarında fərqləndirən nişan. */
export function PackageBadge({ name }: { name?: string | null }) {
  return (
    <span title={name ?? undefined} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
      Paket
    </span>
  );
}

/* Pulsuz tanışlıq (INTRO, 15 dəq) görüşünü adi seans siyahılarında fərqləndirən nişan. */
export function IntroBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#D1FAE5", color: "#065F46", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
      Tanışlıq · Pulsuz
    </span>
  );
}

export function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
export function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

/* ─── Sections wrapper ───────────────────────────────────────────────────── */

export function Section({
  title, count, icon, children, defaultCollapsed = false, card = false, collapsible = true,
}: {
  title: string;
  count: number;
  icon: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  card?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const isOpen = collapsible ? open : true;

  const labelRow = (
    <>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--oxford)" }}>{title}</span>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 7px", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 12, fontWeight: 700, borderRadius: 999 }}>{count}</span>
    </>
  );
  const chevron = (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
  );

  if (card) {
    return (
      <section style={{ marginTop: 22, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
        <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: "18px 20px", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>{labelRow}</span>
          {chevron}
        </button>
        {isOpen && children}
      </section>
    );
  }

  return (
    <section style={{ marginTop: 22 }}>
      <button type="button" onClick={() => collapsible && setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", padding: "0 0 16px", cursor: collapsible ? "pointer" : "default", textAlign: "left", fontFamily: "inherit" }}>
        {labelRow}
        <span style={{ flex: 1 }} />
        {collapsible && chevron}
      </button>
      {isOpen && children}
    </section>
  );
}

export function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 26, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
      {msg}
    </div>
  );
}

/* ─── Slot picker — psixoloqun açıq vaxtları (paket seansı planlamaq üçün) ── */

export function SlotPicker({ psychologistId, busy, onPick, confirmNote }: {
  psychologistId: number;
  busy: boolean;
  onPick: (slot: AvailableSlot) => void | Promise<void>;
  confirmNote?: string;
}) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  // Saata basmaq müraciəti birbaşa göndərmir — əvvəlcə təsdiq popup-ı çıxır.
  const [picked, setPicked] = useState<AvailableSlot | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    getPsychologistAvailability(psychologistId, isoDateOnly(today), isoDateOnly(to))
      .then(s => { if (alive) setSlots(s); })
      .catch(() => { if (alive) setSlots([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [psychologistId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  if (loading) return <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Açıq vaxtlar yüklənir…</div>;
  if (slots.length === 0) return <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Bu psixoloqun yaxın 3 həftədə açıq vaxtı yoxdur.</div>;

  // Təsdiqlə: sorğu bitənə qədər popup açıq qalır (busy → "Göndərilir…"), sonra bağlanır.
  const confirm = async () => { if (!picked) return; await onPick(picked); setPicked(null); };

  return (
    <>
      <div style={{ display: "grid", gap: 10, maxHeight: 240, overflowY: "auto" }}>
        {grouped.map(([day, daySlots]) => (
          <div key={day}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {daySlots.map(s => (
                <button key={s.startAt} type="button" disabled={busy} onClick={() => setPicked(s)}
                  style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                  {azFormatTime(s.startAt)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {picked && (
        <div onClick={() => !busy && setPicked(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 1000, animation: "paFade .15s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.22)", border: "1px solid #EDF1F8", padding: 24, width: "100%", maxWidth: 380, animation: "paSheet .2s ease" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "var(--brand-100)", color: "var(--brand-700)", marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Bu vaxtı təsdiqləyirsiniz?</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-700)", marginBottom: 8 }}>
              {azFormatDate(picked.startAt)} · {azFormatTime(picked.startAt)}
            </div>
            <div style={{ fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.5, marginBottom: 20 }}>
              {confirmNote ?? "Seçdiyiniz vaxt operatora göndəriləcək, təsdiqdən sonra randevuya çevriləcək."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" disabled={busy} onClick={() => setPicked(null)}
                style={{ flex: 1, background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                Ləğv et
              </button>
              <button type="button" disabled={busy} onClick={confirm}
                style={{ flex: 1.4, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Göndərilir…" : "Bəli, göndər"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
