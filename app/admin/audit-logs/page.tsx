"use client";

import { useEffect, useState } from "react";
import { adminApi, type AuditLogEntry, type PagedAuditLogs } from "@/lib/api";

const ACTION_PRESETS: { value: string; label: string }[] = [
  { value: "",                    label: "Bütün əməliyyatlar" },
  { value: "USER_BLOCK",          label: "İstifadəçi blokladı" },
  { value: "USER_UNBLOCK",        label: "Blok ləğvi" },
  { value: "USER_DELETE",         label: "İstifadəçi silindi" },
  { value: "USER_ROLE_CHANGE",    label: "Rol dəyişdirildi" },
  { value: "USER_ACTIVATE",       label: "Aktivləşdirmə" },
  { value: "USER_DEACTIVATE",     label: "Deaktivasiya" },
  { value: "APPT_FORCE_CANCEL",   label: "Randevu məcburi ləğvi" },
  { value: "APPT_DISPUTE_RESOLVE", label: "Mübahisə həlli" },
];

const ACTION_TONE: Record<string, string> = {
  USER_BLOCK:           "danger",
  USER_DELETE:          "danger",
  APPT_FORCE_CANCEL:    "danger",
  APPT_DISPUTE_RESOLVE: "warn",
  USER_ROLE_CHANGE:     "warn",
  USER_DEACTIVATE:      "warn",
  USER_UNBLOCK:         "good",
  USER_ACTIVATE:        "good",
};

const PAGE_SIZE = 30;

function fmtDt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "indi";
  if (m < 60)  return `${m} dəq öncə`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} saat öncə`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d} gün öncə`;
  return fmtDt(iso);
}

export default function AdminAuditLogsPage() {
  const [data, setData] = useState<PagedAuditLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    adminApi.getAuditLogs({
      action: action || undefined,
      page, size: PAGE_SIZE,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [action, page]);

  const visible: AuditLogEntry[] = (() => {
    const list = data?.content ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(e =>
      (e.actorEmail ?? "").toLowerCase().includes(q) ||
      (e.summary ?? "").toLowerCase().includes(q) ||
      (e.ip ?? "").toLowerCase().includes(q) ||
      String(e.targetId ?? "").includes(q)
    );
  })();

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="audit-page">
      <div className="audit-head">
        <div>
          <h1 className="audit-title">Audit log</h1>
          <p className="audit-sub">Həssas əməliyyatların izi: kim, nə vaxt, nə etdi.</p>
        </div>
      </div>

      <div className="audit-toolbar">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(0); }} className="audit-select">
          {ACTION_PRESETS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Email / IP / target ID üzrə süzgəc"
          className="audit-search"
        />
        <span className="audit-count">
          {data ? `${data.totalElements} qeyd` : "—"}
        </span>
      </div>

      {loading ? (
        <div className="audit-empty">Yüklənir…</div>
      ) : visible.length === 0 ? (
        <div className="audit-empty">
          {data && data.totalElements === 0 ? "Hələ audit qeydi yoxdur." : "Filtrə uyğun nəticə yoxdur."}
        </div>
      ) : (
        <div className="audit-list">
          {visible.map(e => (
            <div key={e.id} className="audit-row">
              <div className="audit-row-when" title={fmtDt(e.createdAt)}>
                <strong>{timeAgo(e.createdAt)}</strong>
                <span>{fmtDt(e.createdAt)}</span>
              </div>
              <div className="audit-row-main">
                <div className="audit-row-line">
                  <span className="audit-action" data-tone={ACTION_TONE[e.action] ?? "neutral"}>
                    {e.action}
                  </span>
                  {e.targetType && (
                    <span className="audit-target">
                      {e.targetType}{e.targetId !== null ? ` #${e.targetId}` : ""}
                    </span>
                  )}
                </div>
                {e.summary && <div className="audit-summary">{e.summary}</div>}
                <div className="audit-meta">
                  <span>
                    <strong>Aktor:</strong>{" "}
                    {e.actorEmail ?? "—"}
                  </span>
                  {/* Rol ayrıca span — audit-meta onsuz da flex gap-lidir */}
                  {e.actorRole && <span>{e.actorRole}</span>}
                  {e.ip && <span><strong>IP:</strong> {e.ip}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="audit-pager">
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
            className="audit-page-btn">← Geri</button>
          <span className="audit-page-info">{page + 1} / {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
            className="audit-page-btn">İrəli →</button>
        </div>
      )}
    </div>
  );
}
