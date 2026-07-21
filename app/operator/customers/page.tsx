"use client";

// Modul H — operator "Müştərilər" direktoriyası (Fanus UI Kit).
//  • Axtarış: operatorApi.search → pasiyent hitləri (ad / telefon / email).
//  • Default: randevulardan törədilən "Son müştərilər" — zəngin sətir
//    (Son fəaliyyət, paket, psixoloq, no-show nişanı), seqment tabları + sıralama.
//  • "Yeni müştəri": operatorApi.createPatient → yeni pasiyentin 360° profilinə keçid.
//  • Cədvəl <DataTable>-dır; sıralama və səhifələmə tam siyahı üzərində
//    aparılır (API sadə massiv qaytarır — client-side səhifələmə).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type OperatorSearchHit, type AppointmentDetail } from "@/lib/api";
import { azFormatDate } from "@/lib/datetime";
import { toast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import {
  Avatar,
  Button,
  DataTable,
  Status,
  type Column,
  type SortState,
  type StatusTone,
} from "@/components/ui";
import { Icon } from "./icons";

// ─── Köməkçilər ──────────────────────────────────────────────────────────────
function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || null;
}

function lastSession(ts: number, now: number): { label: string; tone: StatusTone } {
  if (!ts) return { label: "Heç seans yox", tone: "muted" };
  const days = Math.floor((now - ts) / 86_400_000);
  let label: string;
  if (days <= 0) label = "Bu gün";
  else if (days <= 7) label = `${days} gün öncə`;
  else label = azFormatDate(new Date(ts));
  const tone: StatusTone = days <= 3 ? "positive" : days <= 30 ? "neutral" : "wait";
  return { label, tone };
}

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  /** Yalnız axtarış nəticələrində — serverin hazır əlaqə sətri. */
  contact: string | null;
  lastAt: number;
  lastLabel: string;
  lastTone: StatusTone;
  pkg: string | null;
  psych: string | null;
  flag: string | null;
  hasUpcoming: boolean;
}

const DONE_STATUSES = new Set(["CANCELLED", "REJECTED", "COMPLETED"]);

/** Randevu siyahısından unikal müştəriləri zənginləşdirib son fəaliyyətə görə sıralayır. */
function deriveRecent(appts: AppointmentDetail[]): CustomerRow[] {
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

  const out: CustomerRow[] = [];
  for (const e of map.values()) {
    const name = e.name || e.email || `Pasiyent #${e.id}`;
    const ls = lastSession(e.lastAt, now);
    out.push({
      id: e.id, name, phone: e.phone || null, email: e.email || null, contact: null,
      lastAt: e.lastAt, lastLabel: ls.label, lastTone: ls.tone,
      pkg: e.pkg, psych: e.psych,
      flag: e.noShow >= 2 ? "No-show riski" : null,
      hasUpcoming: e.upcoming,
    });
  }
  out.sort((x, y) => y.lastAt - x.lastAt);
  return out;
}

type SegKey = "all" | "near" | "attention";
const SEGMENTS: { key: SegKey; label: string }[] = [
  { key: "all", label: "Hamısı" },
  { key: "near", label: "Yaxın seansı olan" },
  { key: "attention", label: "Diqqət tələb edən" },
];

/** Sıralama tam siyahı üzərində aparılır — səhifə kəsilməsi ondan sonra gəlir. */
const SORT_VALUES: Record<string, (r: CustomerRow) => string | number> = {
  name: r => r.name,
  last: r => r.lastAt,
};

