"use client";

// Modul H — operator "Müştərilər" direktoriyası.
//  • Axtarış: operatorApi.search → pasiyent hitləri (ad / telefon / email).
//  • Default: randevulardan törədilən "Son müştərilər" — hər sətir zəngin
//    (Son seans · Paket · Psixoloq · No-show flag), heç bir əlavə endpoint olmadan.
//  • "Yeni müştəri": operatorApi.createPatient → yeni pasiyentin 360° profilinə keçid.
// Hər sətir /operator/customers/{patientId} profilinə aparır.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { operatorApi, type OperatorSearchHit, type AppointmentDetail } from "@/lib/api";
import { toast } from "@/components/Toast";

// ─── Köməkçilər ──────────────────────────────────────────────────────────────

const AV_PALETTE = [
  { bg: "#E0EBFA", color: "#1E3A8A" },
  { bg: "#D1FAE5", color: "#065F46" },
  { bg: "#FEF3C7", color: "#92400E" },
  { bg: "#EDE9FE", color: "#5B21B6" },
  { bg: "#FCE7F3", color: "#9D174D" },
];
function avatarOf(id: number) { return AV_PALETTE[Math.abs(id) % AV_PALETTE.length]; }

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

type LastTone = "green" | "neutral" | "amber" | "muted";
const LAST_TONE: Record<LastTone, { bg: string; color: string }> = {
  green:   { bg: "#ECFDF5", color: "#047857" },
  neutral: { bg: "#F3F4F6", color: "#374151" },
  amber:   { bg: "#FEF3C7", color: "#92400E" },
  muted:   { bg: "#F3F4F6", color: "#9DB0CC" },
};
function lastSession(ts: number, now: number): { label: string; tone: LastTone } {
  if (!ts) return { label: "Heç seans yox", tone: "muted" };
  const days = Math.floor((now - ts) / 86_400_000);
  let label: string;
  if (days <= 0) label = "Bu gün";
  else if (days <= 7) label = `${days} gün öncə`;
  else label = fmtDate(ts);
  const tone: LastTone = days <= 3 ? "green" : days <= 30 ? "neutral" : "amber";
  return { label, tone };
}

interface RecentCustomer {
  id: number;
  name: string;
  contact: string;
  lastAt: number;
  lastLabel: string;
  lastTone: LastTone;
  pkg: string | null;
  psych: string | null;
  flag: string | null;
  hasUpcoming: boolean;
}

const DONE_STATUSES = new Set(["CANCELLED", "REJECTED", "COMPLETED"]);

/** Randevu siyahısından unikal müştəriləri zənginləşdirib son fəaliyyətə görə sıralayır. */
function deriveRecent(appts: AppointmentDetail[]): RecentCustomer[] {
  const now = Date.now();
  type Acc = {
    id: number; name: string; phone: string; email: string; lastAt: number;
    psych: string | null; psychAt: number; pkg: string | null; pkgAt: number;
    noShow: number; upcoming: boolean;
  };
  const map = new Map<number, Acc>();

  for (const a of appts) {
    if (a.patientId == null) continue;
    const start = a.startAt ? Date.parse(a.startAt) : NaN;
    const created = a.createdAt ? Date.parse(a.createdAt) : NaN;
    const ts = Math.max(Number.isNaN(start) ? 0 : start, Number.isNaN(created) ? 0 : created);

    let e = map.get(a.patientId);
    if (!e) {
      e = { id: a.patientId, name: "", phone: "", email: "", lastAt: 0, psych: null, psychAt: 0, pkg: null, pkgAt: 0, noShow: 0, upcoming: false };
      map.set(a.patientId, e);
    }
    // Kimlik — ən son randevudan
    if (ts >= e.lastAt) {
      e.lastAt = ts;
      const nm = (a.patientName ?? "").trim();
      if (nm) e.name = nm;
      if (a.patientPhone) e.phone = a.patientPhone;
      if (a.patientEmail) e.email = a.patientEmail;
    }
    if (!e.name) e.name = (a.patientName ?? "").trim();
    if (!e.phone && a.patientPhone) e.phone = a.patientPhone;
    if (!e.email && a.patientEmail) e.email = a.patientEmail;

    const at = Number.isNaN(start) ? ts : start;
    // Psixoloq — ən son təyinatdan
    if (a.psychologistName && at >= e.psychAt) { e.psychAt = at; e.psych = a.psychologistName; }
    // Paket — ən son paketli seansdan
    if (a.patientPackageId != null && at >= e.pkgAt) {
      e.pkgAt = at;
      e.pkg = a.packageName && a.packageName.trim() ? a.packageName.trim() : "Paketli";
    }
    // No-show sayı
    if (a.cancelReasonCode && a.cancelReasonCode.includes("NO_SHOW")) e.noShow++;
    // Yaxın seans
    if (!Number.isNaN(start) && start > now && !DONE_STATUSES.has(a.status)) e.upcoming = true;
  }

  const out: RecentCustomer[] = [];
  for (const e of map.values()) {
    const contact = [e.phone, e.email].filter(Boolean).join(" · ") || "—";
    const name = e.name || e.email || `Pasiyent #${e.id}`;
    const ls = lastSession(e.lastAt, now);
    out.push({
      id: e.id, name, contact, lastAt: e.lastAt,
      lastLabel: ls.label, lastTone: ls.tone,
      pkg: e.pkg, psych: e.psych,
      flag: e.noShow >= 2 ? "No-show riski" : null,
      hasUpcoming: e.upcoming,
    });
  }
  out.sort((x, y) => y.lastAt - x.lastAt);
  return out.slice(0, 30);
}

