"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type ClientSummary, type PatientTag } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;
const PAGE_SIZE = 30;

const FLAG_META: Record<string, { label: string; tone: string }> = {
  HIGH_NO_SHOW:     { label: "Yüksək no-show",      tone: "danger" },
  HIGH_LATE_CANCEL: { label: "Yüksək geç ləğv",      tone: "warn" },
  HIGH_REJECT:      { label: "Çox rədd alıb",        tone: "warn" },
  MANUAL:           { label: "Manual işarə",         tone: "warn" },
};

type Filter = "ALL" | "ACTIVE" | "DORMANT" | "FLAGGED";
type SortKey = "LAST" | "TOTAL" | "NAME" | "NOTES";
type ViewMode = "grid" | "list";

const AVATAR_PALETTE = [
  { bg: "#E0EBFA", fg: "#1E3A8A" },
  { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#CCFBF1", fg: "#115E59" },
  { bg: "#FEE2E2", fg: "#991B1B" },
  { bg: "#E0E7FF", fg: "#3730A3" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.abs(Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

function lastSessionPill(days: number | null): { text: string; tone: string } {
  if (days === null) return { text: "Heç seans yox", tone: "muted" };
  if (days === 0) return { text: "Bu gün", tone: "good" };
  if (days < 7) return { text: `${days} gün öncə`, tone: "good" };
  if (days <= ACTIVE_DAYS) return { text: `${days} gün öncə`, tone: "neutral" };
  if (days <= DORMANT_DAYS) return { text: `${days} gün öncə`, tone: "warn" };
  return { text: `Passiv: ${days} gün`, tone: "danger" };
}

const LAST_TONES: Record<string, { bg: string; color: string }> = {
  good:    { bg: "#ECFDF5", color: "#047857" },
  neutral: { bg: "#F3F4F6", color: "#374151" },
  warn:    { bg: "#FEF3C7", color: "#92400E" },
  danger:  { bg: "#FEE2E2", color: "#991B1B" },
  muted:   { bg: "#F3F4F6", color: "#9DB0CC" },
};
const tagChipStyle: React.CSSProperties = { background: "#F2F6FD", color: "#082F6D", border: "1px solid #E4ECFA", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 7 };
const tagChipStyleSm: React.CSSProperties = { background: "#F2F6FD", color: "#082F6D", border: "1px solid #E4ECFA", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6 };

function TagChip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`, background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)", borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
      {label}
      {count != null && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", background: active ? "rgba(255,255,255,.22)" : "#F2F6FD", color: active ? "#fff" : "#082F6D", fontSize: 10.5, fontWeight: 700, borderRadius: 999 }}>{count}</span>}
    </button>
  );
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportClientsCsv(clients: ClientSummary[], tagsByPatient: Record<number, PatientTag[]>) {
  const headers = [
    "Ad", "Email", "Telefon",
    "Cəmi seans", "Tamamlanmış seans", "No-show",
    "Son seans tarixi", "Son seans (gün öncə)",
    "Qeyd sayı", "Avto-flag", "Etiketlər",
  ];
  const rows = clients.map(c => {
    const days = daysSince(c.lastAppointmentAt);
    const tagLabels = (tagsByPatient[c.patientId] ?? []).map(t => t.label).join("; ");
    return [
      csvEscape(c.name),
      csvEscape(c.email ?? ""),
      csvEscape(c.phone ?? ""),
      csvEscape(c.totalSessions),
      csvEscape(c.completedSessions),
      csvEscape(c.noShowCount),
      csvEscape(c.lastAppointmentAt ?? ""),
      csvEscape(days ?? ""),
      csvEscape(c.noteCount),
      csvEscape(c.autoFlag ?? ""),
      csvEscape(tagLabels),
    ].join(",");
  });
  const csv = "﻿" + headers.join(",") + "\r\n" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `fanus-musteriler-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export default function PsychologClientsPage() {
  const { t } = useT();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [tagsByPatient, setTagsByPatient] = useState<Record<number, PatientTag[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<SortKey>("LAST");
  const [view, setView] = useState<ViewMode>("grid");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Etiketlər bir dəfə yüklənir — müştəri siyahısı isə server-side səhifələnir.
  useEffect(() => {
    psychologistApi.allMyPatientTags()
      .then(ts => {
        const map: Record<number, PatientTag[]> = {};
        for (const tg of ts) {
          if (!map[tg.patientId]) map[tg.patientId] = [];
          map[tg.patientId].push(tg);
        }
        setTagsByPatient(map);
      })
      .catch(() => {});
  }, []);

  // Axtarış yazılışını 300ms gecikdiririk ki, hər hərfə sorğu getməsin.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Axtarış dəyişəndə birinci səhifədən yenidən yüklə.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    psychologistApi.clientsPaged({ q: debouncedSearch || undefined, page: 0, size: PAGE_SIZE })
      .then(res => {
        if (cancelled) return;
        setClients(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(e => { if (!cancelled) setError((e as Error).message || "Müştərilər yüklənmədi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, reloadNonce]);

  const loadMore = () => {
    setLoadingMore(true);
    setError(null);
    psychologistApi.clientsPaged({ q: debouncedSearch || undefined, page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setClients(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(e => setError((e as Error).message || "Müştərilər yüklənmədi"))
      .finally(() => setLoadingMore(false));
  };

  // "/" focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "all" server cəmidir (totalElements); qalan sayğaclar yüklənmiş siyahıdan hesablanır.
  const counters = useMemo(() => {
    let active = 0, dormant = 0, flagged = 0;
    for (const c of clients) {
      const d = daysSince(c.lastAppointmentAt);
      if (d !== null && d <= ACTIVE_DAYS) active++;
      else if (d !== null && d > DORMANT_DAYS) dormant++;
      if (c.autoFlag) flagged++;
    }
    return { all: totalElements, active, dormant, flagged };
  }, [clients, totalElements]);

  const allTagLabels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const list of Object.values(tagsByPatient)) {
      for (const tg of list) counts.set(tg.label, (counts.get(tg.label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [tagsByPatient]);

  const attention = useMemo(() => {
    return clients
      .filter(c => !!c.autoFlag)
      .slice(0, 6);
  }, [clients]);

  const visible = useMemo(() => {
    // Ad/email axtarışı server tərəfdə (q) aparılır — burada yalnız yüklənmiş siyahı filtrlənir.
    let list = clients.filter(c => {
      if (tagFilter) {
        const labels = (tagsByPatient[c.patientId] ?? []).map(tg => tg.label);
        if (!labels.includes(tagFilter)) return false;
      }
      const d = daysSince(c.lastAppointmentAt);
      if (filter === "ACTIVE")   return d !== null && d <= ACTIVE_DAYS;
      if (filter === "DORMANT")  return d !== null && d > DORMANT_DAYS;
      if (filter === "FLAGGED")  return !!c.autoFlag;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "TOTAL": return b.totalSessions - a.totalSessions;
        case "NAME":  return a.name.localeCompare(b.name, "az");
        case "NOTES": return b.noteCount - a.noteCount;
        case "LAST":
        default: {
          const da = a.lastAppointmentAt ? new Date(a.lastAppointmentAt).getTime() : 0;
          const db = b.lastAppointmentAt ? new Date(b.lastAppointmentAt).getTime() : 0;
          return db - da;
        }
      }
    });
    return list;
  }, [clients, filter, sort, tagFilter, tagsByPatient]);

  const hasFilters = filter !== "ALL" || tagFilter !== null || search.trim().length > 0;
  const hasMore = clients.length < totalElements;
  // Yalnız server axtarışı aktivdirsə nəticə sayı server cəmidir; lokal filtrlə ekrandakı saydır.
  const resultCount = filter === "ALL" && !tagFilter ? totalElements : visible.length;

  return (
    <div>
      <style>{`
@keyframes clxShimmer{0%{background-position:-340px 0}100%{background-position:340px 0}}
.clx-skel{background:linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%);background-size:680px 100%;animation:clxShimmer 1.4s infinite linear}
.clx-chips::-webkit-scrollbar,.clx-att::-webkit-scrollbar{height:0}
.clx-clickrow{transition:box-shadow .15s,border-color .15s}
.clx-clickrow:hover{border-color:#C7DBF6 !important;box-shadow:0 4px 16px rgba(8,47,109,.08) !important}
.clx-listrow{transition:background .12s}
.clx-listrow:hover{background:#F8FAFD !important}
.clx-primary:hover{background:var(--brand-700) !important}
.clx-csv:hover{border-color:#1051B7 !important;color:#1051B7 !important}
.clx-link:hover{text-decoration:underline}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)" }}>{t("staff.psyClientsTitle")}</h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--oxford-60)", fontWeight: 500 }}>{t("staff.psyClientsSub")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", minWidth: 230 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder={t("common.search")}
              style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 10, padding: "10px 38px", fontSize: 14, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#F0F4FA", border: "1px solid #E1E9F5", borderRadius: 6, padding: "1px 7px", fontSize: 12, fontWeight: 700, color: "#9DB0CC" }}>/</span>
          </div>
          <div style={{ display: "inline-flex", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 10, padding: 3, gap: 3 }} role="tablist" aria-label="Görünüş">
            <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} title="Şəbəkə görünüşü"
              style={{ width: 34, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 7, cursor: "pointer", background: view === "grid" ? "var(--brand)" : "transparent", color: view === "grid" ? "#fff" : "var(--oxford-60)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
            <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} title="Siyahı görünüşü"
              style={{ width: 34, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 7, cursor: "pointer", background: view === "list" ? "var(--brand)" : "transparent", color: view === "list" ? "#fff" : "var(--oxford-60)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            </button>
          </div>
          <button type="button" onClick={() => exportClientsCsv(visible, tagsByPatient)} disabled={visible.length === 0}
            title="Filterlənmiş siyahını CSV faylı olaraq endir" className="clx-csv"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: visible.length === 0 ? "not-allowed" : "pointer", opacity: visible.length === 0 ? 0.5 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>CSV
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 13, marginBottom: 18 }}>
        <StatCard label={t("staff.psyClientsFilterAll")}   value={counters.all}     tone="brand"
                  active={filter === "ALL"}     onClick={() => setFilter("ALL")} />
        <StatCard label={`${t("staff.psyClientsFilterActive")} (${ACTIVE_DAYS}d)`} value={counters.active}    tone="good"
                  active={filter === "ACTIVE"}  onClick={() => setFilter("ACTIVE")} />
        <StatCard label={`${t("staff.psyClientsFilterDormant")} (${DORMANT_DAYS}+)`}  value={counters.dormant} tone="warn"
                  active={filter === "DORMANT"} onClick={() => setFilter("DORMANT")} />
        <StatCard label={t("staff.psyClientsFilterFlagged")} value={counters.flagged}                       tone="danger"
                  active={filter === "FLAGGED"} onClick={() => setFilter("FLAGGED")} />
      </div>

      {/* Tag chips */}
      {allTagLabels.length > 0 && (
        <div className="clx-chips" style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4, marginBottom: 20 }}>
          <TagChip active={tagFilter === null} label="Bütün etiketlər" onClick={() => setTagFilter(null)} />
          {allTagLabels.map(([label, count]) => (
            <TagChip key={label} active={tagFilter === label} label={label} count={count} onClick={() => setTagFilter(tagFilter === label ? null : label)} />
          ))}
        </div>
      )}

      {/* Needs attention */}
      {!loading && filter === "ALL" && !tagFilter && attention.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #FCE7A8", borderLeft: "3px solid #B45309", padding: 17, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>Diqqət tələb edənlər</span>
            </div>
            <button onClick={() => setFilter("FLAGGED")} className="clx-link"
              style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Hamısını gör ({counters.flagged})<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="clx-att" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 2 }}>
            {attention.map(c => {
              const days = daysSince(c.lastAppointmentAt);
              const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
              const av = avatarColor(c.name);
              return (
                <Link key={c.patientId} href={`/psycholog/clients/${c.patientId}`} className="clx-clickrow"
                  style={{ flex: "none", width: 248, textAlign: "left", display: "flex", alignItems: "center", gap: 11, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: 12, cursor: "pointer", textDecoration: "none" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: av.bg, color: av.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{initials(c.name)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{c.name}</div>
                    {flag && <span style={{ display: "inline-block", background: flag.tone === "danger" ? "#FEE2E2" : "#FEF3C7", color: flag.tone === "danger" ? "#991B1B" : "#92400E", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, margin: "3px 0 2px" }}>{flag.label}</span>}
                    <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{c.totalSessions} seans{days !== null && ` · son ${days} gün`}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          {!hasFilters && <span style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{totalElements} müştəri</span>}
          {filter === "ACTIVE"  && <FilterChip label={`Aktiv son ${ACTIVE_DAYS} gün`} onClear={() => setFilter("ALL")} />}
          {filter === "DORMANT" && <FilterChip label={`${DORMANT_DAYS}+ gün passiv`} onClear={() => setFilter("ALL")} />}
          {filter === "FLAGGED" && <FilterChip label="İşarələnmiş" onClear={() => setFilter("ALL")} />}
          {tagFilter && <FilterChip label={`#${tagFilter}`} onClear={() => setTagFilter(null)} />}
          {search.trim() && <FilterChip label={`"${search.trim()}"`} onClear={() => setSearch("")} />}
          {hasFilters && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)" }}>{resultCount} nəticə</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}>Sıralama:</span>
          <div style={{ position: "relative" }}>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              style={{ appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 36px 9px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="LAST">Son seans</option>
              <option value="TOTAL">Cəmi seans</option>
              <option value="NAME">Əlifba</option>
              <option value="NOTES">Qeyd sayı</option>
            </select>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: "13px 16px", marginBottom: 16, fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>Müştərilər yüklənərkən xəta baş verdi: {error}</span>
          <button type="button" onClick={() => setReloadNonce(n => n + 1)} style={{ background: "#fff", color: "#991B1B", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "none" }}>
            Yenidən cəhd et
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div className="clx-skel" style={{ width: 46, height: 46, borderRadius: 13, flex: "none" }} />
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div className="clx-skel" style={{ width: "65%", height: 14, borderRadius: 6, marginBottom: 8 }} />
                  <div className="clx-skel" style={{ width: "45%", height: 11, borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 15 }}>
                <div className="clx-skel" style={{ width: 70, height: 22, borderRadius: 7 }} />
                <div className="clx-skel" style={{ width: 56, height: 22, borderRadius: 7 }} />
              </div>
              <div className="clx-skel" style={{ width: "100%", height: 48, borderRadius: 8, marginBottom: 13 }} />
              <div className="clx-skel" style={{ width: "50%", height: 24, borderRadius: 999 }} />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasFilters={hasFilters} emptyText={t("staff.psyClientsEmpty")} onClear={() => { setFilter("ALL"); setTagFilter(null); setSearch(""); }} />
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          {visible.map(c => <ClientGridCard key={c.patientId} c={c} tags={tagsByPatient[c.patientId] ?? []} />)}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
          {visible.map(c => <ClientCard key={c.patientId} c={c} tags={tagsByPatient[c.patientId] ?? []} />)}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button type="button" onClick={loadMore} disabled={loadingMore}
            style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - clients.length)})`}
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, tone, active, onClick,
}: {
  label: string; value: number;
  tone: "brand" | "good" | "warn" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  const tones: Record<string, { border: string; bg: string; num: string; ring: string }> = {
    brand:  { border: "var(--brand)", bg: "#F2F6FD", num: "#082F6D", ring: "rgba(16,81,183,.18)" },
    good:   { border: "#047857",      bg: "#ECFDF5", num: "#047857", ring: "rgba(4,120,87,.18)" },
    warn:   { border: "#B45309",      bg: "#FFFBEB", num: "#92400E", ring: "rgba(180,83,9,.18)" },
    danger: { border: "#991B1B",      bg: "#FEF2F2", num: "#991B1B", ring: "rgba(153,27,27,.18)" },
  };
  const tn = tones[tone];
  return (
    <button type="button" onClick={onClick}
      style={{ textAlign: "left", background: active ? tn.bg : "#fff", border: `1.5px solid ${active ? tn.border : "#EDF1F8"}`, borderRadius: 13, padding: "15px 17px", cursor: "pointer", fontFamily: "inherit", boxShadow: active ? `0 0 0 3px ${tn.ring}` : "0 2px 12px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tn.num, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)", marginTop: 4 }}>{label}</div>
    </button>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#E4ECFA", color: "#082F6D", fontSize: 12.5, fontWeight: 600, padding: "5px 8px 5px 12px", borderRadius: 999 }}>
      {label}
      <button onClick={onClear} aria-label="Təmizlə" style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(8,47,109,.12)", border: "none", borderRadius: "50%", cursor: "pointer", color: "#082F6D" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </span>
  );
}

function EmptyState({ hasFilters, onClear, emptyText }: { hasFilters: boolean; onClear: () => void; emptyText: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "56px 24px", textAlign: "center" }}>
      <div style={{ width: 58, height: 58, borderRadius: 16, background: "#F2F6FD", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: "#9DB0CC" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)", marginBottom: 18 }}>
        {hasFilters ? "Bu filtrlərə uyğun müştəri tapılmadı" : emptyText}
      </div>
      {hasFilters && (
        <button onClick={onClear} className="clx-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>Filtrləri təmizlə
        </button>
      )}
    </div>
  );
}

function ClientCard({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const lastPill = lastSessionPill(days);
  const lt = LAST_TONES[lastPill.tone] ?? LAST_TONES.neutral;
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
  const av = avatarColor(c.name);
  const shown = tags.slice(0, 3);
  const more = tags.length - 3;

  return (
    <Link href={`/psycholog/clients/${c.patientId}`} className="clx-listrow"
      style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", borderTop: "1px solid #F0F4FA", padding: "14px 18px", cursor: "pointer", flexWrap: "wrap", textDecoration: "none" }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, background: av.bg, color: av.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initials(c.name)}</span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)" }}>{c.name}</span>
          {flag && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: flag.tone === "danger" ? "#FEE2E2" : "#FEF3C7", color: flag.tone === "danger" ? "#991B1B" : "#92400E", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>{flag.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 1 }}>{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
      </div>
      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "none", maxWidth: 230 }}>
          {shown.map(tg => <span key={tg.id} style={tagChipStyleSm}>{tg.label}</span>)}
          {more > 0 && <span style={{ ...tagChipStyleSm, background: "#fff", fontWeight: 700, color: "var(--oxford-60)" }}>+{more}</span>}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", flex: "none" }}>
        <span style={{ background: "#E4ECFA", color: "#082F6D", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{c.totalSessions} seans</span>
        {c.completedSessions > 0 && c.totalSessions > 0 && (
          <span style={{ background: "#ECFDF5", color: "#047857", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{c.completedSessions}/{c.totalSessions} tamamlanıb</span>
        )}
        {c.noteCount > 0 && (
          <span style={{ background: "#F3F4F6", color: "#374151", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{c.noteCount} qeyd</span>
        )}
        <span style={{ background: lt.bg, color: lt.color, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{lastPill.text}</span>
        {c.noShowCount > 0 && (
          <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{c.noShowCount} no-show</span>
        )}
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7D3E6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

function ClientGridCard({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const lastPill = lastSessionPill(days);
  const lt = LAST_TONES[lastPill.tone] ?? LAST_TONES.neutral;
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
  const av = avatarColor(c.name);
  const completionPct = c.totalSessions > 0
    ? Math.round((c.completedSessions / c.totalSessions) * 100)
    : 0;
  const shown = tags.slice(0, 4);
  const more = tags.length - 4;

  return (
    <Link href={`/psycholog/clients/${c.patientId}`} className="clx-clickrow"
      style={{ position: "relative", textAlign: "left", background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 18, cursor: "pointer", display: "flex", flexDirection: "column", textDecoration: "none" }}>
      {flag && (
        <span title={flag.label} style={{ position: "absolute", top: 15, right: 15, color: flag.tone === "danger" ? "#991B1B" : "#92400E" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingRight: 22 }}>
        <span style={{ width: 46, height: 46, borderRadius: 13, background: av.bg, color: av.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flex: "none" }}>{initials(c.name)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--oxford)" }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{c.email || c.phone || "—"}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 15, minHeight: 24 }}>
        {shown.map(tg => <span key={tg.id} style={tagChipStyle}>{tg.label}</span>)}
        {more > 0 && <span style={{ ...tagChipStyle, background: "#fff", fontWeight: 700, color: "var(--oxford-60)" }}>+{more}</span>}
      </div>

      <div style={{ display: "flex", borderTop: "1px solid #F0F4FA", borderBottom: "1px solid #F0F4FA", padding: "12px 0", marginBottom: 13 }}>
        <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #F0F4FA" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)" }}>{c.totalSessions}</div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>Seans</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #F0F4FA" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)" }}>{completionPct}%</div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>Tamamlanma</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--oxford)" }}>{c.noteCount}</div>
          <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>Qeyd</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: lt.bg, color: lt.color, fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{lastPill.text}
        </span>
        {c.noShowCount > 0 && (
          <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{c.noShowCount} no-show</span>
        )}
      </div>
    </Link>
  );
}
