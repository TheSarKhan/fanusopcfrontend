"use client";

// Modul H — operator müştəri profili (360° görünüş). Yalnız oxunan.
// Pasiyentin qeydiyyatı, seans bölgüsü, ödənişlər, paketlər, test nəticələri,
// rəylər və fəaliyyət lenti bir səhifədə. Modul G məxfi sahələri açıq işarələnir.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { operatorApi, type CustomerProfile } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";

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
  }, [patientId]);

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
      <header className="op-analytics__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>{h.name}</h1>
          <p>Müştəri profili · #{patientId}</p>
        </div>
        <Link href="/operator/customers" className="op-kpi" style={{ flex: "0 0 auto", padding: "8px 14px", textDecoration: "none", fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>
          ← Axtarış
        </Link>
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
          <span className="op-card__count">{profile.payments.length}</span>
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
                  {profile.payments.map(p => (
                    <tr key={p.id}>
                      <Td><strong style={{ color: "var(--oxford)" }}>{formatAzn(p.amount)}</strong></Td>
                      <Td><StatusPill status={p.status} /></Td>
                      <Td>{p.method || "—"}</Td>
                      <Td>{p.patientPackageId != null ? "Paket" : "Tək seans"}</Td>
                      <Td>{fmtDateTime(p.paidAt ?? p.createdAt)}</Td>
                    </tr>
                  ))}
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
          <span className="op-card__count">{profile.packages.length}</span>
        </div>
        <div className="op-card__body">
          {profile.packages.length === 0 ? (
            <div className="op-empty">Paket yoxdur</div>
          ) : (
            <div className="op-list">
              {profile.packages.map(pkg => (
                <div key={pkg.id} className="op-row">
                  <div className="op-row__main">
                    <div className="op-row__name">
                      {pkg.packageName}
                      <span className="op-row__badge" data-tone="brand" style={{ marginLeft: 6 }}>
                        {statusLabel(pkg.status)}
                      </span>
                    </div>
                    <div className="op-row__meta">
                      <span>{pkg.remaining} / {pkg.total} qalıb</span>
                      {pkg.psychologistName && <span>· {pkg.psychologistName}</span>}
                      {pkg.pricePaid != null && <span>· {formatAzn(pkg.pricePaid)}</span>}
                      {pkg.purchasedAt && <span>· {fmtDate(pkg.purchasedAt)}</span>}
                    </div>
                  </div>
                </div>
              ))}
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

function StatusPill({ status }: { status: string }) {
  const ok = status === "PAID" || status === "COMPLETED" || status === "CONFIRMED" || status === "ACTIVE";
  const bad = status === "CANCELLED" || status === "FAILED" || status === "REJECTED" || status === "EXPIRED";
  const bg = ok ? "#D1FAE5" : bad ? "#FEE2E2" : "#FEF3C7";
  const fg = ok ? "#065F46" : bad ? "#991B1B" : "#92400E";
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>
      {statusLabel(status)}
    </span>
  );
}
