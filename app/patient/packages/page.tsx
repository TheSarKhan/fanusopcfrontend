"use client";

import { useEffect, useState } from "react";
import { patientApi, type PatientPackageItem } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import PageHeader from "@/components/PageHeader";
import { toast } from "@/components/Toast";
import { azLocalToISO, azFormatDate } from "@/lib/datetime";
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
              <PackageCard key={p.id} pkg={p} onScheduled={load} />
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

function PackageCard({ pkg, onScheduled }: { pkg: PatientPackageItem; onScheduled: () => void }) {
  const { t } = useT();
  const [datetime, setDatetime] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const tone = STATUS_TONE[pkg.status] ?? STATUS_TONE.ACTIVE;
  const statusLabel = t(STATUS_LABEL[pkg.status] ?? "pkg.active");
  const canSchedule = pkg.status === "ACTIVE" && pkg.remaining > 0;

  const submit = async () => {
    if (!datetime) { toast("Vaxt seçin", "error"); return; }
    setSaving(true);
    try {
      await patientApi.schedulePackageSession(pkg.id, { startAt: azLocalToISO(datetime) });
      setScheduled(true);
      setDatetime("");
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
              withTime
              value={datetime}
              onChange={v => { setDatetime(v); setScheduled(false); }}
              theme="light"
              size="sm"
              style={{ flex: "1 1 220px" }}
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
