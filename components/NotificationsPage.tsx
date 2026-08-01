"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { notificationsApi, type NotificationItem } from "@/lib/api";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { humanizeDates, azFormatDate } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

type IconName =
  | "calendar" | "check" | "refresh" | "x" | "clock" | "hourglass" | "check2"
  | "alert" | "handshake" | "star" | "target" | "bell" | "heart";

/** Görünən ad `ntfType.<KOD>` açarından gəlir — burada yalnız ikon və ton saxlanılır. */
const TYPE_META: Record<string, { icon: IconName; tone: "brand" | "good" | "warn" | "danger" | "neutral" }> = {
  APPOINTMENT_ASSIGNED:               { icon: "calendar",  tone: "brand" },
  APPOINTMENT_CONFIRMED:              { icon: "check",     tone: "good" },
  APPOINTMENT_REJECTED:               { icon: "refresh",   tone: "warn" },
  APPOINTMENT_CANCELLED:              { icon: "x",         tone: "danger" },
  APPOINTMENT_REMINDER:               { icon: "clock",     tone: "brand" },
  APPOINTMENT_AWAITING_CONFIRMATION:  { icon: "hourglass", tone: "warn" },
  APPOINTMENT_COMPLETED:              { icon: "check2",    tone: "good" },
  APPOINTMENT_DISPUTED:               { icon: "alert",     tone: "danger" },
  APPOINTMENT_DISPUTE_RESOLVED:       { icon: "handshake", tone: "good" },
  APPOINTMENT_CANCEL_REQUESTED:       { icon: "x",         tone: "warn" },
  APPOINTMENT_NEW:                    { icon: "calendar",  tone: "brand" },
  APPOINTMENT_PENDING:                { icon: "hourglass", tone: "warn" },
  APPOINTMENT_PATIENT_CONFIRMED:      { icon: "check",     tone: "good" },
  APPOINTMENT_HANDOFF:                { icon: "refresh",   tone: "warn" },
  APPOINTMENT_CANCEL_REQUEST_PENDING: { icon: "hourglass", tone: "warn" },
  APPOINTMENT_CANCEL_REQUEST_APPROVED:{ icon: "check2",    tone: "good" },
  APPOINTMENT_CANCEL_REQUEST_REJECTED:{ icon: "x",         tone: "danger" },
  APPOINTMENT_MEETING_LINK:           { icon: "calendar",  tone: "brand" },
  APPOINTMENT_CLAIM_STOLEN:           { icon: "refresh",   tone: "neutral" },
  APPOINTMENT_DISPUTE_STALE:          { icon: "alert",     tone: "danger" },
  APPOINTMENT_SLA_OVERDUE:            { icon: "alert",     tone: "danger" },
  APPOINTMENT_SLA_ESCALATED:          { icon: "alert",     tone: "danger" },
  RESCHEDULE_REQUESTED:               { icon: "clock",     tone: "warn" },
  RESCHEDULE_PROPOSED:                { icon: "clock",     tone: "brand" },
  RESCHEDULE_ACCEPTED:                { icon: "check2",    tone: "good" },
  RESCHEDULE_REQUEST_ACCEPTED:        { icon: "check2",    tone: "good" },
  RESCHEDULE_REQUEST_REJECTED:        { icon: "x",         tone: "danger" },
  RESCHEDULE_REQUEST_EXPIRED:         { icon: "clock",     tone: "neutral" },
  RESCHEDULE_FAILED:                  { icon: "x",         tone: "danger" },
  RESCHEDULE_MEDIATION_DECLINED:      { icon: "x",         tone: "warn" },
  SERIES_CANCEL_REQUESTED:            { icon: "x",         tone: "warn" },
  SERIES_CANCEL_REQUEST_PENDING:      { icon: "hourglass", tone: "warn" },
  SERIES_CANCEL_REQUEST_APPROVED:     { icon: "check2",    tone: "good" },
  SERIES_CANCEL_REQUEST_REJECTED:     { icon: "x",         tone: "danger" },
  SERIES_CANCELLED:                   { icon: "x",         tone: "danger" },
  SERIES_RESCHEDULED:                 { icon: "clock",     tone: "brand" },
  SERIES_ENDED:                       { icon: "check2",    tone: "neutral" },
  SERIES_RENEWAL_NOTICE:              { icon: "bell",      tone: "warn" },
  SERIES_RENEWAL_SUGGESTED:           { icon: "bell",      tone: "brand" },
  REVIEW_PENDING:                     { icon: "star",      tone: "warn" },
  REVIEW_APPROVED:                    { icon: "star",      tone: "good" },
  REVIEW_DELETION_REQUEST_NEW:        { icon: "alert",     tone: "warn" },
  REVIEW_DELETION_REQUEST_DECIDED:    { icon: "check2",    tone: "neutral" },
  HOMEWORK_ASSIGNED:                  { icon: "target",    tone: "brand" },
  HOMEWORK_NEW:                       { icon: "target",    tone: "brand" },
  HOMEWORK_UPDATED:                   { icon: "target",    tone: "brand" },
  HOMEWORK_ATTACHMENT:                { icon: "target",    tone: "neutral" },
  HOMEWORK_COMMENT:                   { icon: "target",    tone: "neutral" },
  GOAL_PROGRESS_UPDATED:              { icon: "target",    tone: "brand" },
  CRISIS_CHECK_IN:                    { icon: "heart",     tone: "danger" },
  PATIENT_RISK_FLAGGED:               { icon: "alert",     tone: "danger" },
  PEER_NEW_ARTICLE:                   { icon: "bell",      tone: "brand" },
  PEER_NEW_RESOURCE:                  { icon: "target",    tone: "brand" },
  ARTICLE_COMMENT_REPLY:              { icon: "bell",      tone: "brand" },
  ARTICLE_COMMENT:                    { icon: "bell",      tone: "brand" },
  ARTICLE_LIKE:                       { icon: "heart",     tone: "brand" },
  REFERRAL_CONSENT_NEEDED:            { icon: "bell",      tone: "warn" },
  REFERRAL_RECEIVED:                  { icon: "handshake", tone: "brand" },
  REFERRAL_ACCEPTED:                  { icon: "check2",    tone: "good" },
  REFERRAL_DECLINED:                  { icon: "x",         tone: "danger" },
  REFERRAL_CANCELLED:                 { icon: "x",         tone: "neutral" },
  ACCOUNT_DELETION_REJECTED:          { icon: "x",         tone: "warn" },
  PSY_SUSPENDED:                      { icon: "alert",     tone: "danger" },
  PSY_UNSUSPENDED:                    { icon: "check2",    tone: "good" },
  CLINICAL_ACCESS_GRANTED:            { icon: "alert",     tone: "warn" },
  PACKAGE_TRANSFERRED:                { icon: "handshake", tone: "brand" },
  PACKAGE_ASSIGNED:                   { icon: "handshake", tone: "brand" },
  POOL_RELEASE_REQUEST_NEW:           { icon: "alert",     tone: "warn" },
  POOL_RELEASE_REQUEST_DECIDED:       { icon: "check2",    tone: "neutral" },
  RESOURCE_SHARE_PENDING:             { icon: "alert",     tone: "warn" },
  PSYCH_TEST_NEW:                     { icon: "target",    tone: "brand" },
  PSYCH_TEST_RESULT:                  { icon: "check2",    tone: "good" },
  PSYCH_TEST_SHARE_PENDING:           { icon: "alert",     tone: "warn" },
  REFUND_REQUEST_NEW:                 { icon: "alert",     tone: "warn" },
  REFUND_REQUEST_DECIDED:             { icon: "check2",    tone: "neutral" },
  SESSION_REQUEST_NEW:                { icon: "bell",      tone: "brand" },
  PAYOUT_PAID:                        { icon: "check2",    tone: "good" },
};

