"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { psychologistApi, type ClientSummary, type PatientTag } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import {
  Avatar,
  Banner,
  Button,
  Card,
  CardBody,
  EmptyBlock,
  PageHead,
  Row,
  SearchInput,
  Segmented,
  Select,
  Stats,
  Status,
  Tabs,
  ToggleChip,
  type StatusTone,
  type TabItem,
} from "@/components/ui";

const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;
const PAGE_SIZE = 30;

/** Avto-işarələr. Rəng yalnız məna daşıyanda — rozet yoxdur, mətndir. */
const FLAG_META: Record<string, { label: string; tone: StatusTone }> = {
  HIGH_NO_SHOW:     { label: "Yüksək no-show",  tone: "risk" },
  HIGH_LATE_CANCEL: { label: "Yüksək geç ləğv", tone: "wait" },
  HIGH_REJECT:      { label: "Çox rədd alıb",   tone: "wait" },
  MANUAL:           { label: "Manual işarə",    tone: "wait" },
};

type Filter = "ALL" | "ACTIVE" | "DORMANT" | "FLAGGED";
type SortKey = "LAST" | "TOTAL" | "NAME" | "NOTES";
type ViewMode = "grid" | "list";

const VIEW_ITEMS = [
  { key: "grid" as const, label: "Şəbəkə" },
  { key: "list" as const, label: "Siyahı" },
];

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.abs(Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Son seans vəziyyəti — mətndir, rozet deyil.
 * Yalnız passivlik diqqət tələb edir; təzə seans neytral qalır.
 */
function lastSession(days: number | null): { text: string; tone: StatusTone } {
  if (days === null) return { text: "Heç seans olmayıb", tone: "muted" };
  if (days === 0) return { text: "Son seans bu gün", tone: "neutral" };
  if (days <= ACTIVE_DAYS) return { text: `Son seans ${days} gün öncə`, tone: "neutral" };
  if (days <= DORMANT_DAYS) return { text: `Son seans ${days} gün öncə`, tone: "wait" };
  return { text: `${days} gündür passivdir`, tone: "risk" };
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

const IconDownload = () => (
  <svg className="fx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </svg>
);

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
  const searchRef = useRef<HTMLDivElement | null>(null);

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
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
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

  // "/" axtarış sahəsinə fokuslanır.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          searchRef.current?.querySelector("input")?.focus();
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

  const attention = useMemo(() => clients.filter(c => !!c.autoFlag).slice(0, 6), [clients]);

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

  const filterTabs: TabItem<Filter>[] = [
    { key: "ALL",     label: t("staff.psyClientsFilterAll"), count: counters.all },
    { key: "ACTIVE",  label: `${t("staff.psyClientsFilterActive")} (${ACTIVE_DAYS} gün)`, count: counters.active },
    { key: "DORMANT", label: `${t("staff.psyClientsFilterDormant")} (${DORMANT_DAYS}+ gün)`, count: counters.dormant },
    { key: "FLAGGED", label: t("staff.psyClientsFilterFlagged"), count: counters.flagged },
  ];

  const clearFilters = () => { setFilter("ALL"); setTagFilter(null); setSearch(""); };

  return (
    <div>
      <PageHead
        title={t("staff.psyClientsTitle")}
        sub={t("staff.psyClientsSub")}
        actions={
          <>
            <Segmented items={VIEW_ITEMS} value={view} onChange={setView} />
            <Button
              variant="ghost"
              icon={<IconDownload />}
              onClick={() => exportClientsCsv(visible, tagsByPatient)}
              disabled={visible.length === 0}
              title="Filterlənmiş siyahını CSV faylı olaraq endir"
            >
              CSV
            </Button>
          </>
        }
      />

      <Tabs items={filterTabs} value={filter} onChange={setFilter} />

      <div className="fx-toolbar" style={{ marginTop: 16 }}>
        <div ref={searchRef} style={{ flex: 1, minWidth: 220 }}>
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`${t("common.search")} — "/" ilə keçin`}
          />
        </div>
        <label className="fx-help" htmlFor="clients-sort">Sıralama</label>
        <Select
          id="clients-sort"
          className="fx-select--inline"
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
        >
          <option value="LAST">Son seans</option>
          <option value="TOTAL">Cəmi seans</option>
          <option value="NAME">Əlifba</option>
          <option value="NOTES">Qeyd sayı</option>
        </Select>
      </div>

      {/* Etiket filtrləri */}
      {allTagLabels.length > 0 && (
        <div className="fx-toolbar" style={{ overflowX: "auto", paddingBottom: 4 }}>
          <ToggleChip active={tagFilter === null} onClick={() => setTagFilter(null)}>
            Bütün etiketlər
          </ToggleChip>
          {allTagLabels.map(([label, count]) => (
            <ToggleChip
              key={label}
              active={tagFilter === label}
              onClick={() => setTagFilter(tagFilter === label ? null : label)}
            >
              {label} {count}
            </ToggleChip>
          ))}
        </div>
      )}

      {hasFilters && (
        <p className="fx-help" style={{ marginBottom: 14 }}>
          {resultCount} nəticə göstərilir.{" "}
          <button type="button" className="fx-link" onClick={clearFilters}>
            Filtrləri təmizlə
          </button>
        </p>
      )}

      {/* Diqqət tələb edənlər */}
      {!loading && filter === "ALL" && !tagFilter && attention.length > 0 && (
        <Card tone="attention" style={{ marginBottom: 16 }}>
          <div className="fx-card__head fx-card__head--plain">
            <h2 className="fx-card-title">Diqqət tələb edənlər</h2>
            <button type="button" className="fx-link" onClick={() => setFilter("FLAGGED")}>
              Hamısını gör ({counters.flagged})
            </button>
          </div>
          <CardBody>
            {attention.map(c => {
              const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
              const days = daysSince(c.lastAppointmentAt);
              return (
                <Link
                  key={c.patientId}
                  href={`/psycholog/clients/${c.patientId}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <Row
                    lead={<Avatar name={c.name} size="sm" />}
                    title={c.name}
                    meta={`${c.totalSessions} seans${days !== null ? `, son seans ${days} gün öncə` : ""}`}
                    status={flag ? <Status tone={flag.tone}>{flag.label}</Status> : undefined}
                  />
                </Link>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Yükləmə xətası — səhifə yüklənmədiyi üçün toast deyil, yerində qutu + təkrar cəhd. */}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="error" title="Müştərilər yüklənmədi">
            {error}
            <div style={{ marginTop: 10 }}>
              <Button variant="ghost" size="sm" onClick={() => setReloadNonce(n => n + 1)}>
                Yenidən cəhd et
              </Button>
            </div>
          </Banner>
        </div>
      )}

      {loading ? (
        <ClientsSkeleton />
      ) : visible.length === 0 ? (
        <EmptyBlock
          boxed
          title={hasFilters ? "Bu filtrlərə uyğun müştəri tapılmadı" : t("staff.psyClientsEmpty")}
          body={
            hasFilters
              ? "Axtarış sözünü qısaldın və ya seçilmiş filtrləri götürün."
              : "İlk seansınız keçiriləndən sonra müştəriləriniz burada siyahılanacaq."
          }
          actions={hasFilters ? <Button variant="ghost" onClick={clearFilters}>Filtrləri təmizlə</Button> : undefined}
        />
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 12 }}>
          {visible.map(c => <ClientGridCard key={c.patientId} c={c} tags={tagsByPatient[c.patientId] ?? []} />)}
        </div>
      ) : (
        <Card>
          <CardBody style={{ paddingTop: 4 }}>
            {visible.map(c => <ClientListRow key={c.patientId} c={c} tags={tagsByPatient[c.patientId] ?? []} />)}
          </CardBody>
        </Card>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Button variant="ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore
              ? "Yüklənir…"
              : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - clients.length)})`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Etiketlər — silinə bilməyən, sadəcə oxunan siyahı. */
function TagLine({ tags, max }: { tags: PatientTag[]; max: number }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max).map(tg => tg.label).join(", ");
  const more = tags.length - max;
  return (
    <span>
      Etiketlər: {shown}
      {more > 0 ? ` və daha ${more}` : ""}
    </span>
  );
}

function ClientListRow({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const last = lastSession(days);
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;

  return (
    <Link
      href={`/psycholog/clients/${c.patientId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Row
        lead={<Avatar name={c.name} />}
        title={c.name}
        meta={
          // Rozet çipləri yerinə oxunan sətirlər.
          <>
            <div>{c.email || c.phone || "Əlaqə məlumatı yoxdur"}</div>
            <div>
              {c.totalSessions} seans, {c.completedSessions} tamamlanıb
              {c.noteCount > 0 ? `, ${c.noteCount} qeyd` : ""}
              {c.noShowCount > 0 ? `, ${c.noShowCount} no-show` : ""}
            </div>
            <TagLine tags={tags} max={3} />
          </>
        }
        status={
          flag ? <Status tone={flag.tone}>{flag.label}</Status> : <Status tone={last.tone}>{last.text}</Status>
        }
      />
    </Link>
  );
}

function ClientGridCard({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const last = lastSession(days);
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
  const completionPct = c.totalSessions > 0
    ? Math.round((c.completedSessions / c.totalSessions) * 100)
    : 0;

  return (
    <Link
      href={`/psycholog/clients/${c.patientId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <Card fill tone={flag ? "attention" : "default"}>
        <CardBody style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Avatar name={c.name} size="lg" />
            <div style={{ minWidth: 0 }}>
              <div className="fx-row__title">{c.name}</div>
              <div className="fx-row__meta">{c.email || c.phone || "Əlaqə məlumatı yoxdur"}</div>
            </div>
          </div>

          <div className="fx-hairline" />

          {/* Rəqəmlər — çip deyil, "dəyər + etiket". */}
          <div style={{ display: "flex", gap: 18 }}>
            <MiniStat value={c.totalSessions} label="Seans" />
            <MiniStat value={`${completionPct}%`} label="Tamamlanma" />
            <MiniStat value={c.noteCount} label="Qeyd" />
          </div>

          <div className="fx-row__meta" style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            <TagLine tags={tags} max={4} />
            {c.noShowCount > 0 ? <span>{c.noShowCount} no-show</span> : null}
            {flag ? (
              <Status tone={flag.tone}>{flag.label}</Status>
            ) : (
              <Status tone={last.tone}>{last.text}</Status>
            )}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function MiniStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="fx-num" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em", color: "var(--oxford)" }}>
        {value}
      </div>
      <div className="fx-row__meta" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}

/** Yüklənmə — real şəbəkənin eyni forması, "Yüklənir…" mətni yoxdur. */
function ClientsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardBody style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="fx-skeleton fx-skeleton--circle" style={{ width: 42, height: 42, flex: "none" }} />
              <div style={{ flex: 1 }}>
                <div className="fx-skeleton" style={{ width: "65%", height: 13, marginBottom: 7 }} />
                <div className="fx-skeleton" style={{ width: "45%", height: 11 }} />
              </div>
            </div>
            <div className="fx-hairline" />
            <div style={{ display: "flex", gap: 18 }}>
              <div className="fx-skeleton" style={{ width: 48, height: 32 }} />
              <div className="fx-skeleton" style={{ width: 48, height: 32 }} />
              <div className="fx-skeleton" style={{ width: 48, height: 32 }} />
            </div>
            <div className="fx-skeleton" style={{ width: "60%", height: 12 }} />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
