"use client";

import { useEffect, useState } from "react";
import { patientApi, type PatientPackageItem, type AppointmentDetail } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import PageHeader from "@/components/PageHeader";
import { toast } from "@/components/Toast";
import { azLocalToISO, azFormatDate, azFormatDateTime } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/** Maps backend status → pkg.* label key. */
const STATUS_LABEL: Record<string, MessageKey> = {
  ACTIVE: "pkg.active",
  EXHAUSTED: "pkg.exhausted",
  EXPIRED: "pkg.expired",
  CANCELLED: "pkg.cancelled",
};

const STATUS_TONE: Record<string, { color: string; bg: string }> = {
  ACTIVE:    { color: "#065F46", bg: "#D1FAE5" },
  EXHAUSTED: { color: "#374151", bg: "#F3F4F6" },
  EXPIRED:   { color: "#92400E", bg: "#FEF3C7" },
  CANCELLED: { color: "#991B1B", bg: "#FEE2E2" },
};

const PAGE_SIZE = 30;

export default function PatientPackagesPage() {
  const { t } = useT();
  const [items, setItems] = useState<PatientPackageItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Paketdən planlanmış seanslar: randevular `patientPackageId` daşıyır, ona görə
  // bir dəfə çəkib paket üzrə qruplaşdırırıq (backend dəyişikliyi lazım deyil).
  // Əvvəl kartda yalnız "qalan/ümumi" vardı — hansı tarixlərin seçildiyi görünmürdü.
  const [byPackage, setByPackage] = useState<Record<number, AppointmentDetail[]>>({});

  const loadSessions = () => {
    patientApi.myAppointments()
      .then(list => {
        const map: Record<number, AppointmentDetail[]> = {};
        for (const a of list) {
          if (a.patientPackageId == null) continue;
          (map[a.patientPackageId] ??= []).push(a);
        }
        for (const k of Object.keys(map)) {
          map[Number(k)].sort((x, y) =>
            new Date(x.startAt ?? 0).getTime() - new Date(y.startAt ?? 0).getTime());
        }
        setByPackage(map);
      })
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    patientApi.myPackagesPaged({ page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadSessions();
  };

  useEffect(load, []);

  const loadMore = () => {
    setLoadingMore(true);
    patientApi.myPackagesPaged({ page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = items.length < totalElements;

  return (
    <div className="psy-appt-page">
      <PageHeader title={t("pkg.myPackages")} subtitle="Aldığınız paketləri və qalan seansları buradan izləyin" />

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 12, padding: 28,
          textAlign: "center", color: "var(--oxford-60)", fontSize: 13,
          border: "1px dashed var(--brand-100)",
        }}>
          {t("pkg.noPackages")}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map(p => (
              <PackageCard key={p.id} pkg={p} sessions={byPackage[p.id] ?? []} onScheduled={load} />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PackageCard({ pkg, sessions, onScheduled }:
  { pkg: PatientPackageItem; sessions: AppointmentDetail[]; onScheduled: () => void }) {
  const { t } = useT();
  // Tarix və saat AYRI sahələrdir. Əvvəl tək `withTime` DatePicker vardı: saat
  // sətri təqvimin altında qaldığı üçün gözə dəymirdi və seçilməyəndə cari
  // vaxt (məs. 15:28) möhürlənirdi. İndi saat açıq şəkildə seçilir.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const tone = STATUS_TONE[pkg.status] ?? STATUS_TONE.ACTIVE;
  const statusLabel = t(STATUS_LABEL[pkg.status] ?? "pkg.active");
  const canSchedule = pkg.status === "ACTIVE" && pkg.remaining > 0;

  const submit = async () => {
    if (!date) { toast("Tarix seçin", "error"); return; }
    if (!time) { toast("Saat seçin", "error"); return; }
    setSaving(true);
    try {
      await patientApi.schedulePackageSession(pkg.id, { startAt: azLocalToISO(`${date}T${time}`) });
      setScheduled(true);
      setDate(""); setTime("");
      onScheduled();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: 18,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      borderLeft: `4px solid ${tone.color}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{pkg.packageName}</div>
          <div style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 2 }}>{pkg.psychologistName}</div>
        </div>
        <span style={{
          fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
          color: tone.color, background: tone.bg, whiteSpace: "nowrap",
        }}>
          {statusLabel}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 14 }}>
        <Stat label={t("pkg.remaining")} value={`${pkg.remaining}/${pkg.total}`} />
        <Stat label={t("pkg.pricePaid")} value={formatAzn(pkg.pricePaid)} />
        <Stat label={t("pkg.purchasedAt")} value={azFormatDate(pkg.purchasedAt)} />
      </div>

      {/* Bu paketdən planlanmış seanslar — əvvəl heç yerdə görünmürdü. */}
      <div style={{ marginTop: 16, borderTop: "1px solid var(--brand-100)", paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 8 }}>
          Seans tarixləri
        </div>
        {sessions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--oxford-60)" }}>
            Hələ seans planlaşdırılmayıb.
          </p>
        ) : (
          <div>
            {sessions.map((s, i) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, padding: "8px 0",
                borderBottom: i < sessions.length - 1 ? "1px solid var(--oxford-10)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "var(--oxford)", fontVariantNumeric: "tabular-nums" }}>
                  {s.startAt ? azFormatDateTime(s.startAt) : "Vaxt təyin edilməyib"}
                </span>
                <SessionStatus status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {canSchedule && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--brand-100)", paddingTop: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford)", marginBottom: 6 }}>
            {t("pkg.scheduleSession")}
          </label>
          {pkg.schedulingMode === "SCHEDULE_LATER" && (
            <p style={{ fontSize: 12, color: "var(--oxford-60)", margin: "0 0 8px" }}>
              {t("pkg.scheduleLaterHint")}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DatePicker
              value={date}
              onChange={v => { setDate(v); setScheduled(false); }}
              placeholder="gg.aa.iiii"
              theme="light"
              size="sm"
              style={{ flex: "1 1 180px" }}
            />
            <TimePicker
              value={time}
              onChange={v => { setTime(v); setScheduled(false); }}
              theme="light"
              size="sm"
              style={{ flex: "0 1 130px" }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              style={{
                padding: "8px 18px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
              {saving ? "Göndərilir…" : t("pkg.scheduleSession")}
            </button>
          </div>
          {scheduled && (
            <div style={{ background: "var(--brand-50)", color: "var(--brand-700)", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
              {t("pkg.pendingNote")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Seans statusu — pill deyil, rəngli nöqtə + düz mətn (panel dili ilə eyni). */
const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "Gözləyir",   color: "#D97706" },
  ASSIGNED:  { label: "Təyin olunub", color: "#2563EB" },
  CONFIRMED: { label: "Təsdiqli",   color: "#16A34A" },
  COMPLETED: { label: "Tamamlandı", color: "#64748B" },
  CANCELLED: { label: "Ləğv",       color: "#991B1B" },
  REJECTED:  { label: "Rədd",       color: "#991B1B" },
  DISPUTED:  { label: "Mübahisəli", color: "#991B1B" },
};

function SessionStatus({ status }: { status: string }) {
  const s = SESSION_STATUS[status] ?? { label: status, color: "var(--oxford-60)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      <span style={{ fontSize: 12.5, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{s.label}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
