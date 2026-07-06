"use client";

// Modul H — operator müştəri profili (360° görünüş). Yalnız oxunan.
// Pasiyentin qeydiyyatı, seans bölgüsü, ödənişlər, paketlər, test nəticələri,
// rəylər və fəaliyyət lenti bir səhifədə. Modul G məxfi sahələri açıq işarələnir.

import { use, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { operatorApi, type CustomerProfile, type Psychologist, type PackageDto, type AvailableSlot } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { isoToAzLocal, azFormatDate, azFormatTime, azLocalToISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast } from "@/components/Toast";
import { confirmDialog } from "@/components/ConfirmDialog";
import DatePicker from "@/components/DatePicker";
import OnBehalfBookingModal from "@/components/OnBehalfBookingModal";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** datetime-local stringinə dəqiqə əlavə edir, yenə datetime-local formatı qaytarır. */
function addMinutes(local: string, mins: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setMinutes(d.getMinutes() + mins);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function dateOnly(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Gözlənilir",
  NEW: "Yeni",
  REJECTED: "Yenidən təyin",
  IN_REVIEW: "Operatorda",
  ASSIGNED: "Təyin edilib",
  CONFIRMED: "Təsdiqlənib",
  AWAITING_CONFIRMATION: "Təsdiq gözlənir",
  DISPUTED: "Mübahisəli",
  COMPLETED: "Tamamlanıb",
  CANCELLED: "Ləğv edilib",
  CANCEL_REQUESTED: "Ləğv gözlənir",
  PAID: "Ödənilib",
  PARTIALLY_REFUNDED: "Qismi qaytarılıb",
  REFUNDED: "Geri qaytarılıb",
  ACTIVE: "Aktiv",
  EXPIRED: "Bitib",
  PUBLISHED: "Dərc edilib",
  HIDDEN: "Gizli",
};
function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

const FLAG_LABEL: Record<string, string> = {
  HIGH_NO_SHOW: "Yüksək no-show",
  HIGH_LATE_CANCEL: "Yüksək gec ləğv",
  HIGH_REJECT: "Yüksək rədd",
};

const ACTIVITY_LABEL: Record<string, { text: string; tone: "brand" | "good" | "warn" | "neutral" }> = {
  AUDIT: { text: "Audit", tone: "neutral" },
  SUPPORT: { text: "Dəstək", tone: "warn" },
  APPOINTMENT: { text: "Randevu", tone: "brand" },
  TEST: { text: "Test", tone: "good" },
};

export default function OperatorCustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 16 — route params artıq Promise-dir, React `use()` ilə açılır.
  const { id: idStr } = use(params);
  const patientId = Number(idStr);
  const { t } = useT();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellMode, setSellMode] = useState<"catalog" | "custom" | "single">("catalog");
  const [bookOpen, setBookOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [schedulePkg, setSchedulePkg] = useState<CustomerProfile["packages"][number] | null>(null);

  useEffect(() => {
    if (!Number.isFinite(patientId)) { setError(true); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(false);
    operatorApi.customerProfile(patientId)
      .then(p => { if (alive) setProfile(p); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [patientId, reloadKey]);

  const toggleBlock = async () => {
    const h = profile?.history;
    if (!h?.userId || blocking) return;
    if (h.blocked) {
      if (!(await confirmDialog({ title: "Bloku aç", message: "Bu istifadəçinin blokunu açmaq istəyirsiniz?", confirmLabel: "Aç" }))) return;
    } else {
      if (!(await confirmDialog({ title: "İstifadəçini blokla", message: "Bu pasiyenti bloklamaq istəyirsiniz?", confirmLabel: "Blokla", danger: true }))) return;
    }
    setBlocking(true);
    try {
      if (h.blocked) { await operatorApi.unblockUser(h.userId); toast("Blok açıldı", "success"); }
      else { await operatorApi.blockUser(h.userId, ""); toast("İstifadəçi bloklandı", "success"); }
      setReloadKey(k => k + 1);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBlocking(false);
    }
  };

  if (loading) {
    return <div className="op-loading">{t("common.loading")}</div>;
  }
  if (error || !profile) {
    return (
      <div className="op-error">
        Müştəri profili yüklənmədi.{" "}
        <Link href="/operator/customers" style={{ color: "inherit", textDecoration: "underline" }}>
          Axtarışa qayıt
        </Link>
      </div>
    );
  }

  const h = profile.history;
  const totalAppointments = h.totalAppointments;

  return (
    <div className="op-analytics">
      {sellOpen && (
        <SellPackageModal
          patientId={patientId}
          initialMode={sellMode}
          onClose={() => setSellOpen(false)}
          onDone={(name, isSingle) => { setSellOpen(false); setReloadKey(k => k + 1); toast(isSingle ? "Tək seans satıldı · ödəniş PENDING" : `Paket satıldı: ${name} · ödəniş PENDING`, "success"); }}
        />
      )}
      {schedulePkg && (
        <SchedulePackageSessionModal
          patientId={patientId}
          pkg={schedulePkg}
          onClose={() => setSchedulePkg(null)}
          onDone={() => { setSchedulePkg(null); setReloadKey(k => k + 1); toast("Seans planlandı · təsdiqləndi", "success"); }}
        />
      )}
      {bookOpen && (
        <OnBehalfBookingModal
          presetPatientId={patientId}
          presetPatientLabel={h.name}
          onClose={() => setBookOpen(false)}
          onDone={() => { setBookOpen(false); setReloadKey(k => k + 1); toast("Randevu yaradıldı", "success"); }}
        />
      )}
      <header className="op-analytics__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>{h.name}</h1>
          <p>Müştəri profili · #{patientId}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setBookOpen(true)}
            style={{ padding: "8px 14px", border: "none", borderRadius: 10, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + Randevu yarat
          </button>
          <button onClick={toggleBlock} disabled={blocking}
            style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", border: h.blocked ? "1px solid #A7F3D0" : "1px solid #FECACA", background: "#fff", color: h.blocked ? "#065F46" : "#991B1B" }}>
            {h.blocked ? "Bloku aç" : "Blokla"}
          </button>
          <Link href="/operator/customers" className="op-kpi" style={{ flex: "0 0 auto", padding: "8px 14px", textDecoration: "none", fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>
            ← Axtarış
          </Link>
        </div>
      </header>

      {/* (a) Şəxsi / qeydiyyat kartı */}
      <div className="op-card">
        <div className="op-card__head">
          <div>
            <h2>Şəxsi məlumat</h2>
            <p>Qeydiyyat və əlaqə</p>
          </div>
          {h.autoFlag && (
            <span className="op-card__count" data-tone="danger" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              ⚑ {FLAG_LABEL[h.autoFlag] ?? h.autoFlag}
            </span>
          )}
        </div>
        <div className="op-card__body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Ad, soyad" value={h.name} />
            <Field label="Email" value={h.email ?? "—"} />
            <Field label="Telefon" value={h.phone ?? "—"} />
            <Field label="Qeydiyyat tarixi" value={fmtDate(h.registeredAt)} />
            <Field label="Son giriş" value={fmtDateTime(profile.lastLogin)} />
            <Field
              label="Status"
              value={h.blocked ? "Bloklu" : "Aktiv"}
              valueColor={h.blocked ? "#991B1B" : "#065F46"}
            />
          </div>

          {h.blocked && h.blockReason && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#991B1B" }}>Blok səbəbi: {h.blockReason}</div>
          )}

          {/* Modul G — məxfi təcili əlaqə + ünvan */}
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
              Məxfi · yalnız təcili hallar üçün
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Field label="Təcili əlaqə (ad)" value={h.emergencyContactName ?? "—"} />
              <Field label="Təcili əlaqə (telefon)" value={h.emergencyContactPhone ?? "—"} />
              <Field label="Yaxınlıq dərəcəsi" value={h.emergencyContactRelation ?? "—"} />
              <Field label="Yaşayış ünvanı" value={h.residentialAddress ?? "—"} />
            </div>
          </div>
        </div>
      </div>

      {/* (b) Seans bölgüsü KPI lenti */}
      <div className="op-kpis">
        <KpiBox label="Cəmi randevu" value={totalAppointments} tone="brand" />
        <KpiBox label="Aktiv" value={profile.activeCount} tone="warn" />
        <KpiBox label="Tamamlanıb" value={profile.completedCount} tone="good" />
        <KpiBox label="Ləğv edilib" value={profile.cancelledCount} tone="neutral" />
        <KpiBox label="No-show" value={h.noShowCount} tone={h.noShowCount >= 3 ? "danger" : "neutral"} />
        <KpiBox label="Gec ləğv" value={h.lateCancelCount} tone={h.lateCancelCount >= 5 ? "danger" : "neutral"} />
      </div>

      {/* (c) Ödəniş tarixçəsi */}
      <div className="op-card">
        <div className="op-card__head">
          <div><h2>Ödəniş tarixçəsi</h2><p>Bütün ödənişlər</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { setSellMode("single"); setSellOpen(true); }}
              style={{ padding: "7px 14px", border: "none", borderRadius: 10, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              + Tək seans sat
            </button>
            <span className="op-card__count">{profile.payments.length}</span>
          </div>
        </div>
        <div className="op-card__body">
          {profile.payments.length === 0 ? (
            <div className="op-empty">Ödəniş qeydi yoxdur</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>Məbləğ</Th>
                    <Th>Status</Th>
                    <Th>Üsul</Th>
                    <Th>Tip</Th>
                    <Th>Tarix</Th>
                  </tr>
                </thead>
                <tbody>
                  {profile.payments.map(p => {
                    const refunded = p.refundedAmount ?? 0;
                    return (
                      <tr key={p.id}>
                        <Td>
                          <strong style={{ color: "var(--oxford)" }}>{formatAzn(p.amount)}</strong>
                          {refunded > 0 && <div style={{ fontSize: 11, color: "#9A3412", fontWeight: 600 }}>−{formatAzn(refunded)} qaytarıldı</div>}
                        </Td>
                        <Td>
                          <StatusPill status={p.status} />
                          {p.statusNote && <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 2, fontStyle: "italic", maxWidth: 220 }}>«{p.statusNote}»</div>}
                        </Td>
                        <Td>{p.method || "—"}</Td>
                        <Td>{p.patientPackageId != null ? "Paket" : "Tək seans"}</Td>
                        <Td>{fmtDateTime(p.paidAt ?? p.createdAt)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* (d) Paketlər */}
      <div className="op-card">
        <div className="op-card__head">
          <div><h2>Paketlər</h2><p>Alınmış seans paketləri</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { setSellMode("catalog"); setSellOpen(true); }}
              style={{ padding: "7px 14px", border: "none", borderRadius: 10, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              + Paket sat
            </button>
            <span className="op-card__count">{profile.packages.length}</span>
          </div>
        </div>
        <div className="op-card__body">
          {profile.packages.length === 0 ? (
            <div className="op-empty">Paket yoxdur</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {profile.packages.map(pkg => {
                const st = PKG_STATUS[pkg.status] ?? PKG_STATUS.ACTIVE;
                const pay = profile.payments.find(pm => pm.patientPackageId === pkg.id);
                const paid = pay?.status === "PAID";
                const used = Math.max(0, pkg.total - pkg.remaining);
                const pct = pkg.total > 0 ? Math.round((used / pkg.total) * 100) : 0;
                const done = pkg.status === "EXHAUSTED";
                return (
                  <div key={pkg.id} style={{ border: "1px solid #EDF1F8", borderRadius: 12, padding: 15 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{pkg.packageName}</span>
                        <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{st.label}</span>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: paid ? "#D1FAE5" : "#FEF3C7", color: paid ? "#065F46" : "#92400E", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>
                        {paid
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
                        {paid ? "Ödənildi" : "Ödəniş gözlənir"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 11 }}>
                      {pkg.remaining}/{pkg.total} qalıb{pkg.psychologistName ? ` · ${pkg.psychologistName}` : ""}{pkg.pricePaid != null ? ` · ${formatAzn(pkg.pricePaid)}` : ""}{pkg.purchasedAt ? ` · alınıb ${fmtDate(pkg.purchasedAt)}` : ""}
                    </div>
                    <div style={{ height: 8, background: done ? "#D1FAE5" : "#E4ECFA", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: done ? "#10B981" : "linear-gradient(90deg,#1051B7,#3A74D6)", borderRadius: 999 }} />
                    </div>
                    {pkg.status === "ACTIVE" && pkg.remaining > 0 && pkg.psychologistId != null && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 11 }}>
                        <button type="button" onClick={() => setSchedulePkg(pkg)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid var(--brand)", borderRadius: 9, background: "#fff", color: "var(--brand-700)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></svg>
                          Seans planla
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* (e) Test nəticələri */}
      <div className="op-card">
        <div className="op-card__head">
          <div><h2>Test nəticələri</h2><p>Psixoloji test nəticələri</p></div>
          <span className="op-card__count">{profile.testResults.length}</span>
        </div>
        <div className="op-card__body">
          {profile.testResults.length === 0 ? (
            <div className="op-empty">Test nəticəsi yoxdur</div>
          ) : (
            <div className="op-list">
              {profile.testResults.map(tr => (
                <div key={tr.assignmentId} className="op-row">
                  <div className="op-row__main">
                    <div className="op-row__name">
                      {tr.testTitle}
                      <span className="op-row__badge" data-tone="good" style={{ marginLeft: 6 }}>
                        {statusLabel(tr.status)}
                      </span>
                    </div>
                    <div className="op-row__meta">
                      {tr.totalScore != null && tr.maxScore != null && (
                        <span>Bal: {tr.totalScore} / {tr.maxScore}</span>
                      )}
                      {tr.percentage != null && <span>· {Math.round(tr.percentage)}%</span>}
                      {tr.scaleLabel && <span>· {tr.scaleLabel}</span>}
                      {tr.submittedAt && <span>· {fmtDate(tr.submittedAt)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* (f) Verilmiş rəylər */}
      <div className="op-card">
        <div className="op-card__head">
          <div><h2>Verilmiş rəylər</h2><p>Müştərinin yazdığı rəylər</p></div>
          <span className="op-card__count">{profile.reviewsGiven.length}</span>
        </div>
        <div className="op-card__body">
          {profile.reviewsGiven.length === 0 ? (
            <div className="op-empty">Rəy yoxdur</div>
          ) : (
            <div className="op-list">
              {profile.reviewsGiven.map(r => (
                <div key={r.id} className="op-row">
                  <div className="op-row__main">
                    <div className="op-row__name">
                      {r.psychologistName ?? "—"}
                      <span style={{ marginLeft: 8, color: "#F59E0B", fontWeight: 700, letterSpacing: 1 }}>
                        {"★".repeat(Math.max(0, Math.min(5, Math.round(r.rating))))}
                        <span style={{ color: "#D1D5DB" }}>
                          {"★".repeat(Math.max(0, 5 - Math.min(5, Math.round(r.rating))))}
                        </span>
                      </span>
                      <span className="op-row__badge" data-tone="neutral" style={{ marginLeft: 6 }}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <div className="op-row__meta">
                      {r.comment && <span>«{r.comment}»</span>}
                      {r.createdAt && <span>· {fmtDate(r.createdAt)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* (g) Fəaliyyət lenti */}
      <div className="op-card">
        <div className="op-card__head">
          <div><h2>Fəaliyyət lenti</h2><p>Hesab üzrə son hadisələr</p></div>
          <span className="op-card__count">{profile.activity.length}</span>
        </div>
        <div className="op-card__body">
          {profile.activity.length === 0 ? (
            <div className="op-empty">Fəaliyyət qeydi yoxdur</div>
          ) : (
            <div className="op-list">
              {profile.activity.map((ev, i) => {
                const meta = ACTIVITY_LABEL[ev.type] ?? { text: ev.type, tone: "neutral" as const };
                return (
                  <div key={`${ev.at}-${i}`} className="op-row">
                    <div className="op-row__main">
                      <div className="op-row__name">
                        <span className="op-row__badge" data-tone={meta.tone}>{meta.text}</span>
                        {ev.action && <span style={{ marginLeft: 8, fontWeight: 600 }}>{ev.action}</span>}
                      </div>
                      <div className="op-row__meta">
                        {ev.summary && <span>{ev.summary}</span>}
                        <span>· {fmtDateTime(ev.at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Building blocks ────────────────────────────────────────────────────── */

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: valueColor ?? "var(--oxford)", fontWeight: 600, marginTop: 2, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function KpiBox({ label, value, tone }: { label: string; value: number; tone: "brand" | "good" | "warn" | "danger" | "neutral" }) {
  return (
    <div className="op-kpi" data-tone={tone}>
      <div className="op-kpi__label">{label}</div>
      <div className="op-kpi__value" data-tone={tone}>{value}</div>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1px solid #EFF2F7" }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "9px 10px", color: "var(--oxford)", borderBottom: "1px solid #F4F6FA", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}

/* ─── Paket status + avatar köməkçiləri ──────────────────────────────────── */
const PKG_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: "Aktiv",       bg: "#D1FAE5", color: "#065F46" },
  EXHAUSTED: { label: "Tamamlanıb",  bg: "#F3F4F6", color: "#374151" },
  EXPIRED:   { label: "Vaxtı keçib", bg: "#FEF3C7", color: "#92400E" },
  CANCELLED: { label: "Ləğv",        bg: "#FEE2E2", color: "#991B1B" },
};
const SELL_TINTS = [
  { bg: "#E0EBFA", fg: "#1E3A8A" }, { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" }, { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" }, { bg: "#CCFBF1", fg: "#115E59" },
];
function sellTint(name?: string | null) {
  const s = name ?? "?"; let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SELL_TINTS[h % SELL_TINTS.length];
}
function sellInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/* ─── Paket satışı modalı (operator) ─────────────────────────────────────── */

function SellPackageModal({ patientId, initialMode = "catalog", onClose, onDone }: {
  patientId: number;
  initialMode?: "catalog" | "custom" | "single";
  onClose: () => void;
  onDone: (displayName: string, isSingle: boolean) => void;
}) {
  const [psys, setPsys] = useState<Psychologist[]>([]);
  const [psyId, setPsyId] = useState<number | null>(null);
  const [mode, setMode] = useState<"catalog" | "custom" | "single">(initialMode);
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [loadingCat, setLoadingCat] = useState(false);
  // xüsusi
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");
  // tək seans
  const [singleName, setSingleName] = useState("");
  const [singlePrice, setSinglePrice] = useState("");
  const [singleStart, setSingleStart] = useState("");
  const [singleEnd, setSingleEnd] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { operatorApi.listPsychologists().then(setPsys).catch(() => {}); }, []);

  // Tək seans rejimi: seçilmiş psixoloqun fərdi seans qiymətini avtomatik doldur (redaktə oluna bilir).
  useEffect(() => {
    if (mode !== "single" || psyId == null) return;
    const p = psys.find(x => x.id === psyId);
    if (p && p.individualPrice != null) setSinglePrice(String(p.individualPrice));
  }, [psyId, mode, psys]);

  // Tək seans rejimi: psixoloqun boş saatlarını (yaxın 3 həftə) yüklə.
  useEffect(() => {
    if (mode !== "single" || psyId == null) { setSlots([]); return; }
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, dateOnly(today), dateOnly(to))
      .then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [mode, psyId]);

  // Psixoloq dəyişəndə vaxt seçimini sıfırla.
  useEffect(() => { setSingleStart(""); setSingleEnd(""); }, [psyId]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  useEffect(() => {
    setCatalog([]); setCatalogId(null);
    if (!psyId) return;
    setLoadingCat(true);
    operatorApi.psychologistPackages(psyId)
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCat(false));
  }, [psyId]);

  // Tək seansın müddəti — seçilmiş psixoloqun CARİ standart müddəti (backend
  // onsuz da endAt-ı bundan hesablayır; burada preview/label yanlış olmasın).
  const selPsy = psys.find(p => p.id === psyId) ?? null;
  const sessionMin = selPsy?.defaultSessionMinutes ?? 50;

  const submit = async () => {
    setErr(null);
    if (!psyId) { setErr("Psixoloq seçin"); return; }

    // Tək seans — paketsiz, birbaşa PENDING ödəniş.
    if (mode === "single") {
      const p = Number(singlePrice);
      if (!Number.isFinite(p) || p < 0) { setErr("Qiymət düzgün deyil"); return; }
      if (!singleStart) { setErr("Seans vaxtını seçin"); return; }
      setSaving(true);
      try {
        await operatorApi.sellSingleSession(patientId, {
          psychologistId: psyId, price: p, startAt: singleStart, endAt: singleEnd || addMinutes(singleStart, sessionMin),
        });
        onDone(singleName.trim() || "Tək seans", true);
      } catch (e) {
        setErr((e as Error).message);
        setSaving(false);
      }
      return;
    }

    // Paket — kataloq və ya xüsusi.
    let payload: Parameters<typeof operatorApi.sellPackage>[1];
    let displayName: string;
    if (mode === "catalog") {
      if (!catalogId) { setErr("Kataloqdan paket seçin"); return; }
      payload = { sessionPackageId: catalogId };
      displayName = catalog.find(c => c.id === catalogId)?.name ?? "Paket";
    } else {
      const s = Number(sessions), p = Number(price);
      if (!Number.isFinite(s) || s < 1) { setErr("Seans sayı düzgün deyil"); return; }
      if (!Number.isFinite(p) || p < 0) { setErr("Qiymət düzgün deyil"); return; }
      payload = { psychologistId: psyId, packageName: name.trim() || undefined, sessionCount: s, price: p };
      displayName = name.trim() || `${s} seanslıq paket`;
    }
    setSaving(true);
    try {
      await operatorApi.sellPackage(patientId, payload);
      onDone(displayName, false);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  // Seçim xülasəsi
  const selCat = catalog.find(c => c.id === catalogId) ?? null;
  let summaryName = "—", summaryMeta = "";
  let hasSelection = false;
  if (mode === "single") {
    hasSelection = psyId != null;
    summaryName = singleName.trim() || "Tək seans";
    summaryMeta = `1 seans · ${formatAzn(Number(singlePrice) || 0)} · ${singleStart ? fmtDateTime(singleStart) : "tarix seçilməyib"}`;
  } else if (mode === "custom") {
    const s = Number(sessions) || 0, pr = Number(price) || 0;
    hasSelection = s > 0 || pr > 0 || !!name.trim();
    if (hasSelection) {
      summaryName = name.trim() || "Xüsusi paket";
      summaryMeta = `${s} seans · ${formatAzn(pr)} · seans başına ≈ ${s ? formatAzn(Math.round(pr / s)) : "—"}`;
    }
  } else if (selCat) {
    hasSelection = true;
    summaryName = selCat.name;
    summaryMeta = `${selCat.sessionCount} seans · ${formatAzn(selCat.packagePrice)} · seans başına ≈ ${formatAzn(selCat.perSessionPrice)}`;
  }
  const emptyHint = mode === "single" ? "Psixoloq və seans tarixini seçin"
    : mode === "custom" ? "Seans sayı və qiyməti daxil edin"
    : "Psixoloq və paket seçin";

  const seg = (on: boolean): CSSProperties => ({ flex: 1, border: "none", borderRadius: 8, padding: 9, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? "#082F6D" : "var(--oxford-60)", boxShadow: on ? "0 1px 3px rgba(8,47,109,.12)" : "none" });
  const field: CSSProperties = { width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontWeight: 600, color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box" };
  const fLab: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 20px", overflowY: "auto" }}>
      <style>{`@keyframes opSheet{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", overflow: "hidden", margin: "auto", animation: "opSheet .22s ease" }}>
        {/* header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>Satış</div>
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3, lineHeight: 1.45 }}>Psixoloq + paket və ya tək seans seçin. Ödəniş PENDING yaranır — pul gələndə «Ödənişlər»də təsdiqləyin.</div>
          </div>
          <button onClick={onClose} aria-label="Bağla" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F0F4FA", border: "none", borderRadius: 8, cursor: "pointer", flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* body */}
        <div style={{ padding: "18px 22px", maxHeight: "62vh", overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 9 }}>Psixoloq</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18, maxHeight: 232, overflowY: "auto" }}>
            {psys.length === 0 && <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Psixoloq siyahısı yüklənir…</div>}
            {psys.map(p => {
              const a = psyId === p.id;
              const tint = sellTint(p.name);
              return (
                <button key={p.id} type="button" onClick={() => setPsyId(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: a ? "#F2F6FD" : "#fff", border: `1.5px solid ${a ? "var(--brand)" : "#D6E2F7"}`, borderRadius: 11, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{sellInitials(p.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{p.title || "Psixoloq"}</div>
                  </div>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${a ? "var(--brand)" : "#CBD5E6"}`, background: a ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: a ? 1 : 0 }} aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                </button>
              );
            })}
          </div>

          {/* rejim tabs */}
          <div style={{ display: "flex", gap: 4, background: "#F0F4FA", borderRadius: 10, padding: 3, marginBottom: 16 }}>
            <button type="button" onClick={() => setMode("catalog")} style={seg(mode === "catalog")}>Kataloq paketi</button>
            <button type="button" onClick={() => setMode("custom")} style={seg(mode === "custom")}>Xüsusi paket</button>
            <button type="button" onClick={() => setMode("single")} style={seg(mode === "single")}>Tək seans</button>
          </div>

          {mode === "catalog" ? (
            !psyId ? (
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>Əvvəlcə psixoloq seçin.</div>
            ) : loadingCat ? (
              <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Yüklənir…</div>
            ) : catalog.length === 0 ? (
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 11, padding: "12px 14px", fontSize: 12.5, color: "#92400E", fontWeight: 600, lineHeight: 1.45 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                Bu psixoloqun kataloq paketi yoxdur — «Xüsusi paket» seçin.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {catalog.map(c => {
                  const a = catalogId === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => setCatalogId(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: a ? "#F2F6FD" : "#fff", border: `1.5px solid ${a ? "var(--brand)" : "#D6E2F7"}`, borderRadius: 12, padding: "13px 15px", cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${a ? "var(--brand)" : "#CBD5E6"}`, background: a ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: a ? 1 : 0 }} aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginTop: 1 }}>{c.sessionCount} seans · seans başına ≈ {formatAzn(c.perSessionPrice)}</div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#082F6D", flex: "none" }}>{formatAzn(c.packagePrice)}</span>
                    </button>
                  );
                })}
              </div>
            )
          ) : mode === "single" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Boş saatlar — pasiyent kimi seçim */}
              <div>
                <div style={fLab}>Seans vaxtı — boş saatlardan seçin *</div>
                {!psyId ? (
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>Əvvəlcə psixoloq seçin.</div>
                ) : slotsLoading ? (
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Boş saatlar yüklənir…</div>
                ) : slots.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto", paddingRight: 2 }}>
                    {groupedSlots.map(([day, daySlots]) => (
                      <div key={day}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {daySlots.map(s => {
                            const sel = singleStart === isoToAzLocal(s.startAt);
                            return (
                              <button key={s.startAt} type="button"
                                onClick={() => { setManualOpen(false); setSingleStart(isoToAzLocal(s.startAt)); setSingleEnd(isoToAzLocal(s.endAt)); }}
                                style={{ border: `1.5px solid ${sel ? "var(--brand)" : "#D6E2F7"}`, background: sel ? "var(--brand)" : "#fff", color: sel ? "#fff" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                {azFormatTime(s.startAt)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {psyId && (
                  <button type="button" onClick={() => setManualOpen(o => !o)}
                    style={{ marginTop: 8, background: "none", border: "none", color: "var(--brand-700)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    {manualOpen ? "Əl ilə daxiletməni gizlət" : "Və ya əl ilə daxil et"}
                  </button>
                )}
                {manualOpen && (
                  <label style={{ display: "block", marginTop: 8 }}><span style={fLab}>Tarix və saat (əl ilə)</span>
                    <DatePicker withTime theme="light" size="sm" value={singleStart} onChange={v => { setSingleStart(v); setSingleEnd(addMinutes(v, sessionMin)); }} style={{ width: "100%" }} />
                  </label>
                )}
                {singleStart && <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600, marginTop: 8 }}>Seçilmiş vaxt: {fmtDateTime(singleStart)} · ~{sessionMin} dəq</div>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label><span style={fLab}>Ad (opsional)</span><input value={singleName} onChange={e => setSingleName(e.target.value)} placeholder="Tək seans" style={field} /></label>
                <label><span style={fLab}>Qiymət (₼)</span><input value={singlePrice} onChange={e => setSinglePrice(e.target.value)} type="number" min={0} step="0.01" placeholder="60" style={field} /></label>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ gridColumn: "1 / -1" }}><span style={fLab}>Ad (opsional)</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Məs. Fərdi proqram" style={field} /></label>
              <label><span style={fLab}>Seans sayı</span><input value={sessions} onChange={e => setSessions(e.target.value)} type="number" min={1} placeholder="10" style={field} /></label>
              <label><span style={fLab}>Qiymət (₼)</span><input value={price} onChange={e => setPrice(e.target.value)} type="number" min={0} step="0.01" placeholder="450" style={field} /></label>
            </div>
          )}

          {/* xülasə */}
          <div style={{ marginTop: 18, background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 9 }}>Seçim xülasəsi</div>
            {hasSelection ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{summaryName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, marginTop: 2 }}>{summaryMeta}</div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Ödəniş: PENDING
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 500 }}>{emptyHint}</div>
            )}
          </div>

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 14 }}>{err}</div>}
        </div>

        {/* footer */}
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid #F0F4FA" }}>
          <button onClick={onClose} style={{ flex: "none", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>{saving ? "Satılır…" : (mode === "single" ? "Tək seans sat" : "Paket sat")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Operator paket seansı planlama modalı ──────────────────────────────── */

function SchedulePackageSessionModal({ patientId, pkg, onClose, onDone }: {
  patientId: number;
  pkg: CustomerProfile["packages"][number];
  onClose: () => void;
  onDone: () => void;
}) {
  const psyId = pkg.psychologistId as number;
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(psyId, dateOnly(today), dateOnly(to))
      .then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [psyId]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  const submit = async () => {
    setErr(null);
    if (!start || !end) { setErr("Vaxt seçin və ya əl ilə daxil edin"); return; }
    const startAt = azLocalToISO(start);
    const endAt = azLocalToISO(end);
    if (new Date(startAt) >= new Date(endAt)) { setErr("Başlama vaxtı bitiş vaxtından əvvəl olmalıdır"); return; }
    setSaving(true);
    try {
      await operatorApi.schedulePackageSession(patientId, pkg.id, { startAt, endAt });
      onDone();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  const fieldS: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #D6E2F7", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
  const labS: CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,26,51,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 24px 70px rgba(8,47,109,.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F0F4FA" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)" }}>Paket seansı planla</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, marginTop: 3 }}>
            {pkg.packageName} · {pkg.remaining} seans qalıb{pkg.psychologistName ? ` · ${pkg.psychologistName}` : ""}
          </div>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8AAABF", marginBottom: 10 }}>Boş saatlar</div>
          {slotsLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>Boş saatlar yüklənir…</div>
          ) : slots.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
              {groupedSlots.map(([day, daySlots]) => (
                <div key={day}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {daySlots.map(s => {
                      const sel = start === isoToAzLocal(s.startAt);
                      return (
                        <button key={s.startAt} type="button"
                          onClick={() => { setManualOpen(false); setStart(isoToAzLocal(s.startAt)); setEnd(isoToAzLocal(s.endAt)); }}
                          style={{ border: `1.5px solid ${sel ? "var(--brand)" : "#D6E2F7"}`, background: sel ? "var(--brand)" : "#fff", color: sel ? "#fff" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {azFormatTime(s.startAt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setManualOpen(o => !o)}
            style={{ marginTop: 10, background: "none", border: "none", color: "var(--brand-700)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            {manualOpen ? "Əl ilə daxiletməni gizlət" : "Və ya əl ilə daxil et"}
          </button>
          {manualOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <label style={{ display: "block" }}>
                <span style={labS}>Başlama vaxtı</span>
                <DatePicker withTime theme="light" size="sm" value={start} onChange={v => { setStart(v); if (!end) setEnd(addMinutes(v, 50)); }} style={{ width: "100%" }} />
              </label>
              <label style={{ display: "block" }}>
                <span style={labS}>Bitmə vaxtı</span>
                <DatePicker withTime theme="light" size="sm" value={end} onChange={setEnd} style={{ width: "100%" }} />
              </label>
            </div>
          )}

          {start && end && (
            <div style={{ fontSize: 12.5, color: "#065F46", fontWeight: 600, marginTop: 12, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 9, padding: "9px 12px" }}>
              Seçilmiş vaxt: {azFormatDate(azLocalToISO(start))} · {azFormatTime(azLocalToISO(start))} – {azFormatTime(azLocalToISO(end))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 12, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.45 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
            Paket balansından 1 seans sərf olunacaq və seans təsdiqlənmiş (CONFIRMED) yaranacaq.
          </div>

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid #F0F4FA" }}>
          <button onClick={onClose} style={{ flex: "none", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Planlanır…" : "Seansı planla"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "PAID" || status === "COMPLETED" || status === "CONFIRMED" || status === "ACTIVE";
  const bad = status === "CANCELLED" || status === "FAILED" || status === "REJECTED" || status === "EXPIRED" || status === "REFUNDED";
  const bg = ok ? "#D1FAE5" : bad ? "#FEE2E2" : "#FEF3C7";
  const fg = ok ? "#065F46" : bad ? "#991B1B" : "#92400E";
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>
      {statusLabel(status)}
    </span>
  );
}
