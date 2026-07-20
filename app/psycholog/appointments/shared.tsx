"use client";

// ============================================================================
// Psixoloq randevu modulunun ortaq hissələri — əsas səhifə (page.tsx) və
// tarixçə (history/) arasında bölüşülür. Pasient tərəfinin dizayn dili ilə
// uyğunlaşdırılıb (app/patient/appointments/shared.tsx).
// ============================================================================

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import { googleCalendarUrl } from "@/lib/calendar";
import { appUrl } from "@/lib/appUrl";
import { toast } from "@/components/Toast";

export const WEEKDAYS_AZ = ["Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə", "Bazar"];
export const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

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
  return `${WEEKDAYS_AZ[isoDow]}, ${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]}`;
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

/* ─── Ortaq mətn primitivləri (nişan/badge əvəzinə) ────────────────────── */
.pa-sec{font-size:13px;font-weight:600;color:var(--oxford-60);margin:0 0 10px;letter-spacing:0}
/* Status — fonsuz, yalnız rəngli mətn. Ton mənanı daşıyır (mavi = sizdən asılı,
   sage = qaydasında, kəhrəba = gözləmədə, gül = problem, boz = arxivlik). */
.pa-status{display:inline-block;white-space:nowrap;font-size:12.5px;font-weight:600;letter-spacing:-.005em;color:var(--oxford-60)}
.pa-status--brand{color:#1051B7}
.pa-status--sage{color:#2F8163}
.pa-status--amber{color:#B0731F}
.pa-status--rose{color:#B4534F}
.pa-meta{display:flex;flex-wrap:wrap;align-items:center;gap:5px 14px;font-size:13px;font-weight:500;color:var(--oxford-60);line-height:1.5}
.pa-meta__item{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.pa-meta__item svg{flex:none}
.pa-meta b{font-weight:600;color:var(--oxford-80)}

/* ─── Növbəti seans ────────────────────────────────────────────────────── */
.pa-next{display:flex;background:#fff;border:1px solid var(--oxford-10);border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,33,71,.04)}
.pa-next__when{flex:none;width:138px;padding:24px 22px;border-right:1px solid var(--oxford-10);background:#FBFCFE;display:flex;flex-direction:column;justify-content:center}
.pa-next__day{font-size:12.5px;font-weight:600;color:var(--oxford-60);margin-bottom:2px}
.pa-next__time{font-size:31px;font-weight:600;letter-spacing:-.025em;color:var(--oxford);line-height:1.05;font-feature-settings:"tnum"}
.pa-next__end{font-size:12.5px;font-weight:500;color:var(--oxford-60);margin-top:3px;font-feature-settings:"tnum"}
.pa-next__main{flex:1;min-width:0;display:flex;align-items:center;gap:16px;padding:22px}
.pa-next__who{flex:1;min-width:0}
.pa-next__name{font-size:19px;font-weight:600;letter-spacing:-.01em;color:var(--oxford);line-height:1.25}
.pa-next__cta{flex:none;width:212px;padding:22px 22px 22px 0;display:flex;flex-direction:column;gap:9px;justify-content:center}
.pa-next__count{font-size:12.5px;font-weight:500;color:var(--oxford-60);text-align:center}
.pa-next__count--urgent{color:#B45309;font-weight:600}
.pa-next--empty{align-items:center;gap:12px;padding:20px 22px;color:var(--oxford-60);font-size:14px;font-weight:500;background:#FBFCFE}

/* ─── Düymələr ─────────────────────────────────────────────────────────── */
.pa-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:100%;border-radius:10px;padding:11px 14px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid transparent;text-decoration:none;transition:background .15s,border-color .15s,color .15s}
.pa-btn--primary{background:var(--brand);color:#fff}
.pa-btn--primary:hover:not(:disabled){background:var(--brand-600)}
.pa-btn--primary:disabled{opacity:.65;cursor:wait}
.pa-btn--ghost{background:#fff;color:var(--oxford-80);border-color:var(--oxford-10)}
.pa-btn--ghost:hover{background:#FBFCFE;border-color:var(--brand-200);color:var(--brand-700)}
.pa-btn--muted{background:#F4F7FB;color:#9AA7BD;cursor:not-allowed;user-select:none}
.pa-btn--auto{width:auto}

/* ─── Seans kartı ──────────────────────────────────────────────────────── */
.pa-card{display:flex;flex-direction:column;background:#fff;border:1px solid var(--oxford-10);border-radius:16px;padding:18px 20px;box-shadow:0 1px 2px rgba(0,33,71,.04);transition:box-shadow .18s ease,border-color .18s ease}
.pa-card:hover{box-shadow:0 6px 18px rgba(0,33,71,.07)}
.pa-card--next{border-color:var(--brand-200)}
.pa-card--attn{border-left:3px solid #E0A33E;padding-left:18px}
.pa-card--alert{border-left:3px solid #DC5757;padding-left:18px}
.pa-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.pa-card__day{font-size:12.5px;font-weight:500;color:var(--oxford-60)}
.pa-card__time{font-size:21px;font-weight:600;letter-spacing:-.02em;color:var(--oxford);line-height:1.2;margin-top:2px;font-feature-settings:"tnum"}
.pa-card__count{font-size:12.5px;font-weight:500;color:var(--oxford-60);margin-top:4px}
.pa-card__count--urgent{color:#B45309;font-weight:600}
.pa-card__rule{height:1px;background:var(--oxford-10);margin:14px 0}
.pa-card__who{display:flex;align-items:flex-start;gap:11px}
.pa-card__av{width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;flex:none}
.pa-card__name{font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--oxford);line-height:1.3}
.pa-card__nth{font-size:12.5px;font-weight:500;color:var(--oxford-60);margin-top:1px}
.pa-card__note{margin-top:12px;font-size:12.5px;font-weight:500;color:var(--oxford-60);line-height:1.5}
.pa-card__foot{display:flex;gap:9px;margin-top:auto;padding-top:16px}

/* ─── "Daha çox" menyusu ───────────────────────────────────────────────── */
.pa-menu-btn{display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--oxford-60);cursor:pointer;transition:background .15s,border-color .15s}
.pa-menu-btn:hover,.pa-menu-btn[data-open]{background:#F4F7FB;border-color:var(--oxford-10)}
.pa-menu{position:absolute;right:0;z-index:41;min-width:224px;background:#fff;border:1px solid var(--oxford-10);border-radius:12px;box-shadow:0 12px 32px rgba(0,33,71,.12);padding:6px;animation:gorFade .16s ease}
.pa-menu__item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:9px 10px;font-size:13px;font-weight:500;font-family:inherit;color:var(--oxford);cursor:pointer;text-decoration:none;transition:background .12s}
.pa-menu__item:hover{background:#F4F7FB}
.pa-menu__item--danger{color:#B4413F}
.pa-menu__item--danger:hover{background:#FBF1F1}
.pa-menu__ico{width:18px;display:inline-flex;align-items:center;justify-content:center;flex:none;opacity:.85}
.pa-menu__sep{height:1px;background:var(--oxford-10);margin:5px 4px}
@media(max-width:760px){
  .pa-next{flex-direction:column}
  .pa-next__when{width:auto;flex-direction:row;align-items:baseline;gap:10px;padding:15px 20px;border-right:none;border-bottom:1px solid var(--oxford-10)}
  .pa-next__day{margin-bottom:0}
  .pa-next__time{font-size:24px}
  .pa-next__end{margin-top:0}
  .pa-next__cta{width:auto;padding:0 20px 20px}
  .pa-next__main{padding:20px}
}
`;

/* ─── Inline line icons (no emojis) ──────────────────────────────────────── */
type IcoProps = { s?: number; c?: string };
export function IClock({ s = 14, c = "#5C6B85" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>; }
/* Meta sətri ikonları — seans sayı, paket, pulsuz tanışlıq. */
export function ILayers({ s = 13, c = "#9DB0CC" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>; }
export function IBox({ s = 13, c = "#9DB0CC" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v9" /></svg>; }
export function ISpark({ s = 13, c = "#9DB0CC" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.8L12 16.6 6.4 20.6l2.1-6.8L3 9.8h6.8L12 3z" /></svg>; }
export function IDots({ s = 16, c = "#5C6B85" }: IcoProps) { return <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>; }
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

/* ─── Mətn primitivləri ──────────────────────────────────────────────────
   Rəngli nişan/çip yerinə sadə "Etiket: dəyər" sətirləri və nöqtə + status
   mətni. Panel dili vebsayt ilə eyni olsun deyə. */

/* Seans statusu — semantik tonda yumşaq nişan.
   mavi = sizdən asılı, yaşıl = qaydasında, kəhrəba = gözləmədə, gül = problem,
   boz = arxivlik. Rəng mənası daşıyır, bəzək deyil. */
const STATUS_TONE: Record<string, string> = {
  ASSIGNED: "pa-status--brand",
  CONFIRMED: "pa-status--sage",
  PENDING: "pa-status--amber",
  AWAITING_CONFIRMATION: "pa-status--amber",
  CANCEL_REQUESTED: "pa-status--amber",
  REJECTED: "pa-status--rose",
  DISPUTED: "pa-status--rose",
  CANCELLED: "pa-status--rose",
};
export function StatusText({ status, size }: { status: string; size?: number }) {
  const s = STATUS[status] ?? STATUS.ASSIGNED;
  return (
    <span className={`pa-status ${STATUS_TONE[status] ?? ""}`.trim()} style={size ? { fontSize: size } : undefined}>
      {s.label}
    </span>
  );
}

/* Seansın növü/paketi haqqında sətirlər — "Paket: 8 seanslıq proqram". */
/** Meta sətrinin bir elementi: ikon + mətn. Elementlər arasında ayırıcı ("·")
 *  yoxdur — fərqi ikon və boşluq yaradır. */
export function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="pa-meta__item">{icon}<span>{children}</span></span>;
}

export function SessionMeta({ a, extra }: { a: AppointmentDetail; extra?: React.ReactNode }) {
  const items: React.ReactNode[] = [];
  if (extra) items.push(extra);
  if (a.sessionKind === "INTRO") {
    items.push(<MetaItem icon={<ISpark />}>Pulsuz tanışlıq görüşü</MetaItem>);
  }
  if (a.patientPackageId != null) {
    items.push(<MetaItem icon={<IBox />}><b>{a.packageName ?? "Seans paketi"}</b></MetaItem>);
    if (a.packageRemaining != null) {
      items.push(<MetaItem icon={<ICheck s={13} c="#9DB0CC" />}>{a.packageRemaining} seans qalıb</MetaItem>);
    }
  }
  if (!items.length) return null;
  // Fragment ilə sarılır ki, elementlər birbaşa flex uşağı qalsın (boşluqlar düzgün işləsin).
  return <div className="pa-meta">{items.map((l, i) => <Fragment key={i}>{l}</Fragment>)}</div>;
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
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="pa-btn pa-btn--primary">
        <IVideo />
        Seansa qoşul
      </a>
    );
  }
  return (
    <span title="Görüş linkini operator təyin edəcək" className="pa-btn pa-btn--muted">
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

/** Kartın küncündəki "daha çox" menyusu — şaquli üç nöqtə (standart overflow
 *  affordansı). Sıralama sabitdir: təhlükəsiz əməliyyatlar üstdə, dağıdıcı
 *  olanlar (ləğv/rədd/baş tutmadı) ayırıcı xəttdən sonra ən altda — beləliklə
 *  siyahı hansı statusda olursa-olsun eyni əzələ yaddaşı ilə işləyir. */
export function RowMenu({ items, size = 32 }: { items: MenuItem[]; size?: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!items.length) return null;
  const safe = items.filter(it => !it.danger);
  const danger = items.filter(it => it.danger);
  const ordered = [...safe, ...danger];
  const firstDangerAt = danger.length ? safe.length : -1;

  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" className="pa-menu-btn" aria-label="Digər əməliyyatlar"
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        style={{ width: size, height: size }} data-open={open ? "1" : undefined}>
        <IDots s={17} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} aria-hidden />
          <div role="menu" className="pa-menu" style={{ top: size + 6 }}>
            {ordered.map((it, i) => {
              const cls = `pa-menu__item${it.danger ? " pa-menu__item--danger" : ""}`;
              const sep = i === firstDangerAt ? <div key={`sep-${i}`} className="pa-menu__sep" /> : null;
              const inner = <><span className="pa-menu__ico">{it.icon}</span><span>{it.label}</span></>;
              const node = !it.href
                ? <button key={i} type="button" className={cls} onClick={() => { setOpen(false); it.onClick?.(); }}>{inner}</button>
                // Xarici linklər (məs. Google Calendar) yeni tabda açılır.
                : it.href.startsWith("http")
                  ? <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setOpen(false)}>{inner}</a>
                  : <Link key={i} href={it.href} className={cls} onClick={() => setOpen(false)}>{inner}</Link>;
              return sep ? <div key={`g-${i}`}>{sep}{node}</div> : node;
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

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await psychologistApi.disputeSession(appointment.id, reason.trim() || undefined);
      onDone(updated);
    } catch (e) {
      toast((e as Error).message, "error");
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
    if (!body.trim()) { toast("Qeyd mətni boş ola bilməz", "error"); return; }
    if (!appointment.patientId) { toast("Pasient ID tapılmadı", "error"); return; }
    setSaving(true);
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
      toast((e as Error).message, "error");
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
