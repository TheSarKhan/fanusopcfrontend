"use client";

/**
 * Müraciətlər modulu — saytdan gələn anonim seans müraciətləri (Sayt BRD §8.2).
 * Hovuz (sahibsiz, hamı görür) → Götür → Mənim (yalnız mənə aid) → detal
 * səhifəsində Randevuya çevir / Paket sat. Çoxlu operator olanda qarışıqlıq
 * olmasın deyə görürünmə "Appointment pool"u ilə eyni sahiblik modelinə tabedir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type SessionRequest } from "@/lib/api";
import { toast as uiToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import PageHeader from "@/components/PageHeader";
import { azFormatDate } from "@/lib/datetime";
import { IconAlert, IconCheck, IconChevronRight, IconClock, IconInbox, IconMail, IconPhone, IconSearch } from "./icons";

type Tab = "POOL" | "MINE" | "CONVERTED" | "CANCELLED";

const TAB_META: Record<Tab, { label: string }> = {
  POOL: { label: "Hovuz" },
  MINE: { label: "Baxılır" },
  CONVERTED: { label: "Qəbul edilmiş" },
  CANCELLED: { label: "Ləğv edilmiş" },
};

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  NEW: { label: "Yeni", className: "fx-pill--pending" },
  IN_REVIEW: { label: "Baxılır", className: "fx-pill--info" },
  CONVERTED: { label: "Qəbul edildi", className: "fx-pill--paid" },
  CANCELLED: { label: "Ləğv edilib", className: "fx-pill--cancelled" },
};

const PAGE_SIZE = 30;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəq öncə`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat öncə`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün öncə`;
  return `${Math.round(d / 30)} ay öncə`;
}

function avatarVariant(id: number) { return (Math.abs(id) % 4) + 1; }
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function SessionRequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("POOL");
  const [items, setItems] = useState<SessionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZE);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchPage = useCallback((pageNum: number) => {
    if (tab === "POOL") return operatorApi.sessionRequestsPoolPaged({ page: pageNum, size });
    if (tab === "MINE") return operatorApi.sessionRequestsMinePaged({ status: "IN_REVIEW", page: pageNum, size });
    return operatorApi.sessionRequestsMinePaged({ status: tab, page: pageNum, size });
  }, [tab, size]);

  // Tab və ya səhifə ölçüsü dəyişəndə serverdən yenidən sorğu — səhifəni sıfırla.
  useEffect(() => { setPage(0); }, [tab, size]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(page)
      .then(res => {
        if (cancelled) return;
        setItems(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(res.totalPages);
      })
      .catch(e => { if (!cancelled) setError((e as Error).message || "Müraciətlər yüklənmədi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage, page, reloadNonce]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(x =>
      x.name.toLowerCase().includes(q) ||
      x.phone.includes(q) ||
      (x.email ?? "").toLowerCase().includes(q) ||
      x.reason.toLowerCase().includes(q));
  }, [items, search]);

  const take = (id: number) => {
    setBusyId(id);
    operatorApi.claimSessionRequest(id)
      .then(() => {
        setItems(prev => prev.filter(x => x.id !== id));
        setTotalElements(t => Math.max(0, t - 1));
        uiToast("Müraciət götürüldü", "success");
      })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  };

  return (
    <div>
      <PageHeader
        title="Sayt müraciətləri"
        subtitle="Saytdan gələn anonim seans müraciətləri. Hovuzdan götürün, uyğunlaşsanız randevuya çevirin və ya paket satın — müraciət sizə aid qalır, başqa operator görmür."
      />

      <div className="fx-card" style={{ overflow: "hidden", marginBottom: 20 }}>
        {/* Tablar */}
        <div className="fx-tabs" style={{ padding: "14px 20px 0" }}>
          {(Object.keys(TAB_META) as Tab[]).map(t => {
            const active = tab === t;
            return (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`fx-tab${active ? " fx-tab--active" : ""}`}>
                {TAB_META[t].label}
                {active && !loading && totalElements > 0 && (
                  <span className="fx-pill fx-pill--count-active">{totalElements}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="fx-hairline" />

        {/* Axtarış */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--hairline)" }}>
          <div className="fx-search" style={{ maxWidth: 360 }}>
            <IconSearch />
            <input
              type="text"
              aria-label="Müraciət axtar"
              placeholder="Ad, telefon, e-poçt və ya səbəb axtarın..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: "16px 20px" }}>
            <div className="fx-banner fx-banner--error">
              <IconAlert />
              <div style={{ flex: 1 }}>Müraciətlər yüklənərkən xəta baş verdi: {error}</div>
              <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" onClick={() => setReloadNonce(n => n + 1)}>
                Yenidən cəhd et
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="fx-row fx-row--static" style={{ justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <Skeleton width={160} height={14} />
                  <Skeleton width={220} height={12} style={{ marginTop: 9 }} />
                  <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
                </div>
                <Skeleton width={70} height={32} radius={8} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "12px 20px 28px" }}>
            <EmptyState
              icon={<IconInbox />}
              title={search.trim() ? "Axtarışa uyğun müraciət yoxdur" : tab === "POOL" ? "Hovuz boşdur" : "Bu kateqoriyada müraciət yoxdur"}
              sub={search.trim() ? "Başqa ad, telefon və ya açar söz yoxlayın." : tab === "POOL" ? "Saytdan yeni seans müraciəti gəldikdə burada görünəcək." : "Müraciət götürdükcə və ya çevirdikcə bu siyahı dolacaq."}
            />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="fx-table">
              <thead>
                <tr>
                  <th>Müraciət</th>
                  <th>Əlaqə</th>
                  <th>Səbəb</th>
                  <th>Üstünlük tarixi</th>
                  <th>Status</th>
                  <th>ID / Vaxt</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const badge = STATUS_PILL[req.status] ?? { label: req.status, className: "fx-pill--neutral" };
                  const busy = busyId === req.id;
                  return (
                    <tr key={req.id} onClick={() => router.push(`/operator/session-requests/${req.id}`)} style={{ cursor: "pointer" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className={`fx-avatar fx-avatar--${avatarVariant(req.id)}`}>{initialsOf(req.name)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span className="fx-row__title">{req.name}</span>
                              {req.priority && <span className="fx-pill fx-pill--pending">Prioritet</span>}
                            </div>
                            {tab === "POOL" && req.claimedByName && (
                              <span className="fx-muted" style={{ fontSize: 12 }}>{req.claimedByName} baxır</span>
                            )}
                            {req.assignedPsychologistName && (
                              <div className="fx-muted" style={{ fontSize: 12 }}>Psixoloq: {req.assignedPsychologistName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="fx-muted fx-num" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><IconPhone className="fx-icon fx-icon--sm" />{req.phone}</span>
                          {req.email && <span className="fx-muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><IconMail className="fx-icon fx-icon--sm" />{req.email}</span>}
                          {req.age && <span className="fx-muted" style={{ fontSize: 12.5 }}>{req.age} yaş</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: "var(--oxford-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }} title={req.reason}>
                          {req.reason}
                        </div>
                      </td>
                      <td>
                        {req.preferredDate ? (
                          <span className="fx-muted fx-num" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <IconClock className="fx-icon fx-icon--sm" />
                            {azFormatDate(req.preferredDate)}{req.preferredTime ? ` / ${req.preferredTime}` : ""}
                          </span>
                        ) : <span className="fx-muted">—</span>}
                      </td>
                      <td><span className={`fx-pill ${badge.className}`}>{badge.label}</span></td>
                      <td>
                        <div className="fx-muted fx-num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          #{req.id}<br />{timeAgo(req.createdAt)}
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {tab === "POOL" ? (
                          <button type="button" disabled={busy}
                            onClick={() => take(req.id)}
                            className="fx-btn fx-btn--sm"
                            style={{ background: "var(--sage)", borderColor: "var(--sage)", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                            <IconCheck className="fx-icon--sm" />
                            Götür
                          </button>
                        ) : (
                          <button type="button" onClick={() => router.push(`/operator/session-requests/${req.id}`)} className="fx-btn fx-btn--ghost fx-btn--sm">
                            <IconChevronRight className="fx-icon fx-icon--sm" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Səhifələmə */}
        {!loading && !search.trim() && totalElements > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid var(--hairline)", flexWrap: "wrap", gap: 10 }}>
            <span className="fx-muted fx-num" style={{ fontSize: 12 }}>
              Göstərilir: {page * size + 1}–{Math.min((page + 1) * size, totalElements)} / {totalElements}
            </span>

            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Əvvəlki
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i;
                  if (totalPages > 5 && page > 2) {
                    p = page - 2 + i;
                    if (p >= totalPages) p = totalPages - (5 - i);
                  }
                  if (p < 0 || p >= totalPages) return null;
                  return (
                    <button key={p} type="button"
                      className={`fx-btn fx-btn--sm${page === p ? " fx-btn--primary" : " fx-btn--ghost"}`}
                      onClick={() => setPage(p)}>
                      {p + 1}
                    </button>
                  );
                })}
                <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Sonrakı
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="fx-muted" style={{ fontSize: 12 }}>Səhifə başı:</span>
              <select value={size} onChange={e => setSize(Number(e.target.value))} aria-label="Səhifə ölçüsü" className="fx-select fx-select--inline">
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
