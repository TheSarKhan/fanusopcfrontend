"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type SessionRequest } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

type Tab = "ALL" | "NEW" | "IN_REVIEW" | "SCHEDULED" | "CANCELLED";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  ALL:       { label: "Hamısı",         color: "#374151" },
  NEW:       { label: "Yeni",           color: "#92400E" },
  IN_REVIEW: { label: "Baxılır",        color: "#1E40AF" },
  SCHEDULED: { label: "Planlandı",      color: "#065F46" },
  CANCELLED: { label: "Ləğv edildi",    color: "#991B1B" },
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  NEW:       { label: "Yeni",        bg: "#FEF3C7", color: "#92400E" },
  IN_REVIEW: { label: "Baxılır",     bg: "#DBEAFE", color: "#1E40AF" },
  SCHEDULED: { label: "Planlandı",   bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { label: "Ləğv edildi", bg: "#FEE2E2", color: "#991B1B" },
};

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
  const [tab, setTab] = useState<Tab>("ALL");
  const [items, setItems] = useState<SessionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    operatorApi.listSessionRequests().then(data => {
      setItems(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh on new session request notification
  useEffect(() => {
    const off = subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type === "SESSION_REQUEST_NEW") load();
    });
    return off;
  }, [load]);

  const filtered = useMemo(() => {
    let list = tab === "ALL" ? items : items.filter(x => x.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(x =>
        x.name.toLowerCase().includes(q) ||
        x.phone.includes(q) ||
        (x.email ?? "").toLowerCase().includes(q) ||
        x.reason.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, tab, search]);

  const countFor = (t: Tab) => t === "ALL" ? items.length : items.filter(x => x.status === t).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0B1A35" }}>Seans müraciətləri</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#52718F" }}>
          Saytdan gələn anonim seans müraciətləri. Psixoloq, tarix və paket təyin edib müştəriyə bildiriş göndərin.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #E5E7EB", paddingBottom: 0 }}>
        {(Object.keys(TAB_META) as Tab[]).map(t => {
          const active = tab === t;
          const count = countFor(t);
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? TAB_META[t].color : "#6B7280",
                borderBottom: active ? `2px solid ${TAB_META[t].color}` : "2px solid transparent",
                marginBottom: -1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {TAB_META[t].label}
              {count > 0 && (
                <span style={{
                  background: active ? TAB_META[t].color : "#E5E7EB",
                  color: active ? "#fff" : "#374151",
                  borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 600,
                }}>
                  {count}
                </span>
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
            borderRadius: 8, fontSize: 13, color: "#111",
            outline: "none",
          }}
        />
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: "#6B7280", fontSize: 14 }}>Yüklənir...</p>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px 0",
          color: "#6B7280", fontSize: 14,
        }}>
          Müraciət tapılmadı.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(req => {
            const badge = STATUS_BADGE[req.status] ?? { label: req.status, bg: "#F3F4F6", color: "#374151" };
            return (
              <div
                key={req.id}
                onClick={() => router.push(`/operator/session-requests/${req.id}`)}
                style={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: "16px 20px",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "8px 16px",
                  alignItems: "start",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0B1A35" }}>{req.name}</span>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                    }}>{badge.label}</span>
                    {req.status === "NEW" && (
                      <span style={{
                        background: "#FEF3C7", color: "#92400E",
                        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                        border: "1px solid #FCD34D",
                      }}>Yeni</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                    <span style={{ marginRight: 12 }}>{req.phone}</span>
                    {req.email && <span style={{ color: "#52718F" }}>{req.email}</span>}
                    {req.age && <span style={{ marginLeft: 12, color: "#52718F" }}>{req.age} yaş</span>}
                  </div>
                  <div style={{
                    fontSize: 13, color: "#374151",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 620,
                  }}>
                    {req.reason}
                  </div>
                  {req.preferredDate && (
                    <div style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
                      Üstünlük verilən: {req.preferredDate}{req.preferredTime ? ` saat ${req.preferredTime}` : ""}
                    </div>
                  )}
                  {req.assignedPsychologistName && (
                    <div style={{ fontSize: 12, color: "#065F46", marginTop: 4 }}>
                      Psixoloq: {req.assignedPsychologistName}
                      {req.scheduledDate && ` · ${req.scheduledDate}${req.scheduledTime ? ` ${req.scheduledTime}` : ""}`}
                      {req.sessionPackage && ` · ${req.sessionPackage}`}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                  #{req.id}
                  <br />
                  {timeAgo(req.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
