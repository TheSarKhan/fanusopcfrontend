"use client";

// ============================================================================
// Seans tarixçəsi — tamamlanmış / ləğv edilmiş / rədd edilmiş seansların
// server-səhifələnmiş cədvəli (DataTable). Rəy yazmaq artıq "Psixoloqlar"
// bölməsindən verilir; bu səhifə yalnız oxu-tarixçədir.
// ============================================================================

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  patientApi,
  reasonLabel,
  type AppointmentDetail,
} from "@/lib/api";
import { azFormatDate } from "@/lib/datetime";
import { Card, DataTable, Status, type Column, type StatusTone } from "@/components/ui";
import { STATUS } from "../shared";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const PAGE_SIZE = 30;

/** Statusun tonu — rəngli nöqtə/rozet YOXDUR, yalnız mətn tonu. */
const STATUS_TONE: Record<string, StatusTone> = {
  PENDING: "wait",
  ASSIGNED: "neutral",
  CONFIRMED: "neutral",
  AWAITING_CONFIRMATION: "wait",
  DISPUTED: "risk",
  COMPLETED: "neutral",
  CANCELLED: "risk",
  CANCEL_REQUESTED: "wait",
  REJECTED: "wait",
};

function cancelledByLabel(t: Translate, by?: string | null): string {
  if (by === "PATIENT") return t("patHistory.cancelledByPatient");
  if (by === "PSYCHOLOGIST") return t("patHistory.cancelledByPsy");
  if (by === "OPERATOR") return t("patHistory.cancelledByOperator");
  return t("patHistory.cancelledGeneric");
}

function kindOf(t: Translate, a: AppointmentDetail): string {
  if (a.sessionKind === "INTRO") return t("patHistory.kindIntro");
  // Paket adı DB-dən gəlir — tərcümə olunmur.
  if (a.patientPackageId != null) return a.packageName || t("patHistory.kindPackage");
  return t("patHistory.kindSingle");
}

/** Ləğv səbəbi: backend kodu → lüğət açarı; naməlum kodda `reasonLabel` fallback-i. */
function cancelReasonText(t: Translate, code?: string | null): string {
  if (!code) return "";
  const key = `cancelReason.${code}` as MessageKey;
  const translated = t(key);
  return translated === key ? reasonLabel(code) : translated;
}

function buildColumns(t: Translate): Column<AppointmentDetail>[] {
  return [
    {
      key: "date",
      header: t("patHistory.colDate"),
      cell: a => (
        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          {azFormatDate((a.startAt ?? a.endAt)!)}
        </span>
      ),
    },
    {
      key: "psychologist",
      header: t("patHistory.colPsy"),
      cell: a => {
        const isCancelled = a.status === "CANCELLED";
        const reasonTxt =
          a.cancelReasonCode && a.cancelReasonCode !== "PATIENT_OTHER"
            ? cancelReasonText(t, a.cancelReasonCode)
            : "";
        const showCancelMeta = isCancelled && (a.cancelledBy || reasonTxt || a.cancelReasonText);
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{a.psychologistName ?? t("pat.psyFallback")}</div>
            {showCancelMeta && (
              // Ayrı sətirlər — çip və ya "·" ayırıcısı işlədilmir.
              <div className="fx-row__meta" style={{ marginTop: 3 }}>
                <div>{cancelledByLabel(t, a.cancelledBy)}</div>
                {reasonTxt ? <div>{reasonTxt}</div> : null}
                {a.cancelReasonText ? <div>«{a.cancelReasonText}»</div> : null}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "kind",
      header: t("patHistory.colKind"),
      hideOnMobile: true,
      cell: a => <span style={{ whiteSpace: "nowrap" }}>{kindOf(t, a)}</span>,
    },
    {
      key: "status",
      header: t("patHistory.colStatus"),
      cell: a => {
        const meta = STATUS[a.status] ?? STATUS.COMPLETED;
        return <Status tone={STATUS_TONE[a.status] ?? "neutral"}>{t(meta.labelKey)}</Status>;
      },
    },
  ];
}

export default function PatientAppointmentHistoryPage() {
  const { t } = useT();
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Backend `Paged.page` 0-dan başlayır; Pagination komponenti 1-dən.
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    patientApi.myAppointmentsPaged({ scope: "history", page, size: PAGE_SIZE })
      .then(res => {
        if (cancelled) return;
        setItems(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(res.totalPages);
      })
      .catch(e => { if (!cancelled) setError((e as Error).message || t("patHistory.loadError")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reloadNonce]);

  // Tarixi olmayan sətirlər göstərilmir — server siyahısının içindəki filtrdir.
  const rows = useMemo(() => items.filter(a => a.startAt || a.endAt), [items]);

  const columns = useMemo(() => buildColumns(t), [t]);

  const retry = useCallback(() => setReloadNonce(n => n + 1), []);

  return (
    <div className="psy-appt-page">
      <header style={{ marginBottom: 22 }}>
        <Link href="/patient/appointments" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {t("patHistory.back")}
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>{t("patHistory.title")}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          {t("patHistory.sub")}
        </p>
      </header>

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={a => a.id}
          loading={loading}
          error={error}
          onRetry={retry}
          mobile="cards"
          empty={{
            title: t("patHistory.emptyTitle"),
            body: t("patHistory.emptyBody"),
          }}
          pagination={{
            page: page + 1,
            pageCount: Math.max(1, totalPages),
            onChange: p => setPage(p - 1),
          }}
          totalLabel={t("patHistory.total", { n: totalElements })}
        />
      </Card>
    </div>
  );
}