// ─── Səhifə ──────────────────────────────────────────────────────────────────
export default function OperatorCustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OperatorSearchHit[] | null>(null);
  const [hitsError, setHitsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<CustomerRow[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [searchNonce, setSearchNonce] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [tab, setTab] = useState<SegKey>("all");
  const [sort, setSort] = useState<SortState>({ key: "last", dir: "desc" });
  const [psych, setPsych] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // Default — son aktiv pasiyentlərin randevularından "son müştərilər" siyahısı.
  useEffect(() => {
    let alive = true;
    setRecent(null);
    setRecentError(null);
    operatorApi.listRecentCustomerAppointments(30)
      .then(a => { if (alive) setRecent(deriveRecent(a)); })
      .catch(e => { if (alive) { setRecent([]); setRecentError((e as Error).message || "Müştəri siyahısı yüklənmədi."); } });
    return () => { alive = false; };
  }, [reloadNonce]);

  // Debounced axtarış (server) — 2+ simvol.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); setHitsError(null); setLoading(false); return; }
    setLoading(true);
    setHitsError(null);
    const id = window.setTimeout(() => {
      operatorApi.search(term, 12)
        .then(r => setHits(r.patients))
        .catch(e => { setHits([]); setHitsError((e as Error).message || "Axtarış nəticəsi yüklənmədi."); })
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(id);
  }, [q, searchNonce]);

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

  const hitRows = useMemo<CustomerRow[]>(() => (hits ?? []).map(h => ({
    id: h.id, name: h.title, phone: null, email: null, contact: h.subtitle || null,
    lastAt: 0, lastLabel: "", lastTone: "muted" as StatusTone,
    pkg: null, psych: null, flag: null, hasUpcoming: false,
  })), [hits]);

  const filteredRecents = useMemo(() => {
    let list = recents.filter(r =>
      tab === "all" ? true : tab === "near" ? r.hasUpcoming : !!r.flag);
    if (psych !== "all") list = list.filter(r => r.psych === psych);
    return list;
  }, [recents, tab, psych]);

  // Sıralama BÜTÜN siyahı üzərində — yalnız cari səhifə deyil.
  const sortedRecents = useMemo(() => {
    const get = SORT_VALUES[sort.key];
    if (!get) return filteredRecents;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filteredRecents].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "az") * factor;
    });
  }, [filteredRecents, sort]);

  const allRows = searching ? hitRows : sortedRecents;
  const pageCount = Math.max(1, Math.ceil(allRows.length / pageSize));
  const pageRows = useMemo(
    () => allRows.slice((page - 1) * pageSize, page * pageSize),
    [allRows, page, pageSize]);

  // Filtr/axtarış/sıralama dəyişəndə boş səhifədə qalmamaq üçün 1-ə qayıt.
  useEffect(() => { setPage(1); }, [q, tab, psych, sort, pageSize]);

  const goProfile = useCallback((id: number) => router.push(`/operator/customers/${id}`), [router]);
  const callPatient = (phone: string) => { const p = normalizePhone(phone); if (p) window.location.assign(`tel:${p}`); };
  const whatsapp = (phone: string) => { const p = normalizePhone(phone); if (p) window.open(`https://wa.me/${p.replace(/^\+/, "").replace(/[^\d]/g, "")}`, "_blank", "noopener"); };

  const nameColumn: Column<CustomerRow> = {
    key: "name",
    header: "Müştəri",
    sortable: !searching,
    cell: r => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={r.name} size="sm" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="fx-row__title">{r.name}</span>
          {r.flag && <Status tone="risk">{r.flag}</Status>}
        </div>
      </div>
    ),
  };

  const contactColumn: Column<CustomerRow> = {
    key: "contact",
    header: "Əlaqə",
    cell: r => {
      if (r.contact) return <span className="fx-subtitle">{r.contact}</span>;
      if (!r.phone && !r.email) return <span className="fx-muted">—</span>;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {r.phone && <span className="fx-subtitle fx-num">{r.phone}</span>}
          {r.email && <span className="fx-subtitle">{r.email}</span>}
        </div>
      );
    },
  };

  const recentColumns: Column<CustomerRow>[] = [
    nameColumn,
    contactColumn,
    {
      key: "last",
      header: "Son fəaliyyət",
      sortable: true,
      cell: r => <Status tone={r.lastTone}>{r.lastLabel}</Status>,
    },
    {
      key: "psych",
      header: "Psixoloq",
      hideOnMobile: true,
      cell: r => (r.psych ? <Status tone="neutral">{r.psych}</Status> : <span className="fx-muted">—</span>),
    },
  ];

  const hitColumns: Column<CustomerRow>[] = [nameColumn, contactColumn];

  const isSearchLoading = searching && loading;
  const isRecentLoading = !searching && recent === null;

  return (
    <div className="panel-page">
      {/* Başlıq */}
      <PageHeader
        title="Müştərilər"
        subtitle="Axtarış, seqment və sətir əməliyyatları üçün direktoriya"
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)} icon={<Icon name="plus" />}>
            Yeni müştəri
          </Button>
        }
      />

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

        {/* Cədvəl */}
        <div style={{ padding: "0 20px 16px" }}>
          <DataTable
            rows={pageRows}
            columns={searching ? hitColumns : recentColumns}
            rowKey={r => r.id}
            loading={isSearchLoading || isRecentLoading}
            error={searching ? hitsError : recentError}
            onRetry={searching ? () => setSearchNonce(n => n + 1) : () => setReloadNonce(n => n + 1)}
            onRowClick={r => goProfile(r.id)}
            sort={sort}
            onSortChange={next => setSort(next)}
            empty={searching ? {
              title: `«${term}» üçün nəticə yoxdur`,
              body: "Yazılışı yoxlayın və ya başqa açar sözlə cəhd edin.",
            } : {
              title: tab === "all" ? "Hələ müştəri yoxdur" : "Bu seqmentdə müştəri yoxdur",
              body: "Yeni müştəri əlavə edin və ya axtarışdan istifadə edin.",
              actions: <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>Yeni müştəri</Button>,
            }}
            actions={r => (
              <>
                {r.phone && (
                  <Button variant="ghost" size="sm" title="Zəng" aria-label="Zəng" onClick={() => callPatient(r.phone!)}>
                    <Icon name="phone" className="fx-icon fx-icon--sm" />
                  </Button>
                )}
                {r.phone && (
                  <Button variant="ghost" size="sm" title="WhatsApp" aria-label="WhatsApp" onClick={() => whatsapp(r.phone!)}>
                    <Icon name="message" className="fx-icon fx-icon--sm" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" title="Profilə bax" onClick={() => goProfile(r.id)}>
                  <Icon name="eye" className="fx-icon fx-icon--sm" />
                  Profilə bax
                </Button>
              </>
            )}
            pagination={{
              page,
              pageCount,
              onChange: setPage,
              pageSize,
              onPageSizeChange: setPageSize,
            }}
            totalLabel={searching
              ? `${allRows.length} nəticə tapıldı`
              : `${allRows.length} müştəri göstərilir`}
          />
        </div>
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
          <Button variant="ghost" onClick={onClose}>Ləğv</Button>
          <Button variant="primary" onClick={submit} disabled={!emailOk || busy}>{busy ? "Yaradılır…" : "Yarat və aç"}</Button>
        </div>
      </div>
    </div>
  );
}
