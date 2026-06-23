"use client";

/**
 * Müraciət Pool-u — ayrıca intake səhifəsi. Yeni (sahibsiz) müraciətlər
 * burada toplanır: həm SEANS müraciətləri, həm də ÖDƏNİŞ/PAKET müraciətləri.
 * Operator buradan "Götür" → müraciət daimi olaraq onun üzərinə keçir və
 * pooldan çıxır. Sonrakı idarəetmə müvafiq səhifələrdə (randevu detalı /
 * ödənişlər) davam edir. Pool artıq siyahı içində filtr deyil — öz səhifəsidir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  operatorApi,
  type AppointmentDetail,
  type PaymentItem,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDateTime } from "@/lib/datetime";
import { statusMeta, isPoolEligible } from "@/lib/appointmentStatus";
import { formatAzn } from "@/lib/money";
import { toast as uiToast } from "@/components/Toast";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || null;
}
function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "").replace(/[^\d]/g, "")}`;
}
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəq öncə`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat öncə`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün öncə`;
  return `${Math.round(d / 30)} ay öncə`;
}
function fmtDt(iso?: string | null) {
  return iso ? azFormatDateTime(iso) : "—";
}
function initialsOf(name?: string | null) {
  if (!name) return "—";
  return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "—";
}

const shimmerCss = `
  @keyframes poolShimmer { 0% { background-position: -340px 0 } 100% { background-position: 340px 0 } }
  .pool-skel { background: linear-gradient(90deg,#EEF2F9 25%,#E2E9F4 37%,#EEF2F9 63%); background-size: 680px 100%; animation: poolShimmer 1.4s infinite linear; }
`;

export default function OperatorPoolPage() {
  const { t } = useT();
  const router = useRouter();

  const [appts, setAppts] = useState<AppointmentDetail[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      operatorApi.listAppointments().catch(() => [] as AppointmentDetail[]),
      operatorApi.listPendingPayments("PENDING").catch(() => [] as PaymentItem[]),
    ])
      .then(([a, p]) => { setAppts(a); setPayments(p); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Yeni müraciət gəldikdə pool-u canlı yenilə.
  useEffect(() => {
    return subscribeNotifications((n) => {
      const ty = typeof n.type === "string" ? n.type : "";
      if (ty.startsWith("APPOINTMENT_") || ty.startsWith("PAYMENT_")) load();
    });
  }, [load]);

  // Başqası seans müraciətini götürəndə pooldan çıxsın (sahibli artıq pool deyil).
  useEffect(() => {
    return subscribeOperatorClaims((ev) => {
      setAppts(prev => prev.map(a => a.id === ev.appointmentId
        ? { ...a, claimedByUserId: ev.claimedByUserId ?? null, claimedByName: ev.claimedByName ?? null, claimedAt: ev.claimedAt ?? null }
        : a));
    });
  }, []);

  // Pool = sahibsiz + yeni müraciət.
  const poolAppts = useMemo(
    () => appts.filter(a => a.claimedByUserId == null && isPoolEligible(a.status)),
    [appts]);
  const poolPayments = useMemo(
    () => payments.filter(p => p.claimedByOperatorId == null),
    [payments]);

  const total = poolAppts.length + poolPayments.length;

  const takeAppt = useCallback((a: AppointmentDetail) => {
    setBusyId(`a${a.id}`);
    operatorApi.claim(a.id)
      .then(() => {
        setAppts(prev => prev.filter(x => x.id !== a.id)); // götürüldü → pooldan çıxır
        uiToast(t("staff.opPoolTaken"), "success");
      })
      .catch((e) => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  }, [t]);

  const takePayment = useCallback((p: PaymentItem) => {
    setBusyId(`p${p.id}`);
    operatorApi.claimPayment(p.id)
      .then(() => {
        setPayments(prev => prev.filter(x => x.id !== p.id));
        // Ödəniş götürüldükdən sonra "Ödənişlər → Gözləyir"də yaşayır; operatoru
        // birbaşa ora aparırıq ki, "itdi" hissi yaranmasın (mark-paid orada olur).
        uiToast("Ödəniş götürüldü — Ödənişlər → Gözləyir", "success");
        router.push("/operator/payments");
      })
      .catch((e) => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  }, [router]);

  return (
    <div style={{ width: "100%" }}>
      <style>{shimmerCss}</style>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)" }}>{t("staff.opPoolTitle")}</h1>
            {total > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 28, padding: "0 10px", background: "#ECFDF5", color: "#047857", fontSize: 14, fontWeight: 800, borderRadius: 999 }}>{total}</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--oxford-60)", fontWeight: 500 }}>{t("staff.opPoolSub")}</p>
        </div>
        <button onClick={load} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          Yenilə
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <PoolSkeleton key={i} />)}
        </div>
      ) : total === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#ECFDF5", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: "#047857" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--oxford)", marginBottom: 7 }}>{t("staff.opPoolEmpty")}</div>
          <div style={{ fontSize: 14, color: "var(--oxford-60)", fontWeight: 500 }}>Yeni müraciət gələndə burada görünəcək.</div>
        </div>
      ) : (
        <>
          {poolAppts.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <SectionHeader color="#047857" tintBg="#ECFDF5" label={t("staff.opPoolApptSection")} count={poolAppts.length} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {poolAppts.map(a => (
                  <PoolApptCard
                    key={a.id}
                    a={a}
                    busy={busyId === `a${a.id}`}
                    onTake={() => takeAppt(a)}
                    onOpen={() => router.push(`/operator/appointments/${a.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {poolPayments.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <SectionHeader color="#B45309" tintBg="#FEF3C7" label={t("staff.opPoolPaySection")} count={poolPayments.length} />
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
                {poolPayments.map((p, i) => (
                  <PoolPayRow
                    key={p.id}
                    p={p}
                    first={i === 0}
                    busy={busyId === `p${p.id}`}
                    onTake={() => takePayment(p)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ color, tintBg, label, count }: { color: string; tintBg: string; label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--oxford)" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 7px", background: tintBg, color, fontSize: 12, fontWeight: 700, borderRadius: 999 }}>{count}</span>
    </div>
  );
}

function ContactBtn({ href, target, label, children }: { href: string; target?: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target={target} rel={target ? "noopener noreferrer" : undefined} title={label}
      onClick={e => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F8FAFD", color: "var(--brand-700)", border: "1px solid #EDF1F8", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
      {children}{label}
    </a>
  );
}

function PoolApptCard({
  a, busy, onTake, onOpen,
}: {
  a: AppointmentDetail;
  busy: boolean;
  onTake: () => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const meta = statusMeta(a.status);
  const phone = normalizePhone(a.patientPhone);

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", borderLeft: "3px solid #047857", padding: 18, display: "flex", flexDirection: "column", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, fontWeight: 600, color: "var(--oxford-60)", letterSpacing: ".02em" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.fg }} />{meta.label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initialsOf(a.patientName)}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</div>
          <div style={{ fontSize: 12.5, color: "#9DB0CC", fontWeight: 600 }}>{timeAgo(a.createdAt) || `${fmtDt(a.createdAt)} yaradılıb`}</div>
        </div>
      </div>

      {(phone || a.patientEmail) && (
        <div style={{ display: "flex", gap: 7, marginBottom: 13, flexWrap: "wrap" }}>
          {phone && (
            <>
              <ContactBtn href={`tel:${phone}`} label="Zəng">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              </ContactBtn>
              <ContactBtn href={whatsappLink(phone)} target="_blank" label="WhatsApp">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              </ContactBtn>
            </>
          )}
          {a.patientEmail && (
            <ContactBtn href={`mailto:${a.patientEmail}`} label="Email">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 5L2 7" /></svg>
            </ContactBtn>
          )}
        </div>
      )}

      {a.note && (
        <div style={{ display: "flex", gap: 9, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "11px 13px", marginBottom: 13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span style={{ fontSize: 13.5, color: "var(--oxford)", fontStyle: "italic", fontWeight: 500, lineHeight: 1.45 }}>«{a.note}»</span>
        </div>
      )}

      {a.requestedPsychologistName ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--brand-700)", marginBottom: 15 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <span>Tövsiyə olunan: {a.requestedPsychologistName}{a.requestedStartAt && ` · ${fmtDt(a.requestedStartAt)}`}</span>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#9DB0CC", fontWeight: 500, marginBottom: 15 }}>Psixoloq seçilməyib — operator təyin edəcək</div>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: "auto" }}>
        <button onClick={e => { e.stopPropagation(); onTake(); }} disabled={busy}
          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#047857", color: "#fff", border: "none", borderRadius: 10, padding: 11, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, boxShadow: "0 4px 12px rgba(4,120,87,.24)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          {t("staff.opTake")}
        </button>
        <button onClick={e => { e.stopPropagation(); onOpen(); }}
          style={{ flex: "none", background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          {t("staff.opOpenTicket")}
        </button>
      </div>
    </div>
  );
}

function PoolPayRow({ p, first, busy, onTake }: { p: PaymentItem; first: boolean; busy: boolean; onTake: () => void }) {
  const { t } = useT();
  const isPackage = p.patientPackageId != null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderTop: `1px solid ${first ? "transparent" : "#F0F4FA"}`, borderLeft: "3px solid #B45309", flexWrap: "wrap" }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{initialsOf(p.patientName)}</span>
      <div style={{ flex: 1, minWidth: 170 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)" }}>{p.patientName}</span>
          <span style={{ background: isPackage ? "#FEF3C7" : "#F3F4F6", color: isPackage ? "#B45309" : "#374151", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6 }}>
            {isPackage ? t("pkg.paymentPackage") : t("pkg.paymentSingle")}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>
          {t("pkg.amount")}: <span style={{ color: "var(--oxford)", fontWeight: 700 }}>{formatAzn(p.amount)}</span>
          {" · "}{t("pkg.method")}: {p.method}
          {" · "}{t("pkg.date")}: {fmtDt(p.createdAt)}
        </div>
      </div>
      <button onClick={onTake} disabled={busy}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#047857", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, boxShadow: "0 4px 12px rgba(4,120,87,.22)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        {t("staff.opTake")}
      </button>
    </div>
  );
}

function PoolSkeleton() {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", borderLeft: "3px solid #E2E9F4", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="pool-skel" style={{ width: 90, height: 14, borderRadius: 6 }} />
        <div className="pool-skel" style={{ width: 54, height: 20, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", gap: 11, marginBottom: 14 }}>
        <div className="pool-skel" style={{ width: 40, height: 40, borderRadius: 11 }} />
        <div style={{ flex: 1, paddingTop: 3 }}>
          <div className="pool-skel" style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 8 }} />
          <div className="pool-skel" style={{ width: "35%", height: 11, borderRadius: 6 }} />
        </div>
      </div>
      <div className="pool-skel" style={{ width: "100%", height: 42, borderRadius: 10, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 9 }}>
        <div className="pool-skel" style={{ flex: 1, height: 42, borderRadius: 10 }} />
        <div className="pool-skel" style={{ width: 84, height: 42, borderRadius: 10 }} />
      </div>
    </div>
  );
}