function timeAgo(t: Translate, iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("ntf.agoNow");
  if (m < 60) return t("ntf.agoMin", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("ntf.agoHour", { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("ntf.agoDay", { n: d });
  return azFormatDate(iso);
}

function groupByDay(t: Translate, items: NotificationItem[]): Array<{ label: string; items: NotificationItem[] }> {
  const groups = new Map<string, NotificationItem[]>();
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  for (const it of items) {
    const d = new Date(it.createdAt);
    let label: string;
    if (sameDay(d, today)) label = t("ntf.groupToday");
    else if (sameDay(d, yesterday)) label = t("ntf.groupYesterday");
    else label = azFormatDate(d);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(it);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

type FilterTab = "ALL" | "UNREAD" | "APPOINTMENT" | "OTHER";

export default function NotificationsPage() {
  const { t } = useT();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  // Son sorğu tam səhifə qaytarıbsa, davamı ola bilər.
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement | null>(null);

  const PAGE_SIZE = 50;

  const load = () => {
    setLoading(true);
    notificationsApi.list(PAGE_SIZE, 0)
      .then(res => {
        setItems(res);
        setPage(0);
        setHasMore(res.length === PAGE_SIZE);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  const loadMore = () => {
    setLoadingMore(true);
    notificationsApi.list(PAGE_SIZE, page + 1)
      .then(res => {
        // Canlı bildirişlər siyahını irəli sürüşdürə bilər — dublikatları at.
        setItems(prev => {
          const seen = new Set(prev.map(i => i.id));
          return [...prev, ...res.filter(i => !seen.has(i.id))];
        });
        setPage(p => p + 1);
        setHasMore(res.length === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return subscribeNotifications(() => load());
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

  const counts = useMemo(() => {
    const all = items.length;
    const unread = items.filter(i => !i.readAt).length;
    const appointment = items.filter(i => i.type.startsWith("APPOINTMENT_")).length;
    const other = all - appointment;
    return { all, unread, appointment, other };
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    switch (filter) {
      case "UNREAD":      list = list.filter(i => !i.readAt); break;
      case "APPOINTMENT": list = list.filter(i => i.type.startsWith("APPOINTMENT_")); break;
      case "OTHER":       list = list.filter(i => !i.type.startsWith("APPOINTMENT_")); break;
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(i =>
        (i.title ?? "").toLowerCase().includes(q) ||
        (i.body ?? "").toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  const groups = useMemo(() => groupByDay(t, filtered), [t, filtered]);

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

  const toggleSelected = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const bulkMarkRead = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await notificationsApi.markReadBulk(ids);
      const now = new Date().toISOString();
      setItems(prev => prev.map(i => selected.has(i.id) && !i.readAt ? { ...i, readAt: now } : i));
      exitSelect();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(t("ntf.deleteConfirm", { n: ids.length }))) return;
    setBusy(true);
    try {
      await notificationsApi.deleteBulk(ids);
      setItems(prev => prev.filter(i => !selected.has(i.id)));
      exitSelect();
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
          <h1 className="ntf-title">{t("ntf.title")}</h1>
          <p className="ntf-sub">
            {counts.unread > 0
              ? t("ntf.subUnread", { n: counts.unread })
              : t("ntf.subAllRead")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!selectMode && counts.unread > 0 && (
            <button onClick={markAllRead} disabled={busy} className="ntf-btn-primary">
              {busy ? "..." : t("ntf.markAllRead")}
            </button>
          )}
          {!selectMode ? (
            <button onClick={() => setSelectMode(true)} className="ntf-btn-ghost">
              {t("ntf.selectCta")}
            </button>
          ) : (
            <button onClick={exitSelect} className="ntf-btn-ghost">{t("ntf.selectExit")}</button>
          )}
        </div>
      </header>

      {selectMode && selected.size > 0 && (
        <div className="ntf-bulkbar">
          <span><strong>{t("ntf.selectedCount", { n: selected.size })}</strong></span>
          <div className="ntf-bulkbar-actions">
            <button onClick={bulkMarkRead} disabled={busy} className="ntf-bulkbar-btn ntf-bulkbar-btn--primary">
              {t("ntf.bulkMarkRead")}
            </button>
            <button onClick={bulkDelete} disabled={busy} className="ntf-bulkbar-btn ntf-bulkbar-btn--danger">
              {t("ntf.bulkDelete")}
            </button>
          </div>
        </div>
      )}

      <div className="ntf-toolbar">
        <nav className="ntf-tabs" role="tablist">
          <FilterTabButton active={filter === "ALL"} onClick={() => setFilter("ALL")} count={counts.all}>
            {t("ntf.tabAll")}
          </FilterTabButton>
          <FilterTabButton active={filter === "UNREAD"} onClick={() => setFilter("UNREAD")} count={counts.unread} accent>
            {t("ntf.tabUnread")}
          </FilterTabButton>
          <FilterTabButton active={filter === "APPOINTMENT"} onClick={() => setFilter("APPOINTMENT")} count={counts.appointment}>
            {t("ntf.tabAppointments")}
          </FilterTabButton>
          <FilterTabButton active={filter === "OTHER"} onClick={() => setFilter("OTHER")} count={counts.other}>
            {t("ntf.tabOther")}
          </FilterTabButton>
        </nav>
        <div className="ntf-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("ntf.searchPh")}
          />
          <kbd>/</kbd>
        </div>
      </div>

      {loading ? (
        <div className="ntf-loading">{t("ntf.loading")}</div>
      ) : groups.length === 0 ? (
        <div className="ntf-empty">
          <div className="ntf-empty-icon" aria-hidden>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div className="ntf-empty-title">
            {search.trim()
              ? t("ntf.emptyNoMatch")
              : filter === "UNREAD" ? t("ntf.emptyUnread") : t("ntf.emptyNone")}
          </div>
          <p className="ntf-empty-sub">
            {search.trim()
              ? t("ntf.emptyNoMatchSub")
              : filter === "UNREAD"
                ? t("ntf.emptyUnreadSub")
                : t("ntf.emptyNoneSub")}
          </p>
        </div>
      ) : (
        <div className="ntf-list">
          {groups.map(group => (
            <section key={group.label} className="ntf-group">
              <div className="ntf-group-label">{group.label}</div>
              <div className="ntf-group-items">
                {group.items.map(it => (
                  <NotificationRow
                    key={it.id}
                    item={it}
                    selectable={selectMode}
                    selected={selected.has(it.id)}
                    onToggleSelect={() => toggleSelected(it.id)}
                    onClick={() => onItemClick(it)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" onClick={loadMore} disabled={loadingMore}
            style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
            {loadingMore ? t("ntf.loading") : t("ntf.loadMore")}
          </button>
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

function NotificationRow({
  item, onClick, selectable, selected, onToggleSelect,
}: {
  item: NotificationItem;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useT();
  const meta = TYPE_META[item.type];
  const icon = meta?.icon ?? ("bell" as IconName);
  const tone = meta?.tone ?? ("neutral" as const);
  const label = meta ? t(`ntfType.${item.type}` as MessageKey) : item.type.replace(/_/g, " ");
  const isUnread = !item.readAt;
  const [justRead, setJustRead] = useState(false);

  const handle = async (e?: React.MouseEvent) => {
    if (selectable) {
      e?.preventDefault();
      onToggleSelect?.();
      return;
    }
    if (isUnread) {
      setJustRead(true);
      setTimeout(() => setJustRead(false), 400);
    }
    onClick();
  };

  const inner = (
    <>
      {selectable && (
        <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect?.()}
          onClick={e => e.stopPropagation()}
          className="ntf-row-check" />
      )}
      <div className={`ntf-row-icon${isUnread ? " is-unread" : ""}${justRead ? " is-justread" : ""}`} data-tone={tone} aria-hidden>
        <NotifIcon name={icon} />
      </div>
      <div className="ntf-row-main">
        <div className="ntf-row-head">
          <span className="ntf-row-type">{label}</span>
          <span className="ntf-row-time">{timeAgo(t, item.createdAt)}</span>
        </div>
        <div className="ntf-row-title">{humanizeDates(item.title)}</div>
        {item.body && <div className="ntf-row-body">{humanizeDates(item.body)}</div>}
      </div>
      {isUnread && !selectable && <span className="ntf-row-dot" aria-label={t("ntf.unreadAria")} />}
    </>
  );

  const className = `ntf-row${isUnread ? " is-unread" : ""}${justRead ? " is-justread" : ""}${selected ? " is-selected" : ""}`;

  if (item.link && !selectable) {
    return (
      <Link href={item.link} className={className} onClick={() => handle()}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={className} onClick={() => handle()} role="button" tabIndex={0}>
      {inner}
    </div>
  );
}

function NotifIcon({ name }: { name: IconName }) {
  const sw = { width: 16, height: 16, fill: "none" as const, stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
  switch (name) {
    case "calendar":
      return (<svg {...sw}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
    case "check":
    case "check2":
      return (<svg {...sw} strokeWidth={2.4}><polyline points="20 6 9 17 4 12"/></svg>);
    case "refresh":
      return (<svg {...sw}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>);
    case "x":
      return (<svg {...sw} strokeWidth={2.4}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
    case "clock":
      return (<svg {...sw}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
    case "hourglass":
      return (<svg {...sw}><path d="M5 2h14"/><path d="M5 22h14"/><path d="M7 2v3a5 5 0 0 0 10 0V2"/><path d="M7 22v-3a5 5 0 0 1 10 0v3"/></svg>);
    case "alert":
      return (<svg {...sw} strokeWidth={2.3}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    case "handshake":
      return (<svg {...sw}><path d="M2 12l3-3 3 3"/><path d="M22 12l-3-3-3 3"/><path d="M5 9v6l4 4 3-3 3 3 4-4V9"/></svg>);
    case "star":
      return (<svg {...sw}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
    case "target":
      return (<svg {...sw}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>);
    case "heart":
      return (<svg {...sw}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
    case "bell":
    default:
      return (<svg {...sw}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
  }
}
