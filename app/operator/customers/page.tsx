"use client";

// Modul H — operator "Müştərilər" direktoriyası (Fanus UI Kit).
//  • Axtarış: operatorApi.search → pasiyent hitləri (ad / telefon / email).
//  • Default: randevulardan törədilən "Son müştərilər" — zəngin sətir
//    (Son seans · Paket · Psixoloq · No-show flag), seqment tabları + sıralama.
//  • "Yeni müştəri": operatorApi.createPatient → yeni pasiyentin 360° profilinə keçid.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type OperatorSearchHit, type AppointmentDetail } from "@/lib/api";
import { toast } from "@/components/Toast";
import { Icon } from "./icons";

// ─── Köməkçilər ──────────────────────────────────────────────────────────────
function avatarVariant(id: number) { return (Math.abs(id) % 4) + 1; }
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}
function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || null;
}

type LastTone = "green" | "neutral" | "amber" | "muted";
const LAST_TONE: Record<LastTone, { bg: string; fg: string }> = {
  green:   { bg: "var(--sage-bg)", fg: "#2E6B54" },
  neutral: { bg: "var(--bg-blue)", fg: "var(--oxford-80)" },
  amber:   { bg: "var(--status-pending-bg)", fg: "var(--status-pending-fg)" },
  muted:   { bg: "var(--surface-muted)", fg: "var(--oxford-60)" },
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
  phone: string | null;
  email: string | null;
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
    if (a.psychologistName && at >= e.psychAt) { e.psychAt = at; e.psych = a.psychologistName; }
    if (a.patientPackageId != null && at >= e.pkgAt) {
      e.pkgAt = at;
      e.pkg = a.packageName && a.packageName.trim() ? a.packageName.trim() : "Paketli";
    }
    if (a.cancelReasonCode && a.cancelReasonCode.includes("NO_SHOW")) e.noShow++;
    if (!Number.isNaN(start) && start > now && !DONE_STATUSES.has(a.status)) e.upcoming = true;
  }

  const out: RecentCustomer[] = [];
  for (const e of map.values()) {
    const name = e.name || e.email || `Pasiyent #${e.id}`;
    const ls = lastSession(e.lastAt, now);
    out.push({
      id: e.id, name, phone: e.phone || null, email: e.email || null, lastAt: e.lastAt,
      lastLabel: ls.label, lastTone: ls.tone,
      pkg: e.pkg, psych: e.psych,
      flag: e.noShow >= 2 ? "No-show riski" : null,
      hasUpcoming: e.upcoming,
    });
  }
  out.sort((x, y) => y.lastAt - x.lastAt);
  return out.slice(0, 30);
}

type SegKey = "all" | "near" | "attention";
const SEGMENTS: { key: SegKey; label: string }[] = [
  { key: "all", label: "Hamısı" },
  { key: "near", label: "Yaxın seansı olan" },
  { key: "attention", label: "Diqqət tələb edən" },
];

