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
import { azFormatDate } from "@/lib/datetime";
import { IconAlert, IconCheck, IconChevronRight, IconClock, IconInbox, IconMail, IconPhone, IconSearch } from "./icons";

type Tab = "POOL" | "MINE" | "CONVERTED" | "CANCELLED";

const TAB_META: Record<Tab, { label: string }> = {
  POOL: { label: "Hovuz" },
  MINE: { label: "Mənim" },
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

export default function SessionRequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("POOL");
  const [items, setItems] = useState<SessionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchPage = useCallback((pageNum: number) => {
    if (tab === "POOL") return operatorApi.sessionRequestsPoolPaged({ page: pageNum, size: PAGE_SIZE });
    if (tab === "MINE") return operatorApi.sessionRequestsMinePaged({ status: "IN_REVIEW", page: pageNum, size: PAGE_SIZE });
    return operatorApi.sessionRequestsMinePaged({ status: tab, page: pageNum, size: PAGE_SIZE });
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(0)
      .then(res => {
        if (cancelled) return;
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(e => { if (!cancelled) setError((e as Error).message || "Müraciətlər yüklənmədi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage, reloadNonce]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchPage(page + 1)
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(e => setError((e as Error).message || "Müraciətlər yüklənmədi"))
      .finally(() => setLoadingMore(false));
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(x =>
      x.name.toLowerCase().includes(q) ||
      x.phone.includes(q) ||
      (x.email ?? "").toLowerCase().includes(q) ||
      x.reason.toLowerCase().includes(q));
  }, [items, search]);

  const hasMore = items.length < totalElements;

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
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="fx-h1">Müraciətlər</h1>
        <p className="fx-subtitle" style={{ margin: "6px 0 0", maxWidth: 640 }}>
          Saytdan gələn anonim seans müraciətləri. Hovuzdan götürün, uyğunlaşsanız randevuya
          çevirin və ya paket satın — müraciət sizə aid qalır, başqa operator görmür.
        </p>
      </div>

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
          <div>
            {filtered.map(req => {
              const badge = STATUS_PILL[req.status] ?? { label: req.status, className: "fx-pill--neutral" };
              const busy = busyId === req.id;
              return (
                <div key={req.id} className="fx-row" onClick={() => router.push(`/operator/session-requests/${req.id}`)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="fx-row__title">{req.name}</span>
                      <span className={`fx-pill ${badge.className}`}>{badge.label}</span>
                      {req.priority && <span className="fx-pill fx-pill--pending">Prioritet</span>}
                      {tab === "POOL" && req.claimedByName && (
                        <span className="fx-muted" style={{ fontSize: 12 }}>· {req.claimedByName} baxır</span>
                      )}
                    </div>
                    <div className="fx-row__meta" style={{ marginBottom: 4 }}>
                      <IconPhone className="fx-icon--sm" /><span>{req.phone}</span>
                      {req.email && (<><span className="fx-sep">·</span><IconMail className="fx-icon--sm" /><span>{req.email}</span></>)}
                      {req.age && (<><span className="fx-sep">·</span><span>{req.age} yaş</span></>)}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--oxford-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 620 }}>
                      {req.reason}
                    </div>
                    {req.preferredDate && (
                      <div className="fx-row__meta" style={{ marginTop: 4 }}>
                        <IconClock className="fx-icon--sm" />
                        <span>Üstünlük verilən: {azFormatDate(req.preferredDate)}{req.preferredTime ? ` saat ${req.preferredTime}` : ""}</span>
                      </div>
                    )}
                    {req.assignedPsychologistName && (
                      <div className="fx-row__meta" style={{ marginTop: 4 }}>
                        <span className="fx-muted">Psixoloq:</span>
                        <span style={{ color: "var(--oxford-80)" }}>{req.assignedPsychologistName}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div className="fx-muted fx-num" style={{ fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                      #{req.id}<br />{timeAgo(req.createdAt)}
                    </div>
                    {tab === "POOL" ? (
                      <button type="button" disabled={busy}
                        onClick={e => { e.stopPropagation(); take(req.id); }}
                        className="fx-btn fx-btn--sm"
                        style={{ background: "var(--sage)", borderColor: "var(--sage)", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                        <IconCheck className="fx-icon--sm" />
                        Götür
                      </button>
                    ) : (
                      <IconChevronRight className="fx-icon" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && hasMore && (
        <div style={{ textAlign: "center" }}>
          <button type="button" className="fx-btn fx-btn--ghost" onClick={loadMore} disabled={loadingMore} style={{ opacity: loadingMore ? 0.7 : 1 }}>
            Daha çox göstər (+{Math.min(PAGE_SIZE, totalElements - items.length)})
          </button>
        </div>
      )}
    </div>
  );
}