// ─── İkonlar ─────────────────────────────────────────────────────────────────

function Ico({ d, size = 17, w = 2, fill = "none" }: { d: ReactNode; size?: number; w?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const I_USERS = <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>;
const I_CAL = <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>;
const I_WARN = <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>;
const I_SEARCH = <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>;

// ─── Səhifə ──────────────────────────────────────────────────────────────────

export default function OperatorCustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OperatorSearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentCustomer[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // Default — son aktiv pasiyentlərin randevularından "son müştərilər" siyahısı
  // (tam cədvəl skanı əvəzinə məqsədli sorğu; derive məntiqi eynidir).
  useEffect(() => {
    let alive = true;
    operatorApi.listRecentCustomerAppointments(30)
      .then(a => { if (alive) setRecent(deriveRecent(a)); })
      .catch(() => { if (alive) setRecent([]); });
    return () => { alive = false; };
  }, []);

  // Debounced axtarış
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); setLoading(false); return; }
    setLoading(true);
    const id = window.setTimeout(() => {
      operatorApi.search(term, 12)
        .then(r => setHits(r.patients))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(id);
  }, [q]);

  const term = q.trim();
  const searching = term.length >= 2;
  const recents = recent ?? [];

  const stats = {
    total: recents.length,
    upcoming: recents.filter(r => r.hasUpcoming).length,
    flagged: recents.filter(r => r.flag).length,
  };

  let body: ReactNode;
  if (searching) {
    if (loading) body = <SkeletonRows />;
    else if (!hits || hits.length === 0)
      body = <EmptyState icon={I_SEARCH} title={`« ${term} » üçün uyğun müştəri tapılmadı.`} sub="Adı, telefonu və ya email-i yoxlayın." />;
    else body = (
      <div style={ROWS_WRAP}>
        {hits.map(h => (
          <CustomerRow key={h.id} id={h.id} name={h.title} contact={h.subtitle || "—"} />
        ))}
      </div>
    );
  } else {
    if (recent === null) body = <SkeletonRows />;
    else if (recents.length === 0)
      body = <EmptyState icon={I_USERS} title="Hələ randevusu olan müştəri yoxdur." sub="Axtarışdan istifadə edin." />;
    else body = (
      <div style={ROWS_WRAP}>
        {recents.map(r => <CustomerRow key={r.id} id={r.id} name={r.name} contact={r.contact} recent={r} />)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", color: "var(--oxford)" }}>Müştərilər</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>İstənilən pasiyenti tapın və 360° profilini açın.</p>
        </div>
        <button type="button" onClick={() => setNewOpen(true)} className="omx-ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
          Yeni müştəri
        </button>
      </div>

      {/* SEARCH */}
      <div style={CARD}>
        <div style={{ position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Pasiyent adı, telefon və ya email…"
            autoComplete="off"
            style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 11, padding: "13px 42px", fontSize: 14.5, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", background: "#fff" }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Təmizlə"
              style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: "50%", cursor: "pointer", color: "var(--oxford-60)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 8, paddingLeft: 2 }}>Ən azı 2 simvol yazın.</div>
      </div>

      {/* STAT STRIP — yalnız default görünüşdə */}
      {!searching && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13 }}>
          <StatCard value={stats.total} label="Son müştərilər" icon={I_USERS} color="#082F6D" iconColor="#1051B7" />
          <StatCard value={stats.upcoming} label="Yaxın seansı olan" icon={I_CAL} color="#047857" iconColor="#047857" />
          <StatCard value={stats.flagged} label="Diqqət tələb edən" icon={I_WARN} color="#991B1B" iconColor="#991B1B" />
        </div>
      )}

      {/* BODY */}
      <div style={{ ...CARD, padding: "8px 10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 10px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford-60)" }}>
            {searching ? `« ${term} » üçün ${hits?.length ?? 0} nəticə` : "Son müştərilər"}
          </span>
          {!searching && recent !== null && recents.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{recents.length}</span>
          )}
        </div>
        {body}
      </div>

      {newOpen && <CreatePatientModal onClose={() => setNewOpen(false)} onCreated={id => { setNewOpen(false); router.push(`/operator/customers/${id}`); }} />}
    </div>
  );
}

