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

function cancelledByLabel(by?: string | null): string {
  if (by === "PATIENT") return "Siz ləğv etdiniz";
  if (by === "PSYCHOLOGIST") return "Psixoloq ləğv etdi";
  if (by === "OPERATOR") return "Operator ləğv etdi";
  return "Ləğv edildi";
}

function kindOf(a: AppointmentDetail): string {
  if (a.sessionKind === "INTRO") return "Tanışlıq, pulsuz";
  if (a.patientPackageId != null) return a.packageName || "Paket seansı";
  return "Fərdi seans";
}

const COLUMNS: Column<AppointmentDetail>[] = [
  {
    key: "date",
    header: "Tarix",
    cell: a => (
      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
        {azFormatDate((a.startAt ?? a.endAt)!)}
      </span>
    ),
  },
  {
    key: "psychologist",
    header: "Psixoloq",
    cell: a => {
      const isCancelled = a.status === "CANCELLED";
      const reasonTxt =
        a.cancelReasonCode && a.cancelReasonCode !== "PATIENT_OTHER"
          ? reasonLabel(a.cancelReasonCode)
          : "";
      const showCancelMeta = isCancelled && (a.cancelledBy || reasonTxt || a.cancelReasonText);
      return (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{a.psychologistName ?? "Psixoloq"}</div>
          {showCancelMeta && (
            // Ayrı sətirlər — çip və ya "·" ayırıcısı işlədilmir.
            <div className="fx-row__meta" style={{ marginTop: 3 }}>
              <div>{cancelledByLabel(a.cancelledBy)}</div>
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
    header: "Növ",
    hideOnMobile: true,
    cell: a => <span style={{ whiteSpace: "nowrap" }}>{kindOf(a)}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: a => {
      const meta = STATUS[a.status] ?? STATUS.COMPLETED;
      return <Status tone={STATUS_TONE[a.status] ?? "neutral"}>{meta.label}</Status>;
    },
  },
];

export default function PatientAppointmentHistoryPage() {
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
      .catch(e => { if (!cancelled) setError((e as Error).message || "Seans tarixçəsi yüklənmədi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, reloadNonce]);

  // Tarixi olmayan sətirlər göstərilmir — server siyahısının içindəki filtrdir.
  const rows = useMemo(() => items.filter(a => a.startAt || a.endAt), [items]);

  const retry = useCallback(() => setReloadNonce(n => n + 1), []);

  return (
    <div className="psy-appt-page">
      <header style={{ marginBottom: 22 }}>
        <Link href="/patient/appointments" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Randevulara qayıt
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>Seans tarixçəsi</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          Keçmiş seanslarınız
        </p>
      </header>

      <Card>
        <DataTable
          rows={rows}
          columns={COLUMNS}
          rowKey={a => a.id}
          loading={loading}
          error={error}
          onRetry={retry}
          mobile="cards"
          empty={{
            title: "Hələ tamamlanmış seansınız yoxdur",
            body: "Seans keçirildikdən və ya ləğv edildikdən sonra qeyd burada görünəcək.",
          }}
          pagination={{
            page: page + 1,
            pageCount: Math.max(1, totalPages),
            onChange: p => setPage(p - 1),
          }}
          totalLabel={`Cəmi ${totalElements} seans`}
        />
      </Card>
    </div>
  );
}
