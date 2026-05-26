"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type ClientSummary, type PatientTag } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;

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
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function lastSessionPill(days: number | null): { text: string; tone: string } {
  if (days === null) return { text: "Heç seans yox", tone: "muted" };
  if (days === 0) return { text: "Bu gün", tone: "good" };
  if (days < 7) return { text: `${days} gün öncə`, tone: "good" };
  if (days <= ACTIVE_DAYS) return { text: `${days} gün öncə`, tone: "neutral" };
  if (days <= DORMANT_DAYS) return { text: `${days} gün öncə`, tone: "warn" };
  return { text: `Passiv: ${days} gün`, tone: "danger" };
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
  const [tagsByPatient, setTagsByPatient] = useState<Record<number, PatientTag[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<SortKey>("LAST");
  const [view, setView] = useState<ViewMode>("grid");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    Promise.all([
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
      psychologistApi.allMyPatientTags().catch(() => [] as PatientTag[]),
    ])
      .then(([cs, ts]) => {
        setClients(cs);
        const map: Record<number, PatientTag[]> = {};
        for (const tg of ts) {
          if (!map[tg.patientId]) map[tg.patientId] = [];
          map[tg.patientId].push(tg);
        }
        setTagsByPatient(map);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const counters = useMemo(() => {
    let active = 0, dormant = 0, flagged = 0;
    for (const c of clients) {
      const d = daysSince(c.lastAppointmentAt);
      if (d !== null && d <= ACTIVE_DAYS) active++;
      else if (d !== null && d > DORMANT_DAYS) dormant++;
      if (c.autoFlag) flagged++;
    }
    return { all: clients.length, active, dormant, flagged };
  }, [clients]);

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
    const q = search.trim().toLowerCase();
    let list = clients.filter(c => {
      if (q && !(c.name + " " + (c.email ?? "") + " " + (c.phone ?? "")).toLowerCase().includes(q)) return false;
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
  }, [clients, search, filter, sort, tagFilter, tagsByPatient]);

  const hasFilters = filter !== "ALL" || tagFilter !== null || search.trim().length > 0;

  return (
    <div className="cli-page">
      {/* Header */}
      <div className="cli-head">
        <div className="cli-head-titles">
          <h1>{t("staff.psyClientsTitle")}</h1>
          <p>{t("staff.psyClientsSub")}</p>
        </div>
        <div className="cli-head-actions">
          <div className="cli-search-wrap">
            <svg className="cli-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="cli-search-input"
            />
            <span className="cli-search-kbd">/</span>
          </div>
          <div className="cli-view-toggle" role="tablist" aria-label="Görünüş">
            <button
              type="button"
              className={`cli-view-btn${view === "grid" ? " is-active" : ""}`}
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              title="Şəbəkə görünüşü"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              type="button"
              className={`cli-view-btn${view === "list" ? " is-active" : ""}`}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              title="Siyahı görünüşü"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportClientsCsv(visible, tagsByPatient)}
            disabled={visible.length === 0}
            title="Filterlənmiş siyahını CSV faylı olaraq endir"
            className="cli-csv-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="cli-stats">
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
        <div className="cli-tag-strip">
          <button
            className={`cli-tag-chip${tagFilter === null ? " is-active" : ""}`}
            onClick={() => setTagFilter(null)}
          >
            Bütün etiketlər
          </button>
          {allTagLabels.map(([label, count]) => (
            <button
              key={label}
              className={`cli-tag-chip${tagFilter === label ? " is-active" : ""}`}
              onClick={() => setTagFilter(tagFilter === label ? null : label)}
            >
              {label}
              <span className="cli-tag-chip-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Needs attention */}
      {!loading && filter === "ALL" && !tagFilter && attention.length > 0 && (
        <div className="cli-attention">
          <div className="cli-attention-head">
            <div className="cli-attention-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Diqqət tələb edənlər
            </div>
            <button className="cli-attention-link" onClick={() => setFilter("FLAGGED")}>
              Hamısını gör ({counters.flagged}) ›
            </button>
          </div>
          <div className="cli-attention-row">
            {attention.map(c => {
              const days = daysSince(c.lastAppointmentAt);
              const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
              const av = avatarColor(c.name);
              return (
                <Link key={c.patientId} href={`/psycholog/clients/${c.patientId}`} className="cli-attention-card">
                  <div className="cli-attention-avatar" style={{ background: av.bg, color: av.fg }}>{initials(c.name)}</div>
                  <div className="cli-attention-body">
                    <div className="cli-attention-name">{c.name}</div>
                    {flag && <div className="cli-attention-flag" data-tone={flag.tone}>{flag.label}</div>}
                    <div className="cli-attention-meta">
                      {c.totalSessions} seans
                      {days !== null && ` · son ${days} gün`}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Sort row */}
      <div className="cli-toolbar">
        <div className="cli-active-filter">
          {!hasFilters && <span style={{ color: "var(--oxford-60)" }}>{visible.length} müştəri</span>}
          {filter === "ACTIVE"  && <FilterChip label={`Aktiv son ${ACTIVE_DAYS} gün`} onClear={() => setFilter("ALL")} />}
          {filter === "DORMANT" && <FilterChip label={`${DORMANT_DAYS}+ gün passiv`} onClear={() => setFilter("ALL")} />}
          {filter === "FLAGGED" && <FilterChip label="İşarələnmiş" onClear={() => setFilter("ALL")} />}
          {tagFilter && <FilterChip label={`#${tagFilter}`} onClear={() => setTagFilter(null)} />}
          {search.trim() && <FilterChip label={`"${search.trim()}"`} onClear={() => setSearch("")} />}
          {hasFilters && (
            <span className="cli-result-count">{visible.length} nəticə</span>
          )}
        </div>
        <div className="cli-sort">
          <label>Sıralama</label>
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            <option value="LAST">Son seans</option>
            <option value="TOTAL">Cəmi seans</option>
            <option value="NAME">Əlifba</option>
            <option value="NOTES">Qeyd sayı</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="cli-skeleton">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cli-skel-card" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasFilters={hasFilters} emptyText={t("staff.psyClientsEmpty")} onClear={() => { setFilter("ALL"); setTagFilter(null); setSearch(""); }} />
      ) : view === "grid" ? (
        <div className="cli-grid">
          {visible.map(c => <ClientGridCard key={c.patientId} c={c} tags={tagsByPatient[c.patientId] ?? []} />)}
        </div>
      ) : (
        <div className="cli-list">
          {visible.map(c => <ClientCard key={c.patientId} c={c} tags={tagsByPatient[c.patientId] ?? []} />)}
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
  return (
    <button type="button" onClick={onClick} className={`cli-stat${active ? " is-active" : ""}`} data-tone={tone}>
      <span className="cli-stat-label">{label}</span>
      <span className="cli-stat-value" data-tone={tone}>{value}</span>
    </button>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="cli-filter-chip">
      {label}
      <button onClick={onClear} aria-label="Təmizlə" className="cli-filter-chip-x">×</button>
    </span>
  );
}

function EmptyState({ hasFilters, onClear, emptyText }: { hasFilters: boolean; onClear: () => void; emptyText: string }) {
  return (
    <div className="cli-empty">
      <div className="cli-empty-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <div className="cli-empty-title">
        {hasFilters ? "Bu filtrlərə uyğun müştəri tapılmadı" : emptyText}
      </div>
      {hasFilters && (
        <button className="cli-empty-clear" onClick={onClear}>Filtrləri təmizlə</button>
      )}
    </div>
  );
}

function ClientCard({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const lastPill = lastSessionPill(days);
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
  const av = avatarColor(c.name);

  return (
    <Link href={`/psycholog/clients/${c.patientId}`} className="psy-client-card cli-card">
      <div className="cli-card-avatar" style={{ background: av.bg, color: av.fg, borderColor: "transparent" }}>{initials(c.name)}</div>
      <div className="cli-card-main">
        <div className="cli-card-name">
          {c.name}
          {flag && (
            <span className="cli-flag" data-tone={flag.tone}>{flag.label}</span>
          )}
        </div>
        <div className="cli-card-meta">
          {c.email}{c.phone ? ` · ${c.phone}` : ""}
        </div>
        {tags.length > 0 && (
          <div className="cli-card-tags">
            {tags.slice(0, 5).map(tg => (
              <span key={tg.id} className="cli-card-tag" data-color={tg.color}>{tg.label}</span>
            ))}
            {tags.length > 5 && (
              <span className="cli-card-tag" data-color="neutral">+{tags.length - 5}</span>
            )}
          </div>
        )}
        <div className="cli-card-pills">
          <span className="cli-pill cli-pill--brand">{c.totalSessions} seans</span>
          {c.completedSessions > 0 && c.totalSessions > 0 && (
            <span className="cli-pill cli-pill--good">
              {c.completedSessions}/{c.totalSessions} tamamlanıb
            </span>
          )}
          {c.noteCount > 0 && (
            <span className="cli-pill cli-pill--neutral">{c.noteCount} qeyd</span>
          )}
          <span className="cli-pill cli-pill--time" data-tone={lastPill.tone}>{lastPill.text}</span>
          {c.noShowCount > 0 && (
            <span className="cli-pill cli-pill--warn">{c.noShowCount} no-show</span>
          )}
        </div>
      </div>
      <div className="cli-card-arrow">›</div>
    </Link>
  );
}

function ClientGridCard({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const lastPill = lastSessionPill(days);
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
  const av = avatarColor(c.name);
  const completionPct = c.totalSessions > 0
    ? Math.round((c.completedSessions / c.totalSessions) * 100)
    : 0;

  return (
    <Link href={`/psycholog/clients/${c.patientId}`} className="cli-gcard">
      <div className="cli-gcard-top">
        <div className="cli-gcard-avatar" style={{ background: av.bg, color: av.fg }}>{initials(c.name)}</div>
        <div className="cli-gcard-id">
          <div className="cli-gcard-name">{c.name}</div>
          <div className="cli-gcard-meta">{c.email || c.phone || "—"}</div>
        </div>
        {flag && (
          <span className="cli-gcard-flag" data-tone={flag.tone} title={flag.label}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="cli-gcard-tags">
          {tags.slice(0, 4).map(tg => (
            <span key={tg.id} className="cli-card-tag" data-color={tg.color}>{tg.label}</span>
          ))}
          {tags.length > 4 && (
            <span className="cli-card-tag" data-color="neutral">+{tags.length - 4}</span>
          )}
        </div>
      )}

      <div className="cli-gcard-stats">
        <div className="cli-gcard-stat">
          <div className="cli-gcard-stat-value">{c.totalSessions}</div>
          <div className="cli-gcard-stat-label">Seans</div>
        </div>
        <div className="cli-gcard-stat">
          <div className="cli-gcard-stat-value">{completionPct}%</div>
          <div className="cli-gcard-stat-label">Tamamlanma</div>
        </div>
        <div className="cli-gcard-stat">
          <div className="cli-gcard-stat-value">{c.noteCount}</div>
          <div className="cli-gcard-stat-label">Qeyd</div>
        </div>
      </div>

      <div className="cli-gcard-foot">
        <span className="cli-pill cli-pill--time" data-tone={lastPill.tone}>{lastPill.text}</span>
        {c.noShowCount > 0 && (
          <span className="cli-pill cli-pill--warn">{c.noShowCount} no-show</span>
        )}
      </div>
    </Link>
  );
}
