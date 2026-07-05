"use client";

// ============================================================================
// Psixoloq randevu modulunun ortaq hissələri — əsas səhifə (page.tsx) və
// tarixçə (history/) arasında bölüşülür. Pasient tərəfinin dizayn dili ilə
// uyğunlaşdırılıb (app/patient/appointments/shared.tsx).
// ============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { googleCalendarUrl } from "@/lib/calendar";
import { appUrl } from "@/lib/appUrl";

export const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];
export const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

export function pad2(n: number) { return String(n).padStart(2, "0"); }
export function fmtTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function relativeDayLabel(d: Date, now: Date) {
  const today = new Date(now);
  const tomorrow = new Date(now); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, today)) return "Bu gün";
  if (isSameDay(d, tomorrow)) return "Sabah";
  const isoDow = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_AZ[isoDow]} · ${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}`;
}

export interface CountdownInfo {
  text: string;
  expired: boolean;
  urgent: boolean;
}
export function timeUntil(target: Date, now: Date): CountdownInfo {
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return { expired: true, urgent: false, text: "İndi başladı" };
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return { expired: false, urgent: minutes <= 15, text: `${minutes} dəq qaldı` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMin = minutes % 60;
    return { expired: false, urgent: false, text: `${hours} saat${remMin > 0 ? ` ${remMin} dəq` : ""} qaldı` };
  }
  const days = Math.floor(hours / 24);
  return { expired: false, urgent: false, text: `${days} gün qaldı` };
}

export function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/* Stable per-patient avatar tint from a small brand-friendly palette. */
const AVATAR_COLORS = ["#082F6D", "#1051B7", "#0F766E", "#6D28D9", "#B45309", "#9D174D"];
export function avatarColor(seed: string | number | null | undefined) {
  const str = String(seed ?? "?");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const STATUS: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  PENDING:               { label: "Yeni",            color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  ASSIGNED:              { label: "Sizə təyin",      color: "var(--brand-700)", bg: "var(--brand-50)", accent: "var(--brand)" },
  CONFIRMED:             { label: "Təsdiqli",        color: "#065F46",          bg: "#D1FAE5",         accent: "#10B981" },
  AWAITING_CONFIRMATION: { label: "Təsdiq gözlənir", color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  DISPUTED:              { label: "Mübahisəli",      color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  COMPLETED:             { label: "Tamamlandı",      color: "#374151",          bg: "#F3F4F6",         accent: "#9CA3AF" },
  CANCELLED:             { label: "Ləğv",            color: "#991B1B",          bg: "#FEE2E2",         accent: "#EF4444" },
  CANCEL_REQUESTED:      { label: "Ləğv gözlənir",   color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
  REJECTED:              { label: "Rədd",            color: "#92400E",          bg: "#FEF3C7",         accent: "#F59E0B" },
};

// Option B-də keçmiş seans avtomatik "Tamamlandı" olur. Seans əslində baş tutmadısa,
// psixoloq onu bu pəncərə ərzində "baş tutmadı" kimi bildirə bilər.
export const NO_SHOW_REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Modula xas animasiya + scrollbar gizlətməsi (media query inline ola bilmir).
export const PSY_APPT_STYLE = `
@keyframes gorFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes gorSheet{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes gorLive{0%,100%{opacity:1}50%{opacity:.45}}
.gor-live{animation:gorLive 1.4s ease-in-out infinite}
.gor-tabs::-webkit-scrollbar{height:0}
.gor-menu:hover{border-color:var(--brand)!important}
.gor-link:hover{border-color:var(--brand)!important}
.gor-accept:hover{background:var(--brand-700)!important}
.gor-decline:hover{background:#FEE2E2!important}
.gor-sheet-item:hover{background:#F8FAFD!important}
.gor-sheet-item--danger:hover{background:#FEE2E2!important}
`;

/* ─── Inline line icons (no emojis) ──────────────────────────────────────── */
type IcoProps = { s?: number; c?: string };
export function IClock({ s = 14, c = "#5C6B85" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>; }
export function IDots({ s = 16, c = "#5C6B85" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>; }
export function IMsg({ s = 14, c = "#9DB0CC" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
export function ICal({ s = 20, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>; }
export function IAlert({ s = 20, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>; }
export function IRefresh({ s = 18, c = "var(--brand)" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>; }
export function ICheck({ s = 13, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6L9 17l-5-5" /></svg>; }
export function IUser({ s = 18, c = "var(--brand)" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
export function IX({ s = 18, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>; }
export function IVideo({ s = 15, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>; }
export function IOpen({ s = 15, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>; }
export function ISearch({ s = 15, c = "currentColor" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /></svg>; }

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

export function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "48px 24px", textAlign: "center", animation: "gorFade .25s ease" }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, background: "var(--brand-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 15 }}><ICal s={26} c="#9DB0CC" /></div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{msg}</div>
    </div>
  );
}

/* Qoşulma düyməsi — link operator tərəfindən təyin edilibsə aktiv (brand),
   edilməyibsə boz/deaktiv. Pasient tərəfindəki SessionJoinButton ilə eyni dizayn. */
export function PsyJoinButton({ a }: { a: AppointmentDetail }) {
  const link = a.meetingLink;
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", borderRadius: 10, padding: "11px 14px",
    fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
  };
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        style={{ ...base, background: "var(--brand)", color: "#fff", textDecoration: "none", boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
        <IVideo />
        Seansa qoşul
      </a>
    );
  }
  return (
    <span title="Görüş linkini operator təyin edəcək"
      style={{ ...base, background: "#EEF2F8", color: "#9AA7BD", cursor: "not-allowed", userSelect: "none" }}>
      <IVideo />
      Seansa qoşul
    </span>
  );
}

/* Google Calendar hadisə linki — kart menyusu və detal pəncərəsi üçün. */
export function gcalHrefFor(a: AppointmentDetail): string | null {
  if (!a.startAt || !a.endAt) return null;
  return googleCalendarUrl({
    uid: String(a.id),
    title: `Fanus seansı${a.patientName ? ` — ${a.patientName}` : ""}`,
    description: [
      a.patientName ? `Pasient: ${a.patientName}` : null,
      a.note ? `Qeyd: ${a.note}` : null,
      appUrl("/psycholog/appointments"),
    ].filter(Boolean).join("\n"),
    location: "Online (Fanus)",
    start: new Date(a.startAt),
    end: new Date(a.endAt),
    url: appUrl("/psycholog/appointments"),
  });
}

/* ─── 3 nöqtə menyusu ────────────────────────────────────────────────────── */

export type MenuItem = { label: string; onClick?: () => void; href?: string; danger?: boolean; icon?: React.ReactNode };

export function RowMenu({ items, size = 32 }: { items: MenuItem[]; size?: number }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" className="gor-menu" aria-label="Əməliyyatlar" onClick={() => setOpen(o => !o)}
        style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", background: open ? "var(--brand-50)" : "transparent", color: "var(--oxford-60)", border: "none", borderRadius: 8, cursor: "pointer" }}>
        <IDots s={17} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} aria-hidden />
          <div role="menu" style={{ position: "absolute", right: 0, top: size + 4, zIndex: 41, minWidth: 210, background: "#fff", border: "1px solid #E3EAF6", borderRadius: 12, boxShadow: "0 10px 30px rgba(8,47,109,.14)", padding: 6, animation: "gorFade .16s ease" }}>
            {items.map((it, i) => {
              const st: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontWeight: 600, color: it.danger ? "#991B1B" : "var(--oxford)", cursor: "pointer", fontFamily: "inherit", textDecoration: "none" };
              const cls = `gor-sheet-item${it.danger ? " gor-sheet-item--danger" : ""}`;
              if (!it.href) {
                return <button key={i} type="button" className={cls} style={st} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.icon}<span>{it.label}</span></button>;
              }
              // Xarici linklər (məs. Google Calendar) yeni tabda açılır.
              return it.href.startsWith("http")
                ? <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" className={cls} style={st} onClick={() => setOpen(false)}>{it.icon}<span>{it.label}</span></a>
                : <Link key={i} href={it.href} className={cls} style={st} onClick={() => setOpen(false)}>{it.icon}<span>{it.label}</span></Link>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Dispute modal — "seans baş tutmadı" bildirişi ──────────────────────── */

export function DisputeModal({
  appointment, onClose, onDone,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onDone: (updated: AppointmentDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updated = await psychologistApi.disputeSession(appointment.id, reason.trim() || undefined);
      onDone(updated);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(480px, 100%)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--brand-100)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>Seans baş tutmadı</h2>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            Operator komandamız müraciətinizə baxıb həll edəcək.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            Səbəb (məcburi deyil)
          </label>
          <textarea
            rows={4} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Məsələn: pasient qoşulmadı, texniki problem…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Bağla
            </button>
            <button onClick={submit} disabled={saving}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#DC2626", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Göndərilir…" : "Operator'a bildir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Session outcome modal — write a clinical note tied to this appointment ── */

export function OutcomeModal({
  appointment, onClose, onSaved,
}: {
  appointment: AppointmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Bu seans üçün əvvəlcədən yazılmış qeyd varsa, formu onunla dolduraq —
  // yoxdursa boş qalır və submit "create" edir.
  useEffect(() => {
    let cancelled = false;
    psychologistApi.noteForAppointment(appointment.id)
      .then(n => {
        if (cancelled || !n) return;
        setExistingId(n.id);
        setBody(n.body ?? "");
        setMood(n.moodScore ?? "");
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appointment.id]);

  const submit = async () => {
    if (!body.trim()) { setErr("Qeyd mətni boş ola bilməz"); return; }
    if (!appointment.patientId) { setErr("Pasient ID tapılmadı"); return; }
    setSaving(true); setErr(null);
    try {
      if (existingId != null) {
        await psychologistApi.updateNote(existingId, {
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          title: null,
          body: body.trim(),
          moodScore: typeof mood === "number" ? mood : null,
        });
      } else {
        await psychologistApi.createNote({
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          title: null,
          body: body.trim(),
          moodScore: typeof mood === "number" ? mood : null,
        });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 0, maxWidth: 540, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: 0 }}>
            {existingId != null ? "Seans qeydini redaktə et" : "Seans qeydi"}
          </h3>
          <p style={{ fontSize: 12, color: "var(--oxford-60)", marginTop: 4 }}>
            {appointment.patientName ?? "Pasient"} ilə seans haqqında qısa qeyd — pasient bunu görmür, AES-256 ilə şifrələnir.
          </p>
        </div>
        <div style={{ padding: 22 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: "var(--oxford-60)" }}>Yüklənir…</div>
          ) : (
            <>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
                Seansın nəticəsi
              </label>
              <textarea
                rows={6} value={body} onChange={e => setBody(e.target.value)}
                placeholder="İşlənən mövzu, müştəri reaksiyası, gələcək plan…"
                autoFocus
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box", resize: "vertical" }} />

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
                Əhval-ruhiyyə qiymətləndirməsi (1–10, məcburi deyil)
              </label>
              <input type="number" min={1} max={10} value={mood}
                onChange={e => { const v = e.target.value; setMood(v === "" ? "" : Math.max(1, Math.min(10, Number(v)))); }}
                style={{ width: 80, padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12 }} />
            </>
          )}

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              Ləğv
            </button>
            <button onClick={submit} disabled={saving || loading}
              style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: (saving || loading) ? "wait" : "pointer", opacity: (saving || loading) ? 0.7 : 1 }}>
              {saving ? "Saxlanılır…" : existingId != null ? "Yenilə" : "Qeydi saxla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
