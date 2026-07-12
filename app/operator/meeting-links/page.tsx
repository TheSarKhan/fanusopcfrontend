"use client";

/**
 * Operator "Görüş linkləri" iş siyahısı — yaxınlaşan, görüş linki hələ
 * göndərilməmiş seanslar kart kimi göstərilir. Operator linki burada əlavə edib
 * göndərir; link göndəriləndən sonra kart siyahıdan çıxır.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { operatorApi, type AppointmentDetail } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import { subscribeNotifications } from "@/lib/notificationsSocket";
import { SkeletonGrid } from "@/components/Skeleton";
import EmptyState, { CalendarGlyph } from "@/components/EmptyState";
import { toast } from "@/components/Toast";

// ─── İkonlar (inline SVG — icons.svg#i-*-dən; emoji qadağandır) ────────────────
const IconRefresh = () => (
  <svg className="fx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IconClock = () => (
  <svg className="fx-icon fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);
const IconSend = () => (
  <svg className="fx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" />
  </svg>
);
const IconArrowRight = () => (
  <svg className="fx-icon fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
  </svg>
);

const initialsOf = (name?: string | null) =>
  (name ?? "").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

function untilLabel(iso?: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "indi";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} dəq sonra`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat sonra`;
  const d = Math.round(h / 24);
  return `${d} gün sonra`;
}

export default function OperatorMeetingLinksPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    operatorApi.pendingMeetingLinks()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Yeni təyinat / link hadisəsi olduqda siyahını canlı yenilə.
  useEffect(() => {
    return subscribeNotifications((n) => {
      if (typeof n.type === "string" && n.type.startsWith("APPOINTMENT_")) load();
    });
  }, []);

  const onSent = (id: number) => setItems(prev => prev.filter(a => a.id !== id));
  const onUpdated = (a: AppointmentDetail) =>
    setItems(prev => prev.map(x => (x.id === a.id ? a : x)));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <h1 className="fx-h1">Görüş linkləri</h1>
          <p className="fx-subtitle" style={{ margin: "6px 0 0" }}>
            Yaxınlaşan, görüş linki hələ göndərilməmiş seanslar. Linki əlavə edib göndərin.
          </p>
        </div>
        <button type="button" onClick={load} className="fx-btn fx-btn--ghost">
          <IconRefresh /> Yenilə
        </button>
      </div>

      {loading ? (
        <SkeletonGrid count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarGlyph />} title="Gözləyən görüş linki yoxdur"
          sub="Bütün yaxınlaşan seanslara link göndərilib." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, alignItems: "stretch" }}>
          {items.map(a => (
            <MeetingLinkCard key={a.id} a={a} onSent={() => onSent(a.id)} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingLinkCard({ a, onSent, onUpdated }: {
  a: AppointmentDetail;
  onSent: () => void;
  onUpdated: (a: AppointmentDetail) => void;
}) {
  const [value, setValue] = useState(a.meetingLink ?? "");
  const [busy, setBusy] = useState(false);
  const hasLink = !!a.meetingLink;
  const av = (Math.abs(a.id) % 4) + 1;

  const saveAndSend = async () => {
    const link = value.trim();
    if (!link) { toast("Görüş linki yazın", "error"); return; }
    if (!link.startsWith("https://")) { toast("Link https:// ilə başlamalıdır", "error"); return; }
    setBusy(true);
    try {
      await operatorApi.setMeetingLink(a.id, link);
      await operatorApi.sendMeetingLink(a.id);
      toast("Görüş linki göndərildi", "success");
      onSent();
    } catch (e) {
      toast("Alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const saveOnly = async () => {
    const link = value.trim();
    if (!link) { toast("Görüş linki yazın", "error"); return; }
    if (!link.startsWith("https://")) { toast("Link https:// ilə başlamalıdır", "error"); return; }
    setBusy(true);
    try {
      const updated = await operatorApi.setMeetingLink(a.id, link);
      toast("Yadda saxlanıldı (hələ göndərilməyib)", "success");
      onUpdated(updated);
    } catch (e) {
      toast("Alınmadı: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const busyStyle = { opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" };

  return (
    <div className="fx-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="fx-num" style={{ fontSize: "var(--text-micro)", fontWeight: 600, color: "var(--oxford-60)" }}>
          #FNS-{String(a.id).padStart(4, "0")}
        </span>
        {hasLink && (
          <span className="fx-pill fx-pill--pending">
            <IconClock /> Link var · göndərilməyib
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <span className={`fx-avatar fx-avatar--${av} fx-avatar--sm`} aria-hidden>{initialsOf(a.patientName)}</span>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", letterSpacing: "-.01em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {a.patientName ?? "—"}
          </div>
          <div className="fx-row__meta">
            {a.psychologistName && <><span style={{ fontWeight: 600, color: "var(--oxford-80)" }}>{a.psychologistName}</span><span className="fx-sep">·</span></>}
            <span className="fx-num">{a.startAt ? azFormatDateTime(a.startAt) : "—"}</span>
          </div>
        </div>
      </div>

      {a.startAt && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--brand-600)" }}>
          <IconClock /> {untilLabel(a.startAt)}
        </div>
      )}

      <div className="fx-field">
        <label className="fx-label">Görüş linki</label>
        <input
          type="url"
          className="fx-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="https://…"
          onClick={e => e.stopPropagation()}
        />
        <span className="fx-help">Zoom, Google Meet və ya Jitsi linki · https:// ilə başlamalıdır</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={saveAndSend} disabled={busy} className="fx-btn fx-btn--primary" style={{ width: "100%", ...busyStyle }}>
          <IconSend /> Əlavə et və göndər
        </button>
        <button type="button" onClick={saveOnly} disabled={busy} className="fx-btn fx-btn--ghost" style={{ width: "100%", ...busyStyle }}>
          Yalnız saxla
        </button>
      </div>

      <Link href={`/operator/appointments/${a.id}`} onClick={e => e.stopPropagation()}
        style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-caption)", color: "var(--oxford-60)", textDecoration: "none", fontWeight: 600 }}>
        Müraciətə bax <IconArrowRight />
      </Link>
    </div>
  );
}
