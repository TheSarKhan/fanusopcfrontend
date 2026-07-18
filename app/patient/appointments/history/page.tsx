"use client";

// ============================================================================
// Seans tarixçəsi — tamamlanmış / ləğv edilmiş / rədd edilmiş seansların
// server-səhifələnmiş cədvəli (datatable). Rəy yazmaq artıq "Psixoloqlar"
// bölməsindən verilir; bu səhifə yalnız oxu-tarixçədir.
// ============================================================================

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  patientApi,
  reasonLabel,
  type AppointmentDetail,
} from "@/lib/api";
import { azFormatDate } from "@/lib/datetime";
import { STATUS, PA_STYLE } from "../shared";

const PAGE_SIZE = 30;

const HIST_STYLE = `
.hist-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.hist-tbl th{text-align:left;padding:11px 16px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--oxford-60);border-bottom:1px solid #EDF1F8;white-space:nowrap;background:#FAFCFE}
.hist-tbl td{padding:13px 16px;border-bottom:1px solid #F0F4FA;color:var(--oxford);vertical-align:top}
.hist-tbl tbody tr:last-child td{border-bottom:none}
.hist-tbl tbody tr:hover td{background:#F8FAFD}
`;

export default function PatientAppointmentHistoryPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    patientApi.myAppointmentsPaged({ scope: "history", page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    patientApi.myAppointmentsPaged({ scope: "history", page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setPage(res.page);
        setTotalElements(res.totalElements);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // Server tarixçə statuslarına görə filtrləyib DESC sıralayır — tarixi olmayan sətirlər buraxılır.
  const rows = useMemo(() => items.filter(a => a.startAt || a.endAt), [items]);

  return (
    <div className="psy-appt-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{PA_STYLE}{HIST_STYLE}</style>
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

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          Hələ tamamlanmış seansınız yoxdur
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="hist-tbl">
                <thead>
                  <tr>
                    <th>Tarix</th>
                    <th>Psixoloq</th>
                    <th>Növ</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => <HistoryRow key={a.id} a={a} />)}
                </tbody>
              </table>
            </div>
          </div>

          {items.length < totalElements && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? .6 : 1 }}>
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Cədvəl sətri — bir seans ────────────────────────────────────────────── */

function HistoryRow({ a }: { a: AppointmentDetail }) {
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  const isCancelled = a.status === "CANCELLED";
  const cancelWho = a.cancelledBy === "PATIENT" ? "Siz ləğv etdiniz"
    : a.cancelledBy === "PSYCHOLOGIST" ? "Psixoloq ləğv etdi"
    : a.cancelledBy === "OPERATOR" ? "Operator ləğv etdi" : "Ləğv edildi";
  const cancelReasonTxt = a.cancelReasonCode && a.cancelReasonCode !== "PATIENT_OTHER" ? reasonLabel(a.cancelReasonCode) : "";
  const kind = a.sessionKind === "INTRO" ? "Tanışlıq · pulsuz"
    : a.patientPackageId != null ? (a.packageName || "Paket seansı")
    : "Fərdi seans";
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{azFormatDate(ref)}</td>
      <td>
        <span style={{ fontWeight: 600 }}>{a.psychologistName ?? "Psixoloq"}</span>
        {isCancelled && (a.cancelledBy || cancelReasonTxt || a.cancelReasonText) && (
          <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>
            <span style={{ color: "#991B1B", fontWeight: 600 }}>{cancelWho}</span>
            {cancelReasonTxt && <> · {cancelReasonTxt}</>}
            {a.cancelReasonText && <> · «{a.cancelReasonText}»</>}
          </div>
        )}
      </td>
      <td style={{ color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{kind}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color, flex: "none" }} aria-hidden />
          {status.label}
        </span>
      </td>
    </tr>
  );
}
