"use client";

import { useEffect, useState } from "react";
import { patientApi, type BookingSeries } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

function fmtDate(s: string | null | undefined, locale: string) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString(
      locale === "az" ? "az-AZ" : locale === "ru" ? "ru-RU" : "en-GB",
      { day: "2-digit", month: "short", year: "numeric" }
    );
  } catch { return s; }
}

export default function PatientSeriesPage() {
  const { t, locale } = useT();
  const [items, setItems] = useState<BookingSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.myBookingSeries()
      .then(setItems)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCancel = async (id: number) => {
    if (!confirm(t("series.cancelRequestConfirm"))) return;
    setCancellingId(id);
    try {
      const updated = await patientApi.cancelBookingSeries(id);
      setItems(prev => prev.map(s => s.id === id ? updated : s));
      alert(t("series.cancelRequestSent"));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCancellingId(null);
    }
  };

  const onExtend = async (id: number, count: number) => {
    setExtendingId(id);
    try {
      const updated = await patientApi.extendBookingSeries(id, count);
      setItems(prev => prev.map(s => s.id === id ? updated : s));
      alert(t("series.extendDone", { n: count }));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExtendingId(null);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A2535" }}>{t("series.pageTitle")}</h1>
      <p style={{ color: "#52718F", fontSize: 14, marginTop: 4, marginBottom: 24 }}>
        {t("series.pageSub")}
      </p>

      {err && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {t("common.loading")}
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1A2535", marginBottom: 4 }}>{t("series.empty")}</div>
          <a
            href="/psychologists"
            style={{ display: "inline-block", marginTop: 12, background: "var(--brand)", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            {t("series.emptyCta")}
          </a>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {items.map(s => {
            const isCancelled = s.cancelledAt != null;
            const isCancelPending = !isCancelled && s.cancelRequestedAt != null;
            const freqLabel = s.frequency === "WEEKLY" ? t("series.weekly") : t("series.biweekly");
            return (
              <div
                key={s.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  border: isCancelled ? "1px solid #FECACA" : "1px solid var(--brand-100)",
                  opacity: isCancelled ? 0.85 : 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1A2535" }}>{freqLabel}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
                    padding: "4px 10px", borderRadius: 999,
                    background: isCancelled ? "#FEE2E2" : isCancelPending ? "#FEF3C7" : "var(--brand-50)",
                    color: isCancelled ? "#991B1B" : isCancelPending ? "#92400E" : "var(--brand-700)",
                  }}>
                    {isCancelled
                      ? t("series.cancelledBadge")
                      : isCancelPending
                        ? t("series.cancelPendingBadge")
                        : t("series.activeBadge")}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "#52718F" }}>
                  {s.requestedPsychologistName
                    ? t("series.withPsy", { name: s.requestedPsychologistName })
                    : t("series.noPsy")}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "#1A2535", fontWeight: 600 }}>
                  <span>{t("series.countDone", { done: s.createdAppointments, total: s.totalCount })}</span>
                  {s.skippedOccurrences > 0 && (
                    <span title={t("series.skippedHint")} style={{ color: "#92400E", fontWeight: 500 }}>
                      · {t("series.skipped", { n: s.skippedOccurrences })}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "#7A8AA0" }}>
                  {t("series.createdAt", { date: fmtDate(s.createdAt, locale) })}
                </div>

                {isCancelPending && (
                  <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8,
                    background: "#FEF3C7", color: "#92400E", marginTop: 4 }}>
                    {t("series.cancelPendingHint")}
                  </div>
                )}
                {!isCancelled && !isCancelPending && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {s.skippedOccurrences > 0 && (
                      <button
                        type="button"
                        onClick={() => onExtend(s.id, s.skippedOccurrences)}
                        disabled={extendingId === s.id}
                        style={{
                          background: "var(--brand)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 14px",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: extendingId === s.id ? "default" : "pointer",
                          opacity: extendingId === s.id ? 0.6 : 1,
                        }}
                      >
                        {extendingId === s.id
                          ? t("series.extending")
                          : t("series.extendCta", { n: s.skippedOccurrences })}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancel(s.id)}
                      disabled={cancellingId === s.id}
                      style={{
                        background: "transparent",
                        color: "#991B1B",
                        border: "1px solid #FECACA",
                        borderRadius: 8,
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: cancellingId === s.id ? "default" : "pointer",
                        opacity: cancellingId === s.id ? 0.6 : 1,
                      }}
                    >
                      {t("series.cancelCta")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
