"use client";

// ============================================================================
// Paket detalı — paket məlumatı (psixoloq, balans, ödəniş) + paketin bütün
// seansları (tamamlanan, planlanan, planlanmamış slotlar) + yeni seans tələbi.
// Əsas səhifədəki "Paketlər" tabındakı kartdan açılır.
// ============================================================================

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  patientApi,
  type AppointmentDetail,
  type AvailableSlot,
  type PatientPackageItem,
} from "@/lib/api";
import { azFormatDate, azFormatTime, azOrdinal, azLocalToISO } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";
import DatePicker from "@/components/DatePicker";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import JoinSessionButton from "@/components/JoinSessionButton";
import { toast } from "@/components/Toast";
import { STATUS, PKG_STATUS, PA_STYLE, SlotPicker, initialsOf } from "../../shared";

export default function PatientPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const packageId = Number(id);

  const [pkg, setPkg] = useState<PatientPackageItem | null>(null);
  const [sessions, setSessions] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date());
  // Əl ilə daxiletmə — tarix + saat birlikdə (withTime DatePicker).
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDateTime, setManualDateTime] = useState("");
  // Modal portal-la body-yə render olunur (transform-lu ata `position:fixed`-i
  // pozmasın deyə); SSR-də portal olmadığı üçün mount yoxlanır.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.myPackages().catch(() => [] as PatientPackageItem[]),
      patientApi.myAppointments().catch(() => [] as AppointmentDetail[]),
    ])
      .then(([pkgs, appts]) => {
        setPkg(pkgs.find(p => p.id === packageId) ?? null);
        setSessions(appts
          .filter(a => a.patientPackageId === packageId)
          .sort((a, b) =>
            new Date(a.startAt ?? a.requestedStartAt ?? a.createdAt).getTime()
            - new Date(b.startAt ?? b.requestedStartAt ?? b.createdAt).getTime()));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [packageId]);

  const completed = useMemo(() => sessions.filter(a => a.status === "COMPLETED").length, [sessions]);
  const planned = useMemo(() => sessions.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").length, [sessions]);

  const scheduleSlot = async (slot: AvailableSlot) => {
    setBusy(true);
    try {
      await patientApi.schedulePackageSession(packageId, { startAt: slot.startAt });
      setPlanning(false); setBusy(false);
      load();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  // Əl ilə seçilmiş vaxt — slot ilə eyni axın: operatora gedir, təsdiqdən sonra
  // randevuya çevrilir. Backend iş qrafikini/dolu vaxtı yoxlayır (uyğun deyilsə xəta).
  const scheduleManual = async () => {
    if (!manualDateTime) { toast("Tarix və saat seçin", "error"); return; }
    setBusy(true);
    try {
      await patientApi.schedulePackageSession(packageId, { startAt: azLocalToISO(manualDateTime) });
      setPlanning(false); setManualOpen(false); setManualDateTime(""); setBusy(false);
      load();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  const backLink = (
    <Link href="/patient/appointments?tab=paketler" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      Randevulara qayıt
    </Link>
  );

  if (loading) {
    return (
      <div className="psy-appt-page" style={{ width: "100%" }}>
        {backLink}
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="psy-appt-page" style={{ width: "100%" }}>
        {backLink}
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          Paket tapılmadı
        </div>
      </div>
    );
  }

  const st = PKG_STATUS[pkg.status] ?? PKG_STATUS.ACTIVE;
  const completedPct = pkg.total > 0 ? (completed / pkg.total) * 100 : 0;
  const plannedPct = pkg.total > 0 ? (planned / pkg.total) * 100 : 0;
  const canSchedule = pkg.status === "ACTIVE" && pkg.remaining > 0;

  return (
    <div className="psy-appt-page" style={{ width: "100%" }}>
      <style>{PA_STYLE}</style>
      {backLink}

      {/* ── Paket məlumat kartı ── */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
            </svg>
            Paket
          </span>
          <span style={{ background: st.bg, color: st.color, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>{st.label}</span>
        </div>

        <h1 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>{pkg.packageName}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--oxford)", fontWeight: 600, marginBottom: 18 }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
            {initialsOf(pkg.psychologistName)}
          </span>
          {pkg.psychologistName}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>
              {/* pkg.remaining = planlaşdırılmamış rezerv; "qalıb" kimi oxunmasın deyə aşağıda ayrıca göstərilir. */}
              <span>{completed}/{pkg.total} seans keçirilib</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}>{Math.round(completedPct)}%</span>
          </div>
          <div style={{ display: "flex", height: 9, background: "var(--brand-100)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${completedPct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)" }} />
            <div style={{ width: `${plannedPct}%`, height: "100%", background: "#9DBCEB" }} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1051B7", flex: "none" }} />{completed} keçirilib</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9DBCEB", flex: "none" }} />{planned} planlanıb</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-100)", flex: "none" }} />{pkg.remaining} planlanmamış</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 130, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Ödənilib</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{formatAzn(pkg.pricePaid)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 130, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Alınıb</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{azFormatDate(pkg.purchasedAt)}</div>
          </div>
        </div>

        {pkg.status === "ACTIVE" && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--brand-50)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "9px 12px", marginTop: 14, fontSize: 12.5, color: "var(--brand-700)", fontWeight: 600, lineHeight: 1.45 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: "none", marginTop: 2 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
            <span>Bu psixoloqla aldığınız yeni seanslar, balans qaldıqca, avtomatik bu paketdən hesablanır.</span>
          </div>
        )}
      </div>

      {/* ── Seanslar ── */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--oxford)", marginBottom: 12 }}>
          Paketin seansları
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((a, i) => (
            <SessionRow key={a.id} a={a} ordinal={i + 1} now={now} />
          ))}
          {Array.from({ length: Math.max(0, pkg.remaining) }, (_, i) => (
            <div key={`empty-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFD", border: "1px dashed #C7DAF5", borderRadius: 12, padding: "12px 15px" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford-60)", minWidth: 74 }}>{azOrdinal(sessions.length + i + 1)} seans</span>
              <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>Hələ planlanmayıb</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Yeni seans tələbi — düymə; panel popup-da açılır ── */}
      {canSchedule && (
        <button
          type="button"
          onClick={() => setPlanning(true)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 14px rgba(16,81,183,.24)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          Seans planla
        </button>
      )}

      {/* ── Planlama popup-u — body-yə portal (transform-lu ata position:fixed-i pozmasın) ── */}
      {canSchedule && planning && mounted && createPortal(
        <div onClick={() => setPlanning(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(8,47,109,.45)", backdropFilter: "blur(4px)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "paFade .18s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, width: "min(520px, 100%)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 70px rgba(8,47,109,.28)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 22px 16px", borderBottom: "1px solid #F0F4FA" }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-100)", color: "var(--brand-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--oxford)" }}>Seans planla</div>
                <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 2, lineHeight: 1.45 }}>
                  Seçdiyiniz vaxt operatora gedəcək, təsdiqdən sonra randevuya çevriləcək.
                </div>
              </div>
              <button type="button" onClick={() => setPlanning(false)} aria-label="Bağla"
                style={{ width: 34, height: 34, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F2F6FD", border: "none", borderRadius: 9, color: "var(--oxford-60)", cursor: "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ padding: "18px 22px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-700)", marginBottom: 10 }}>Psixoloqun açıq vaxtından seçin</div>
              <SlotPicker psychologistId={pkg.psychologistId} busy={busy} onPick={scheduleSlot}
                confirmNote="Seçdiyiniz vaxt operatora göndəriləcək, təsdiqdən sonra randevuya çevriləcək." />

              {/* Əl ilə daxiletmə — boş saat siyahısında olmayan vaxt üçün. */}
              <button type="button" onClick={() => setManualOpen(o => !o)}
                style={{ marginTop: 14, background: "none", border: "none", color: "var(--brand-700)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                {manualOpen ? "Əl ilə daxiletməni gizlət" : "Və ya vaxtı əl ilə daxil et"}
              </button>
              {manualOpen && (
                <div style={{ marginTop: 10, background: "var(--brand-50)", border: "1px solid #D6E2F7", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {/* Tarix + saat BİRLİKDƏ — tək withTime DatePicker. */}
                    <DatePicker withTime value={manualDateTime} onChange={v => setManualDateTime(v)} placeholder="gg.aa.iiii ss:dd" theme="light" size="sm" style={{ flex: "1 1 200px" }} />
                    <button type="button" onClick={scheduleManual} disabled={busy}
                      style={{ flex: "none", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
                      {busy ? "Göndərilir…" : "Göndər"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--oxford-60)", marginTop: 8, lineHeight: 1.5 }}>
                    Seçdiyiniz vaxt operatora göndəriləcək, təsdiqdən sonra randevuya çevriləcək.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── Paket seans sətri ──────────────────────────────────────────────────── */

function SessionRow({ a, ordinal, now }: { a: AppointmentDetail; ordinal: number; now: Date }) {
  const st = STATUS[a.status] ?? STATUS.PENDING;
  const when = a.startAt ?? a.requestedStartAt;
  const isUpcoming = !!a.startAt
    && new Date(a.startAt).getTime() > now.getTime()
    && (a.status === "ASSIGNED" || a.status === "CONFIRMED");
  const isDone = a.status === "COMPLETED";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: "12px 15px", opacity: isDone ? .8 : 1 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? "var(--oxford-60)" : "var(--oxford)", minWidth: 74 }}>{azOrdinal(ordinal)} seans</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>
        {when ? `${azFormatDate(when)}, ${azFormatTime(when)}` : "Operator vaxtı təyin edəcək"}
      </span>
      <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{st.label}</span>
      <span style={{ flex: 1 }} />
      {isUpcoming && (
        <div style={{ display: "flex", gap: 7 }}>
          <JoinSessionButton appointment={a} variant="compact" />
          <AddToCalendarMenu appointment={a} variant="compact" />
        </div>
      )}
    </div>
  );
}
