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
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Görüş linkləri</h1>
          <p className="text-[#52718F] text-sm mt-1">
            Yaxınlaşan, görüş linki hələ göndərilməmiş seanslar. Linki əlavə edib göndərin.
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 text-sm rounded-xl border border-[#E5E7EB] bg-white text-[#1A2535]">
          Yenilə
        </button>
      </div>

      {loading ? (
        <SkeletonGrid count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarGlyph />} title="Gözləyən görüş linki yoxdur"
          sub="Bütün yaxınlaşan seanslara link göndərilib." />
      ) : (
        <div className="op-appt-grid">
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

  return (
    <div className="op-appt">
      <div className="op-appt__chips">
        <span className="op-appt__id">#FNS-{String(a.id).padStart(4, "0")}</span>
        {hasLink && (
          <span className="op-appt__status" style={{ background: "#FEF3C7", color: "#92400E" }}>
            Link var · göndərilməyib
          </span>
        )}
      </div>

      <div className="op-appt__name">{a.patientName ?? "—"}</div>
      <div className="op-appt__assign">
        {a.psychologistName && <><strong>{a.psychologistName}</strong> · </>}
        {a.startAt ? azFormatDateTime(a.startAt) : "—"} <span style={{ color: "var(--brand-700)", fontWeight: 600 }}>· {untilLabel(a.startAt)}</span>
      </div>

      <label style={{ fontSize: 11.5, fontWeight: 600, color: "#52718F", marginTop: 4 }}>Görüş linki (Zoom / Meet / Jitsi)</label>
      <input
        type="url"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="https://…"
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", padding: 9, borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}
      />

      <div className="op-appt__actions" style={{ flexDirection: "row", gap: 8 }}>
        <button onClick={saveAndSend} disabled={busy} className="op-appt__btn op-appt__btn--primary">
          {busy ? "…" : "Əlavə et və göndər"}
        </button>
        <button onClick={saveOnly} disabled={busy} className="op-appt__btn op-appt__btn--ghost" style={{ width: "auto" }}>
          Yalnız saxla
        </button>
      </div>

      <Link href={`/operator/appointments/${a.id}`} onClick={e => e.stopPropagation()}
        style={{ fontSize: 11.5, color: "#52718F", textDecoration: "none", marginTop: 2 }}>
        Müraciətə bax →
      </Link>
    </div>
  );
}
