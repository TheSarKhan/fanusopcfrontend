"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { notificationsApi, type NotificationItem } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { humanizeDates } from "@/lib/datetime";

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "indi";
  if (m < 60) return `${m} dəq əvvəl`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün əvvəl`;
  return new Date(iso).toLocaleDateString("az-AZ");
}

export default function NotificationBell() {
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Derive role-aware "all notifications" path from current panel location
  const allHref = (() => {
    const m = pathname?.match(/^\/(patient|psycholog|operator|admin)(?:\/|$)/);
    return m ? `/${m[1]}/notifications` : "/notifications";
  })();

  const refreshCount = async () => {
    try {
      const { count } = await notificationsApi.unreadCount();
      setUnread(count);
    } catch { /* offline tolerant */ }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      setItems(await notificationsApi.list(30));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // Initial load + WebSocket live push (with safety polling fallback every 60s)
  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") refreshCount(); };
    document.addEventListener("visibilitychange", onVis);

    const unsub = subscribeNotifications((n) => {
      setItems(prev => {
        if (prev.some(x => x.id === n.id)) return prev; // de-dupe
        return [n, ...prev].slice(0, 30);
      });
      setUnread(c => {
        // Only bump unread if this id is genuinely new
        if (items.some(x => x.id === n.id)) return c;
        return c + 1;
      });
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(humanizeDates(n.title), { body: humanizeDates(n.body) });
        }
      } catch { /* ignore */ }
    });

    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once on mount; setItems already de-dupes
  }, []);

  // Ask once for browser notification permission (operator wants the popup ping)
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await loadList();
  };

  const onItemClick = async (n: NotificationItem) => {
    if (!n.readAt) {
      try { await notificationsApi.markRead(n.id); } catch { /* ignore */ }
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x));
      setUnread(c => Math.max(0, c - 1));
    }
    if (n.link) window.location.assign(n.link);
    else setOpen(false);
  };

  const onMarkAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems(prev => prev.map(x => x.readAt ? x : { ...x, readAt: new Date().toISOString() }));
      setUnread(0);
    } catch { /* ignore */ }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Bildirişlər"
        style={{
          width: 38, height: 38, borderRadius: "50%",
          background: open ? "#EEF2FF" : "transparent",
          border: "1px solid #E5E7EB", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}
      >
        <svg width="18" height="18" fill="none" stroke="#1A2535" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span aria-label={`${unread} oxunmamış`} style={{
            position: "absolute", top: 2, right: 2, minWidth: 16, height: 16,
            borderRadius: 8, background: "#DC2626", color: "#fff",
            fontSize: 10, fontWeight: 700, padding: "0 4px",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 360, maxHeight: 480, overflow: "hidden",
          background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          border: "1px solid #E5E7EB", zIndex: 80,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #EFF2F7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", margin: 0 }}>Bildirişlər</h3>
            {unread > 0 && (
              <button onClick={onMarkAll} style={{ fontSize: 12, color: "#3B6FA5", background: "transparent", border: "none", cursor: "pointer" }}>
                Hamısını oxunmuş et
              </button>
            )}
          </div>

          <div style={{ overflow: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#52718F" }}>Yüklənir…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#52718F" }}>
                Hələ bildiriş yoxdur.
              </div>
            ) : (
              items.slice(0, 8).map(n => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "12px 16px", border: "none", borderBottom: "1px solid #F3F4F6",
                    background: n.readAt ? "#fff" : "#EEF2FF",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    {!n.readAt && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#3B6FA5", marginTop: 6, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535", marginBottom: 2 }}>
                        {humanizeDates(n.title)}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 12, color: "#52718F", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {humanizeDates(n.body)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#8AAABF", marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            style={{
              display: "block", padding: "10px 16px", textAlign: "center",
              fontSize: 12.5, fontWeight: 600, color: "var(--brand)",
              textDecoration: "none", borderTop: "1px solid #EFF2F7",
              background: "var(--brand-50)",
            }}
          >
            Bütün bildirişləri gör →
          </Link>
        </div>
      )}
    </div>
  );
}