// ─── Sətir ───────────────────────────────────────────────────────────────────

const ROWS_WRAP: React.CSSProperties = { display: "flex", flexDirection: "column" };

function CustomerRow({ id, name, contact, recent }: { id: number; name: string; contact: string; recent?: RecentCustomer }) {
  const av = avatarOf(id);
  const flagged = !!recent?.flag;
  return (
    <Link href={`/operator/customers/${id}`} className="omx-row"
      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textDecoration: "none", borderTop: "1px solid #F4F7FB", padding: "13px 10px", flexWrap: "wrap" }}>
      <span style={{ flex: "none" }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: av.bg, color: av.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, boxShadow: flagged ? "0 0 0 2px #fff,0 0 0 4px #FCA5A5" : "none" }}>
          {initialsOf(name)}
        </span>
      </span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--oxford)" }}>{name}</div>
        <div style={{ fontSize: 13, color: "#52718F", fontWeight: 500, marginTop: 1 }}>{contact}</div>
      </div>
      {recent && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: LAST_TONE[recent.lastTone].bg, color: LAST_TONE[recent.lastTone].color, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {recent.lastLabel}
          </span>
          {recent.pkg && <span style={{ background: "#E4ECFA", color: "#082F6D", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>Paket: {recent.pkg}</span>}
          {recent.psych && <span style={{ background: "#F3F4F6", color: "#374151", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999 }}>Psixoloq: {recent.psych}</span>}
          {recent.flag && <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{recent.flag}</span>}
        </div>
      )}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7D3E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

function StatCard({ value, label, icon, color, iconColor }: { value: number; label: string; icon: ReactNode; color: string; iconColor: string }) {
  return (
    <div style={{ ...CARD, padding: "15px 17px", position: "relative" }}>
      <span style={{ position: "absolute", top: 15, right: 15, color: iconColor }}><Ico d={icon} /></span>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div style={{ padding: "44px 20px", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: "var(--brand-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "#9DB0CC" }}>
        <Ico d={icon} size={26} w={1.8} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5, color: "var(--oxford)" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9DB0CC", fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={ROWS_WRAP}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, borderTop: "1px solid #F4F7FB", padding: "13px 10px" }}>
          <div className="omx-skel" style={{ width: 42, height: 42, borderRadius: 12, flex: "none" }} />
          <div style={{ flex: 1 }}>
            <div className="omx-skel" style={{ width: "45%", height: 13, borderRadius: 6, marginBottom: 8 }} />
            <div className="omx-skel" style={{ width: "30%", height: 10, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Yeni müştəri modalı ─────────────────────────────────────────────────────

function CreatePatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());

  const submit = async () => {
    if (!emailOk || busy) return;
    setBusy(true);
    try {
      const r = await operatorApi.createPatient({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast("Müştəri yaradıldı", "success");
      onCreated(r.patientId);
    } catch (e) {
      toast((e as Error).message || "Müştəri yaradıla bilmədi", "error");
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,26,51,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="omx-sheet"
        style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, boxShadow: "0 18px 48px rgba(10,26,51,.28)", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--oxford)" }}>Yeni müştəri</h2>
          <button type="button" onClick={onClose} aria-label="Bağla" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--oxford-60)", display: "flex", padding: 2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>Email mütləqdir. Pasiyent yaradıldıqdan sonra 360° profili açılacaq.</p>

        <Field label="Email *" value={email} onChange={setEmail} placeholder="ad@mail.az" type="email" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Ad" value={firstName} onChange={setFirstName} placeholder="Ad" />
          <Field label="Soyad" value={lastName} onChange={setLastName} placeholder="Soyad" />
        </div>
        <Field label="Telefon" value={phone} onChange={setPhone} placeholder="+994 ..." />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ background: "#fff", color: "#082F6D", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv et</button>
          <button type="button" onClick={submit} disabled={!emailOk || busy}
            style={{ background: emailOk && !busy ? "var(--brand)" : "#9DB0CC", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: emailOk && !busy ? "pointer" : "default", boxShadow: emailOk && !busy ? "0 4px 12px rgba(16,81,183,.24)" : "none" }}>
            {busy ? "Yaradılır…" : "Yarat və aç"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 5 }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off"
        style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "var(--oxford)", fontFamily: "inherit", background: "#fff" }} />
    </label>
  );
}

// ─── Stil ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)",
  border: "1px solid #EDF1F8", padding: "16px 18px",
};

const CSS = `
.omx-row{transition:background .14s}
.omx-row:hover{background:#F2F6FD}
.omx-ghost:hover{border-color:#1051B7;color:#1051B7}
@keyframes omxShim{0%{background-position:-320px 0}100%{background-position:320px 0}}
.omx-skel{background:linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%);background-size:640px 100%;animation:omxShim 1.4s infinite linear}
@keyframes omxSheet{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.omx-sheet{animation:omxSheet .16s ease-out}
`;