// ─── Səhifə ──────────────────────────────────────────────────────────────────
export default function OperatorCustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OperatorSearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentCustomer[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [tab, setTab] = useState<SegKey>("all");
  const [sort, setSort] = useState<"activity" | "name">("activity");
  const [psych, setPsych] = useState("all");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // Default — son aktiv pasiyentlərin randevularından "son müştərilər" siyahısı.
  useEffect(() => {
    let alive = true;
    operatorApi.listRecentCustomerAppointments(30)
      .then(a => { if (alive) setRecent(deriveRecent(a)); })
      .catch(() => { if (alive) setRecent([]); });
    return () => { alive = false; };
  }, []);

  // Debounced axtarış (server) — 2+ simvol.
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
  const recents = useMemo(() => recent ?? [], [recent]);

  const stats = {
    total: recents.length,
    near: recents.filter(r => r.hasUpcoming).length,
    attention: recents.filter(r => r.flag).length,
    packaged: recents.filter(r => r.pkg).length,
  };

  const psychOptions = useMemo(
    () => Array.from(new Set(recents.map(r => r.psych).filter(Boolean))) as string[],
    [recents]);

  const counts = {
    all: recents.length,
    near: stats.near,
    attention: stats.attention,
  };

  const filteredRecents = useMemo(() => {
    let list = recents.filter(r =>
      tab === "all" ? true : tab === "near" ? r.hasUpcoming : !!r.flag);
    if (psych !== "all") list = list.filter(r => r.psych === psych);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "az"));
    else list = [...list].sort((a, b) => b.lastAt - a.lastAt);
    return list;
  }, [recents, tab, psych, sort]);

  const goProfile = (id: number) => router.push(`/operator/customers/${id}`);
  const callPatient = (phone: string) => { const p = normalizePhone(phone); if (p) window.location.assign(`tel:${p}`); };
  const whatsapp = (phone: string) => { const p = normalizePhone(phone); if (p) window.open(`https://wa.me/${p.replace(/^\+/, "").replace(/[^\d]/g, "")}`, "_blank", "noopener"); };

  // Boş/yüklənmə halları cədvəldən kənarda göstərilir (psychologists səhifəsi ilə eyni qayda) —
  // cədvəl yalnız göstəriləcək sətir olduqda render olunur.
  const isEmpty = searching ? (!loading && (!hits || hits.length === 0)) : (recent !== null && filteredRecents.length === 0);
  const isLoading = searching ? loading : recent === null;

  const tableRows: ReactNode = searching
    ? (hits ?? []).map(h => (
        <HitRow key={h.id} id={h.id} name={h.title} contact={h.subtitle || "—"} onOpen={() => goProfile(h.id)} />
      ))
    : filteredRecents.map(r => (
        <CustomerRow key={r.id} r={r} onOpen={() => goProfile(r.id)} onCall={() => r.phone && callPatient(r.phone)} onWa={() => r.phone && whatsapp(r.phone)} />
      ));

  return (
    <div className="fx-page" style={{ minHeight: "auto", padding: 0 }}>
      {/* Başlıq */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="fx-h1">Müştərilər</h1>
          <div className="fx-subtitle">Direktoriya · axtar, seqmentlə, sətirdən əməliyyat et</div>
        </div>
        <button type="button" onClick={() => setNewOpen(true)} className="fx-btn fx-btn--primary">
          <Icon name="plus" /> Yeni müştəri
        </button>
      </div>

      {/* KPI zolağı */}
      <div className="fx-card fx-card--lg fx-kpi-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <Kpi label="Son müştərilər" value={stats.total} meta="son fəaliyyətə görə" />
        <Kpi label="Yaxın seansı olan" value={stats.near} meta="qarşıdan gələn" color="var(--sage)" />
        <Kpi label="Diqqət tələb edən" value={stats.attention} meta="no-show nişanlı" color="var(--amber)" />
        <Kpi label="Paketli" value={stats.packaged} meta="aktiv paketli müştəri" />
      </div>

      {/* Siyahı kartı */}
      <div className="fx-card" style={{ overflow: "hidden", marginBottom: 28 }}>
        {/* Tablar */}
        <div className="fx-tabs" style={{ padding: "14px 20px 0" }}>
          {SEGMENTS.map(s => {
            const active = tab === s.key;
            return (
              <button key={s.key} type="button" onClick={() => setTab(s.key)} className={active ? "fx-tab fx-tab--active" : "fx-tab"}>
                {s.label}
                <span className={`fx-pill fx-pill--count${active ? " fx-pill--count-active" : ""} fx-num`}>{counts[s.key]}</span>
              </button>
            );
          })}
        </div>
        <hr className="fx-hairline" style={{ margin: 0 }} />

        {/* Alət zolağı */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div className="fx-search" style={{ flex: 1, minWidth: 240, maxWidth: 380 }}>
            <Icon name="search" />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} aria-label="Müştəri axtar" placeholder="Ad, telefon və ya email üzrə axtar" autoComplete="off" />
          </div>
          {psychOptions.length > 0 && (
            <select value={psych} onChange={e => setPsych(e.target.value)} aria-label="Psixoloq" className="fx-select fx-select--inline">
              <option value="all">Bütün psixoloqlar</option>
              {psychOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        {/* Sətirlər / hallar */}
        {isLoading ? (
          <SkeletonRows />
        ) : isEmpty ? (
          searching ? <NoResults query={term} /> : (
            <div className="fx-card--empty" style={{ border: "none", padding: "48px 20px" }}>
              <Icon name="users" className="fx-icon fx-icon--xl" style={{ color: "var(--brand-300)" }} />
              <div style={{ fontSize: 13, fontWeight: 700 }}>{tab === "all" ? "Hələ müştəri yoxdur" : "Bu seqmentdə müştəri yoxdur"}</div>
              <div style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>Yeni müştəri əlavə edin və ya axtarışdan istifadə edin</div>
              <button type="button" onClick={() => setNewOpen(true)} className="fx-btn fx-btn--primary fx-btn--sm" style={{ marginTop: 4 }}>Yeni müştəri</button>
            </div>
          )
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="fx-table">
              <thead>
                <tr>
                  <th onClick={() => setSort("name")} style={{ cursor: "pointer" }}>Müştəri {sort === "name" && "↑"}</th>
                  <th>Əlaqə</th>
                  <th onClick={() => setSort("activity")} style={{ cursor: "pointer" }}>Son fəaliyyət {sort === "activity" && "↓"}</th>
                  <th>Psixoloq</th>
                  <th>Paket</th>
                  <th>Bayraq</th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        )}

        {/* Alt sətir */}
        {!searching && recent !== null && filteredRecents.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px" }}>
            <span className="fx-muted fx-num" style={{ fontSize: 12 }}>{filteredRecents.length} müştəri göstərilir</span>
          </div>
        )}
      </div>

      {newOpen && <CreatePatientModal onClose={() => setNewOpen(false)} onCreated={id => { setNewOpen(false); router.push(`/operator/customers/${id}`); }} />}
    </div>
  );
}

// ─── Alt komponentlər ─────────────────────────────────────────────────────────
function Kpi({ label, value, meta, color }: { label: string; value: number; meta: string; color?: string }) {
  return (
    <div className="fx-kpi">
      <span className="fx-label">{label}</span>
      <span className="fx-kpi__value fx-num" style={color ? { color } : undefined}>{value}</span>
      <span className="fx-kpi__meta">{meta}</span>
    </div>
  );
}

function CustomerRow({ r, onOpen, onCall, onWa }: { r: RecentCustomer; onOpen: () => void; onCall: () => void; onWa: () => void }) {
  const tone = LAST_TONE[r.lastTone];
  return (
    <tr onClick={onOpen} style={{ cursor: "pointer" }}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`fx-avatar fx-avatar--${avatarVariant(r.id)}`} style={r.flag ? { boxShadow: "0 0 0 2px var(--surface), 0 0 0 3.5px rgba(201,125,125,.55)" } : undefined}>{initialsOf(r.name)}</span>
          <span className="fx-row__title">{r.name}</span>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {r.phone && <span className="fx-muted fx-num" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="phone" className="fx-icon fx-icon--sm" style={{ width: 11, height: 11 }} />{r.phone}</span>}
          {r.email && <span className="fx-muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="mail" className="fx-icon fx-icon--sm" style={{ width: 11, height: 11 }} />{r.email}</span>}
          {!r.phone && !r.email && <span className="fx-muted">—</span>}
        </div>
      </td>
      <td><span className="fx-pill fx-num" style={{ background: tone.bg, color: tone.fg }}>{r.lastLabel}</span></td>
      <td>{r.psych ? <span className="fx-pill fx-pill--neutral">{r.psych}</span> : <span className="fx-muted">—</span>}</td>
      <td>{r.pkg ? <span className="fx-pill" style={{ background: "var(--lilac-bg)", color: "#5F4FA0" }}>{r.pkg}</span> : <span className="fx-muted">—</span>}</td>
      <td>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {r.hasUpcoming && <span className="fx-pill" style={{ background: "var(--sage-bg)", color: "#2E6B54" }}>Yaxın seans</span>}
          {r.flag && <span className="fx-pill fx-pill--refunded">{r.flag}</span>}
          {!r.hasUpcoming && !r.flag && <span className="fx-muted">—</span>}
        </div>
      </td>
      <td onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          {r.phone && <button type="button" onClick={onCall} title="Zəng" className="fx-btn fx-btn--ghost fx-btn--sm"><Icon name="phone" className="fx-icon fx-icon--sm" /></button>}
          {r.phone && <button type="button" onClick={onWa} title="WhatsApp" className="fx-btn fx-btn--ghost fx-btn--sm"><Icon name="message" className="fx-icon fx-icon--sm" /></button>}
          <button type="button" onClick={onOpen} title="Profilə bax" className="fx-btn fx-btn--ghost fx-btn--sm"><Icon name="eye" className="fx-icon fx-icon--sm" /></button>
        </div>
      </td>
    </tr>
  );
}

function HitRow({ id, name, contact, onOpen }: { id: number; name: string; contact: string; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} style={{ cursor: "pointer" }}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`fx-avatar fx-avatar--${avatarVariant(id)}`}>{initialsOf(name)}</span>
          <span className="fx-row__title">{name}</span>
        </div>
      </td>
      <td colSpan={5} className="fx-muted" style={{ fontSize: 12.5 }}>{contact}</td>
      <td onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onOpen} className="fx-btn fx-btn--ghost fx-btn--sm"><Icon name="eye" className="fx-icon fx-icon--sm" />Profilə bax</button>
      </td>
    </tr>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="fx-card--empty" style={{ border: "none", padding: "48px 20px" }}>
      <Icon name="search" className="fx-icon fx-icon--xl" style={{ color: "var(--brand-300)" }} />
      <div style={{ fontSize: 13, fontWeight: 700 }}>«{query}» üçün nəticə yoxdur</div>
      <div style={{ fontSize: 11.5, color: "var(--oxford-60)" }}>Yazılışı yoxlayın və ya başqa açar sözlə cəhd edin</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="fx-row" style={{ borderTop: "none", borderBottom: "1px solid var(--hairline)", cursor: "default" }}>
          <div className="fx-skeleton fx-skeleton--circle" style={{ width: 38, height: 38 }} />
          <div style={{ flex: 1 }}>
            <div className="fx-skeleton" style={{ height: 12, width: "45%" }} />
            <div className="fx-skeleton" style={{ height: 9, width: "30%", marginTop: 8 }} />
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
    <div className="fx-overlay fx-overlay--center" onClick={onClose}>
      <div className="fx-modal" onClick={e => e.stopPropagation()}>
        <div className="fx-modal__icon fx-modal__icon--brand"><Icon name="user" className="fx-icon fx-icon--lg" /></div>
        <h3 className="fx-h3">Yeni müştəri</h3>
        <div className="fx-modal__text">Email mütləqdir — dəvət oraya göndərilir. Yaradıldıqdan sonra 360° profil açılır.</div>
        <div className="fx-field">
          <label className="fx-label">Email *</label>
          <input className="fx-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="ad.soyad@mail.az" type="email" autoComplete="off" autoFocus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="fx-field"><label className="fx-label">Ad</label><input className="fx-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ad" /></div>
          <div className="fx-field"><label className="fx-label">Soyad</label><input className="fx-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Soyad" /></div>
        </div>
        <div className="fx-field">
          <label className="fx-label">Telefon</label>
          <input className="fx-input fx-num" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994 __ ___ __ __" />
        </div>
        <div className="fx-modal__actions">
          <button type="button" onClick={onClose} className="fx-btn fx-btn--ghost">Ləğv</button>
          <button type="button" onClick={submit} disabled={!emailOk || busy} className="fx-btn fx-btn--primary">{busy ? "Yaradılır…" : "Yarat və aç"}</button>
        </div>
      </div>
    </div>
  );
}
