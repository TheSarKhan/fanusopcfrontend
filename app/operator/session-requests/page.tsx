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

type Tab = "POOL" | "MINE" | "CONVERTED" | "CANCELLED";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  POOL:      { label: "Hovuz",         color: "#047857" },
  MINE:      { label: "Mənim",         color: "#1E40AF" },
  CONVERTED: { label: "Çevrilmiş",     color: "#065F46" },
  CANCELLED: { label: "Ləğv edilmiş",  color: "#991B1B" },
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  NEW:       { label: "Yeni",        bg: "#FEF3C7", color: "#92400E" },
  IN_REVIEW: { label: "Baxılır",     bg: "#DBEAFE", color: "#1E40AF" },
  CONVERTED: { label: "Çevrilib",    bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { label: "Ləğv edilib", bg: "#FEE2E2", color: "#991B1B" },
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
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0B1A35" }}>Müraciətlər</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#52718F" }}>
          Saytdan gələn anonim seans müraciətləri. Hovuzdan götürün, uyğunlaşsanız randevuya
          çevirin və ya paket satın — müraciət sizə aid qalır, başqa operator görmür.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #E5E7EB" }}>
        {(Object.keys(TAB_META) as Tab[]).map(t => {
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? TAB_META[t].color : "#6B7280",
                borderBottom: active ? `2px solid ${TAB_META[t].color}` : "2px solid transparent",
                marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
              }}>
              {TAB_META[t].label}
              {active && !loading && totalElements > 0 && (
                <span style={{
                  background: TAB_META[t].color, color: "#fff",
                  borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 600,
                }}>{totalElements}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Ad, telefon, e-poçt və ya səbəb axtarın..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 12px", border: "1px solid #D1D5DB",
            borderRadius: 8, fontSize: 13, color: "#111", outline: "none",
          }}
        />
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: "13px 16px", marginBottom: 16, fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>Müraciətlər yüklənərkən xəta baş verdi: {error}</span>
          <button type="button" onClick={() => setReloadNonce(n => n + 1)} style={{ background: "#fff", color: "#991B1B", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "none" }}>
            Yenidən cəhd et
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#6B7280", fontSize: 14 }}>Yüklənir...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#6B7280", fontSize: 14 }}>
          {tab === "POOL" ? "Hovuzda müraciət yoxdur." : "Bu kateqoriyada müraciət tapılmadı."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(req => {
            const badge = STATUS_BADGE[req.status] ?? { label: req.status, bg: "#F3F4F6", color: "#374151" };
            const busy = busyId === req.id;
            return (
              <div
                key={req.id}
                onClick={() => router.push(`/operator/session-requests/${req.id}`)}
                style={{
                  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10,
                  borderLeft: req.priority ? "3px solid #B45309" : "1px solid #E5E7EB",
                  padding: "16px 20px", cursor: "pointer",
                  display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px",
                  alignItems: "start", transition: "box-shadow 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0B1A35" }}>{req.name}</span>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
                    {req.priority && (
                      <span style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, border: "1px solid #FCD34D" }}>
                        Prioritet
                      </span>
                    )}
                    {tab === "POOL" && req.claimedByName && (
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>· {req.claimedByName} baxır</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                    <span style={{ marginRight: 12 }}>{req.phone}</span>
                    {req.email && <span style={{ color: "#52718F" }}>{req.email}</span>}
                    {req.age && <span style={{ marginLeft: 12, color: "#52718F" }}>{req.age} yaş</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 620 }}>
                    {req.reason}
                  </div>
                  {req.preferredDate && (
                    <div style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
                      Üstünlük verilən: {req.preferredDate}{req.preferredTime ? ` saat ${req.preferredTime}` : ""}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    #{req.id}<br />{timeAgo(req.createdAt)}
                  </div>
                  {tab === "POOL" && (
                    <button onClick={e => { e.stopPropagation(); take(req.id); }} disabled={busy}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "#047857", color: "#fff", border: "none", borderRadius: 8,
                        padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                        cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
                        boxShadow: "0 4px 12px rgba(4,120,87,.24)",
                      }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Götür
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" onClick={loadMore} disabled={loadingMore}
            style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
          </button>
        </div>
      )}
    </div>
  );
}
