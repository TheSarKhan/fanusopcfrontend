"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type ClientSummary, type PatientTag } from "@/lib/api";

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

export default function PsychologClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [tagsByPatient, setTagsByPatient] = useState<Record<number, PatientTag[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<SortKey>("LAST");

  useEffect(() => {
    Promise.all([
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
      psychologistApi.allMyPatientTags().catch(() => [] as PatientTag[]),
    ])
      .then(([cs, ts]) => {
        setClients(cs);
        const map: Record<number, PatientTag[]> = {};
        for (const t of ts) {
          if (!map[t.patientId]) map[t.patientId] = [];
          map[t.patientId].push(t);
        }
        setTagsByPatient(map);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Derived counters ───────────────────────────────────────────────
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

  // ── Filter + search + sort ─────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients.filter(c => {
      if (q && !(c.name + " " + (c.email ?? "") + " " + (c.phone ?? "")).toLowerCase().includes(q)) return false;
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
  }, [clients, search, filter, sort]);

  return (
    <div>
      <div className="psy-clients-head mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Müştərilər</h1>
          <p className="text-[#52718F] text-sm mt-1">Hər müştəriyə dair gizli qeydləri buradan idarə edin</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Ad / email / telefon"
          className="psy-clients-search"
          style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13 }} />
      </div>

      {/* Stat strip */}
      <div className="cli-stats">
        <StatCard label="Cəmi müştəri"   value={counters.all}                           tone="brand"
                  active={filter === "ALL"}     onClick={() => setFilter("ALL")} />
        <StatCard label={`Aktiv (${ACTIVE_DAYS} gün)`} value={counters.active}                 tone="good"
                  active={filter === "ACTIVE"}  onClick={() => setFilter("ACTIVE")} />
        <StatCard label={`Passiv (${DORMANT_DAYS}+)`}  value={counters.dormant}                tone="warn"
                  active={filter === "DORMANT"} onClick={() => setFilter("DORMANT")} />
        <StatCard label="İşarələnmiş"     value={counters.flagged}                       tone="danger"
                  active={filter === "FLAGGED"} onClick={() => setFilter("FLAGGED")} />
      </div>

      {/* Sort row */}
      <div className="cli-toolbar">
        <div className="cli-active-filter">
          {filter === "ALL"     && "Bütün müştərilər göstərilir"}
          {filter === "ACTIVE"  && `Son ${ACTIVE_DAYS} gündə görüş — ${counters.active}`}
          {filter === "DORMANT" && `${DORMANT_DAYS}+ gündə görüş yox — ${counters.dormant}`}
          {filter === "FLAGGED" && `Operatorun nəzər saldığı — ${counters.flagged}`}
          {filter !== "ALL" && (
            <button onClick={() => setFilter("ALL")} className="cli-clear">× təmizlə</button>
          )}
        </div>
        <div className="cli-sort">
          <label>Sıralama:</label>
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            <option value="LAST">Son seansa görə</option>
            <option value="TOTAL">Cəmi seansa görə</option>
            <option value="NAME">Əlifba</option>
            <option value="NOTES">Qeyd sayına görə</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {clients.length === 0 ? "Hələ müştəriniz yoxdur." : "Seçilmiş filtrlərə uyğun müştəri tapılmadı."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
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

function ClientCard({ c, tags }: { c: ClientSummary; tags: PatientTag[] }) {
  const days = daysSince(c.lastAppointmentAt);
  const lastPill = lastSessionPill(days);
  const flag = c.autoFlag ? FLAG_META[c.autoFlag] : null;
  const initials = c.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <Link href={`/psycholog/clients/${c.patientId}`} className="psy-client-card cli-card">
      <div className="cli-card-avatar">{initials}</div>
      <div className="cli-card-main">
        <div className="cli-card-name">
          {c.name}
          {flag && (
            <span className="cli-flag" data-tone={flag.tone}>⚠ {flag.label}</span>
          )}
        </div>
        <div className="cli-card-meta">
          {c.email}{c.phone ? ` · ${c.phone}` : ""}
        </div>
        {tags.length > 0 && (
          <div className="cli-card-tags">
            {tags.slice(0, 5).map(t => (
              <span key={t.id} className="cli-card-tag" data-color={t.color}>{t.label}</span>
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
            <span className="cli-pill cli-pill--neutral">📝 {c.noteCount} qeyd</span>
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
