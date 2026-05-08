"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notificationsApi, type NotificationItem } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";

const TYPE_ICON: Record<string, string> = {
  APPOINTMENT_ASSIGNED:               "📅",
  APPOINTMENT_CONFIRMED:              "✓",
  APPOINTMENT_REJECTED:               "↻",
  APPOINTMENT_CANCELLED:              "✗",
  APPOINTMENT_REMINDER:               "⏰",
  APPOINTMENT_AWAITING_CONFIRMATION:  "⏳",
  APPOINTMENT_COMPLETED:              "✅",
  APPOINTMENT_DISPUTED:               "⚠",
  APPOINTMENT_DISPUTE_RESOLVED:       "🤝",
  REVIEW_PENDING:                     "⭐",
  REVIEW_APPROVED:                    "⭐",
  CHAT_MESSAGE:                       "💬",
  HOMEWORK_ASSIGNED:                  "🎯",
  RESOURCE_SHARED:                    "📚",
};

const TYPE_LABEL: Record<string, string> = {
  APPOINTMENT_ASSIGNED:               "Randevu təyini",
  APPOINTMENT_CONFIRMED:              "Təsdiqləndi",
  APPOINTMENT_REJECTED:               "Rədd",
  APPOINTMENT_CANCELLED:              "Ləğv",
  APPOINTMENT_REMINDER:               "Xatırlatma",
  APPOINTMENT_AWAITING_CONFIRMATION:  "Təsdiq gözlənir",
  APPOINTMENT_COMPLETED:              "Tamamlandı",
  APPOINTMENT_DISPUTED:               "Mübahisə",
  APPOINTMENT_DISPUTE_RESOLVED:       "Mübahisə həll",
  REVIEW_PENDING:                     "Rəy",
  REVIEW_APPROVED:                    "Rəy",
  CHAT_MESSAGE:                       "Mesaj",
  HOMEWORK_ASSIGNED:                  "Tapşırıq",
  RESOURCE_SHARED:                    "Resurs",
};

function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "indi";
  if (m < 60) return `${m} dəq əvvəl`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün əvvəl`;
  return new Date(iso).toLocaleDateString("az-AZ", { day: "2-digit", month: "short", year: "numeric" });
}

function groupByDay(items: NotificationItem[]): Array<{ label: string; items: NotificationItem[] }> {
  const groups = new Map<string, NotificationItem[]>();
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  for (const it of items) {
    const d = new Date(it.createdAt);
    let label: string;
    if (sameDay(d, today)) label = "Bu gün";
    else if (sameDay(d, yesterday)) label = "Dünən";
    else label = d.toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(it);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

type FilterTab = "ALL" | "UNREAD" | "APPOINTMENT" | "OTHER";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    notificationsApi.list(100)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications(() => load());
  }, []);

  const counts = useMemo(() => {
    const all = items.length;
    const unread = items.filter(i => !i.readAt).length;
    const appointment = items.filter(i => i.type.startsWith("APPOINTMENT_")).length;
    const other = all - appointment;
    return { all, unread, appointment, other };
  }, [items]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "UNREAD":      return items.filter(i => !i.readAt);
      case "APPOINTMENT": return items.filter(i => i.type.startsWith("APPOINTMENT_"));
      case "OTHER":       return items.filter(i => !i.type.startsWith("APPOINTMENT_"));
      default:            return items;
    }
  }, [items, filter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const onItemClick = async (it: NotificationItem) => {
    if (!it.readAt) {
      try { await notificationsApi.markRead(it.id); } catch { /* ignore */ }
      setItems(prev => prev.map(x => x.id === it.id ? { ...x, readAt: new Date().toISOString() } : x));
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      setItems(prev => prev.map(i => i.readAt ? i : { ...i, readAt: now }));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ntf-page">
      <header className="ntf-header">
        <div>
          <h1 className="ntf-title">Bildirişlər</h1>
          <p className="ntf-sub">
            {counts.unread > 0
              ? `${counts.unread} oxunmamış bildiriş`
              : "Hamısı oxunmuş ✓"}
          </p>
        </div>
        {counts.unread > 0 && (
          <button onClick={markAllRead} disabled={busy} className="ntf-btn-primary">
            {busy ? "..." : "Hamısını oxumuş kimi qeyd et"}
          </button>
        )}
      </header>

      <nav className="ntf-tabs" role="tablist">
        <FilterTabButton active={filter === "ALL"} onClick={() => setFilter("ALL")} count={counts.all}>
          Hamısı
        </FilterTabButton>
        <FilterTabButton active={filter === "UNREAD"} onClick={() => setFilter("UNREAD")} count={counts.unread} accent>
          Oxunmamış
        </FilterTabButton>
        <FilterTabButton active={filter === "APPOINTMENT"} onClick={() => setFilter("APPOINTMENT")} count={counts.appointment}>
          Randevular
        </FilterTabButton>
        <FilterTabButton active={filter === "OTHER"} onClick={() => setFilter("OTHER")} count={counts.other}>
          Digər
        </FilterTabButton>
      </nav>

      {loading ? (
        <div className="ntf-loading">Yüklənir…</div>
      ) : groups.length === 0 ? (
        <div className="ntf-empty">
          <div className="ntf-empty-icon">🌿</div>
          <div className="ntf-empty-title">
            {filter === "UNREAD" ? "Oxunmamış bildiriş yoxdur" : "Hələ bildiriş yoxdur"}
          </div>
          <p className="ntf-empty-sub">
            {filter === "UNREAD"
              ? "Hamısını oxumusunuz, təbriklər."
              : "Sizinlə bağlı yenilik olanda burada görünəcək."}
          </p>
        </div>
      ) : (
        <div className="ntf-list">
          {groups.map(group => (
            <section key={group.label} className="ntf-group">
              <div className="ntf-group-label">{group.label}</div>
              <div className="ntf-group-items">
                {group.items.map(it => (
                  <NotificationRow key={it.id} item={it} onClick={() => onItemClick(it)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTabButton({
  active, onClick, children, count, accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`ntf-tab${active ? " is-active" : ""}${accent ? " is-accent" : ""}`}
    >
      <span>{children}</span>
      <span className="ntf-tab-count">{count}</span>
    </button>
  );
}

function NotificationRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const icon = TYPE_ICON[item.type] ?? "🔔";
  const label = TYPE_LABEL[item.type] ?? item.type.replace(/_/g, " ");
  const isUnread = !item.readAt;
  const inner = (
    <>
      <div className={`ntf-row-icon${isUnread ? " is-unread" : ""}`} aria-hidden>
        {icon}
      </div>
      <div className="ntf-row-main">
        <div className="ntf-row-head">
          <span className="ntf-row-type">{label}</span>
          <span className="ntf-row-time">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="ntf-row-title">{item.title}</div>
        {item.body && <div className="ntf-row-body">{item.body}</div>}
      </div>
      {isUnread && <span className="ntf-row-dot" aria-label="oxunmamış" />}
    </>
  );

  if (item.link) {
    return (
      <Link href={item.link} className={`ntf-row${isUnread ? " is-unread" : ""}`} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={`ntf-row${isUnread ? " is-unread" : ""}`} onClick={onClick} role="button" tabIndex={0}>
      {inner}
    </div>
  );
}
