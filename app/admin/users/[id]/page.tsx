"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  adminApi,
  type AppointmentDetail,
  type ClinicalData,
  type ClinicalGrant,
  type OperatorOverview,
  type PatientCard,
  type Psychologist,
  type PsychologistCard,
  type UserRecord,
  type Vacation,
} from "@/lib/api";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Gözləyir", NEW: "Yeni", REJECTED: "Yenidən təyin", IN_REVIEW: "Operatorda",
  ASSIGNED: "Təyin edilib", CONFIRMED: "Təsdiqlənib", AWAITING_CONFIRMATION: "Təsdiq gözlənir",
  DISPUTED: "Mübahisəli", CANCEL_REQUESTED: "Ləğv gözlənir", COMPLETED: "Tamamlanıb", CANCELLED: "Ləğv edilib",
};
const FLAG_LABEL: Record<string, string> = {
  HIGH_NO_SHOW: "Çox no-show", HIGH_LATE_CANCEL: "Çox gec ləğv", HIGH_REJECT: "Çox rədd",
};
const ROLE_LABEL: Record<string, string> = {
  PATIENT: "Pasiyent", PSYCHOLOGIST: "Psixoloq", OPERATOR: "Operator", ADMIN: "Admin",
};

function fmtDT(iso?: string | null) { return iso ? azFormatDateTime(iso) : "—"; }
function fmtD(iso?: string | null) { return iso ? azFormatDate(iso) : "—"; }

function statusTone(s: string): string {
  if (["DISPUTED", "CANCELLED"].includes(s)) return "rose";
  if (["PENDING", "NEW", "REJECTED", "CANCEL_REQUESTED", "AWAITING_CONFIRMATION", "IN_REVIEW"].includes(s)) return "gold";
  if (["CONFIRMED", "COMPLETED"].includes(s)) return "sage";
  return "ox";
}

export default function AdminUserCardPage() {
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);

  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    adminApi.getUser(userId)
      .then(setUser)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="page" style={{ padding: 40, color: "var(--muted)" }}>Yüklənir…</div>;
  if (error || !user) return <div className="page" style={{ padding: 40, color: "#991B1B" }}>{error ?? "İstifadəçi tapılmadı"}</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
            <Link href="/admin/users" style={{ color: "var(--muted)" }}>İstifadəçilər</Link> / #{user.id}
          </div>
          <h1 className="page-title">
            {(user.firstName ?? "") + " " + (user.lastName ?? "")}
            <span className="pill ox" style={{ marginLeft: 10, verticalAlign: "middle" }}>{ROLE_LABEL[user.role] ?? user.role}</span>
            {!user.active && <span className="pill rose" style={{ marginLeft: 6, verticalAlign: "middle" }}>deaktiv</span>}
          </h1>
          <p className="page-sub">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
        </div>
      </div>

      <SupportTools user={user} />

      {user.role === "PATIENT" && <PatientCardView userId={userId} />}
      {user.role === "PSYCHOLOGIST" && <PsychologistCardView userId={userId} />}
      {user.role === "OPERATOR" && <OperatorCardView userId={userId} />}
      {user.role === "ADMIN" && (
        <div className="card" style={{ padding: 16, fontSize: 12.5, color: "var(--muted)" }}>
          Admin hesabı — əlavə kart məlumatı yoxdur. Yuxarıdakı dəstək alətlərindən istifadə edin.
        </div>
      )}
    </div>
  );
}

/* ─── 3E: Dəstək alətləri (hər rol üçün; impersonation YOXDUR — PO qərarı) ── */

function SupportTools({ user }: { user: UserRecord }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg(okMsg); }
    catch (e) { setMsg("Xəta: " + (e as Error).message); }
    finally { setBusy(null); }
  };

  const changeEmail = () => {
    const newEmail = window.prompt("Yeni email ünvanı (yeni ünvana təsdiq emaili gedəcək, sessiyalar bağlanacaq):", "");
    if (!newEmail) return;
    if (!window.confirm(`Email ${user.email} → ${newEmail} dəyişdirilsin?`)) return;
    run("email", () => adminApi.changeUserEmail(user.id, newEmail), "Email dəyişdirildi — təsdiq gözlənilir.");
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head"><h3 className="card-title">Dəstək alətləri</h3></div>
      <div className="card-pad" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" disabled={busy !== null}
          onClick={() => run("reset", () => adminApi.sendPasswordReset(user.id), "Şifrə-reset emaili göndərildi.")}>
          {busy === "reset" ? "Göndərilir…" : "Şifrə-reset emaili"}
        </button>
        <button className="btn" disabled={busy !== null || user.emailVerified}
          title={user.emailVerified ? "Email artıq təsdiqlənib" : undefined}
          onClick={() => run("verify", () => adminApi.resendVerification(user.id), "Verification yenidən göndərildi.")}>
          {busy === "verify" ? "Göndərilir…" : "Verification göndər"}
        </button>
        <button className="btn" disabled={busy !== null} onClick={changeEmail}>
          {busy === "email" ? "Dəyişdirilir…" : "Email ünvanı dəyiş"}
        </button>
        <button className="btn danger" disabled={busy !== null}
          onClick={() => {
            if (!window.confirm("Bu istifadəçinin BÜTÜN sessiyaları sonlandırılsın?")) return;
            run("sessions", () => adminApi.terminateUserSessions(user.id), "Bütün sessiyalar sonlandırıldı.");
          }}>
          {busy === "sessions" ? "Sonlandırılır…" : "Sessiyaları sonlandır"}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.startsWith("Xəta") ? "#991B1B" : "var(--sage)" }}>{msg}</span>}
      </div>
    </div>
  );
}

/* ─── 3A: Pasiyent kartı ──────────────────────────────────────────────────── */

function PatientCardView({ userId }: { userId: number }) {
  const { t } = useT();
  const [card, setCard] = useState<PatientCard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.getPatientCard(userId).then(setCard).catch((e) => setErr((e as Error).message));
  }, [userId]);
  useEffect(load, [load]);

  if (err) return <div className="card" style={{ padding: 16, color: "#991B1B", fontSize: 12.5 }}>{err}</div>;
  if (!card) return <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>Yüklənir…</div>;

  return (
    <>
      {card.deletionRequestedAt && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: "#991B1B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span><strong>Silinmə istəyi gözləyir</strong> · {fmtDT(card.deletionRequestedAt)} (V33, 30 günlük pəncərə)</span>
          <Link className="btn sm" href="/admin/deletion-requests">Silinmə istəklərinə bax →</Link>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* Reputasiya */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Reputasiya</h3>
              {card.autoFlag && <span className="pill rose">{FLAG_LABEL[card.autoFlag] ?? card.autoFlag}</span>}
            </div>
            <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <Stat label="No-show" value={card.noShowCount} danger={card.noShowCount >= 3} />
              <Stat label="Gec ləğv" value={card.lateCancelCount} danger={card.lateCancelCount >= 5} />
              <Stat label="Rədd" value={card.rejectCount} danger={card.rejectCount >= 3} />
              <Stat label="Risk" valueStr={card.riskLevel ?? "—"} danger={card.riskLevel === "HIGH" || card.riskLevel === "CRITICAL"} />
            </div>
            {card.blocked && (
              <div className="card-pad" style={{ paddingTop: 0, fontSize: 12, color: "#991B1B", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                Bloklanıb{card.blockReason ? ` — ${card.blockReason}` : ""}
              </div>
            )}
            {card.tags.length > 0 && (
              <div className="card-pad" style={{ paddingTop: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.tags.map((t) => (
                  <span key={t.id} className="pill ox" title={t.psychologistName ? `Tag sahibi: ${t.psychologistName}` : undefined}>
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Təcili əlaqə + ünvan (Modul G) */}
          {(card.emergencyContactName || card.emergencyContactPhone || card.emergencyContactRelation || card.residentialAddress) && (
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">{t("emergency.sectionTitle")}</h3>
              </div>
              <div>
                {card.emergencyContactName && (
                  <div className="list-item">
                    <div style={{ flex: 1 }}>
                      <div className="li-meta">{t("emergency.contactName")}</div>
                      <div className="li-title">{card.emergencyContactName}</div>
                    </div>
                  </div>
                )}
                {card.emergencyContactPhone && (
                  <div className="list-item">
                    <div style={{ flex: 1 }}>
                      <div className="li-meta">{t("emergency.contactPhone")}</div>
                      <div className="li-title">{card.emergencyContactPhone}</div>
                    </div>
                  </div>
                )}
                {card.emergencyContactRelation && (
                  <div className="list-item">
                    <div style={{ flex: 1 }}>
                      <div className="li-meta">{t("emergency.contactRelation")}</div>
                      <div className="li-title">{card.emergencyContactRelation}</div>
                    </div>
                  </div>
                )}
                {card.residentialAddress && (
                  <div className="list-item">
                    <div style={{ flex: 1 }}>
                      <div className="li-meta">{t("emergency.address")}</div>
                      <div className="li-title">{card.residentialAddress}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Randevu tarixçəsi */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Randevu tarixçəsi</h3>
              <span className="pill muted">{card.appointments.length}</span>
            </div>
            <div style={{ maxHeight: 340, overflow: "auto" }}>
              {card.appointments.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--muted)" }}>Randevu yoxdur</div>}
              {card.appointments.map((a: AppointmentDetail) => (
                <div className="list-item" key={a.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="li-title">
                      #{a.id} · {a.psychologistName ?? a.requestedPsychologistName ?? "psixoloq seçilməyib"}
                      {a.seriesId != null && <span className="pill ox" style={{ marginLeft: 6, fontSize: 10 }}>Kurs {(a.seriesIndex ?? 0) + 1}/{a.seriesTotal ?? "?"}</span>}
                    </div>
                    <div className="li-meta">{a.startAt ? fmtDT(a.startAt) : `yaradılıb ${fmtDT(a.createdAt)}`}</div>
                  </div>
                  <span className={`pill ${statusTone(a.status)}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kurslar */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Kurslar / qruplar</h3>
              <span className="pill muted">{card.series.length}</span>
            </div>
            <div>
              {card.series.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--muted)" }}>Kurs yoxdur</div>}
              {card.series.map((s) => (
                <div className="list-item" key={s.id}>
                  <div style={{ flex: 1 }}>
                    <div className="li-title">Seriya #{s.id} · {s.totalCount} seans · {s.requestedPsychologistName ?? "—"}</div>
                    <div className="li-meta">
                      {fmtD(s.createdAt)}
                      {s.cancelledAt ? " · ləğv edilib" : s.cancelRequestedAt ? " · ləğv tələbi gözləyir" : ""}
                    </div>
                  </div>
                  {s.cancelledAt
                    ? <span className="pill rose">ləğv</span>
                    : s.cancelRequestedAt
                      ? <span className="pill gold">ləğv tələbi</span>
                      : <span className="pill sage">aktiv</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {/* Klinik data — break-glass */}
          <ClinicalSection userId={userId} grant={card.clinicalAccess} onGranted={load} />

          {/* Bildiriş tarixçəsi */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Bildiriş tarixçəsi</h3>
              <span className="pill muted">son {card.notifications.length}</span>
            </div>
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {card.notifications.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--muted)" }}>Bildiriş yoxdur</div>}
              {card.notifications.map((n) => (
                <div className="list-item" key={n.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="li-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                    <div className="li-meta">{fmtDT(n.createdAt)}{n.readAt ? " · oxunub" : " · oxunmayıb"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, valueStr, danger }: { label: string; value?: number; valueStr?: string; danger?: boolean }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: danger ? "#8b3d35" : "var(--ink)" }}>{valueStr ?? value}</div>
    </div>
  );
}

/* ─── 3A.2: kilidli klinik data bölməsi ───────────────────────────────────── */

function ClinicalSection({ userId, grant, onGranted }: {
  userId: number;
  grant: ClinicalGrant | null;
  onGranted: () => void;
}) {
  const [data, setData] = useState<ClinicalData | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Komponent state-i kimi bir dəfə oxunur (react-hooks/purity); backend onsuz da
  // hər clinical-data sorğusunda expires_at-ı yenidən yoxlayır.
  const [now] = useState(() => Date.now());
  const active = grant != null && new Date(grant.expiresAt).getTime() > now;

  useEffect(() => {
    if (active) {
      adminApi.getClinicalData(userId).then(setData).catch((e) => setErr((e as Error).message));
    } else {
      setData(null);
    }
  }, [active, userId]);

  const requestAccess = async () => {
    setErr(null);
    if (reason.trim().length < 20) { setErr("Səbəb ən azı 20 simvol olmalıdır"); return; }
    setBusy(true);
    try {
      await adminApi.grantClinicalAccess(userId, reason.trim());
      setReasonOpen(false);
      setReason("");
      onGranted();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Klinik data</h3>
        {active
          ? <span className="pill sage">açıqdır · bitmə {fmtDT(grant!.expiresAt)}</span>
          : <span className="pill muted">bağlıdır</span>}
      </div>

      {!active && (
        <div className="card-pad">
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
            Seans qeydləri, homework cavabları və check-in mətnləri default görünmür.
            Açmaq üçün səbəb yazın (min 20 simvol) — 24 saatlıq read-only giriş veriləcək,
            audit-log-a yazılacaq və pasiyentin psixoloquna şəffaflıq bildirişi gedəcək.
          </p>
          {!reasonOpen ? (
            <button className="btn primary" onClick={() => setReasonOpen(true)}>Səbəblə aç (break-glass)</button>
          ) : (
            <>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Niyə klinik dataya baxmalısınız? (min 20 simvol — audit-də saxlanılır)"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
              <div style={{ fontSize: 11, color: reason.trim().length < 20 ? "#92400E" : "var(--sage)", marginBottom: 8 }}>
                {reason.trim().length}/20 simvol
              </div>
              {err && <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 8 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => { setReasonOpen(false); setErr(null); }}>İmtina</button>
                <button className="btn primary" onClick={requestAccess} disabled={busy}>
                  {busy ? "Açılır…" : "24 saatlıq giriş al"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {active && (
        <div className="card-pad" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Səbəb: «{grant!.reason}» · read-only · jurnal serverde saxlanmır (yalnız cihazda)
          </div>
          {err && <div style={{ fontSize: 12, color: "#991B1B" }}>{err}</div>}
          {!data ? (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Yüklənir…</div>
          ) : (
            <>
              <ClinicalBlock title={`Seans qeydləri (${data.sessionNotes.length})`}>
                {data.sessionNotes.map((n) => (
                  <div key={n.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{n.title ?? "Qeyd"}</span>
                      <span style={{ color: "var(--muted-2)" }}>{fmtDT(n.createdAt)}</span>
                    </div>
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>{n.psychologistName ?? "—"}{n.moodScore != null ? ` · əhval ${n.moodScore}/5` : ""}</div>
                    {n.body && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                  </div>
                ))}
              </ClinicalBlock>
              <ClinicalBlock title={`Homework cavabları (${data.homework.length})`}>
                {data.homework.map((h) => (
                  <div key={h.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{h.title}</span>
                      <span className="pill muted">{h.status}</span>
                    </div>
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>{h.psychologistName ?? "—"}{h.completedAt ? ` · tamamlanıb ${fmtDT(h.completedAt)}` : ""}</div>
                    {h.completionNote && <div style={{ marginTop: 6, fontStyle: "italic" }}>«{h.completionNote}»</div>}
                  </div>
                ))}
              </ClinicalBlock>
              <ClinicalBlock title={`Check-in mətnləri (${data.checkIns.length})`}>
                {data.checkIns.map((c) => (
                  <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>Əhval {c.moodScore}/5</span>
                      <span style={{ color: "var(--muted-2)" }}>{fmtDT(c.createdAt)}</span>
                    </div>
                    {c.note && <div style={{ marginTop: 4 }}>{c.note}</div>}
                  </div>
                ))}
              </ClinicalBlock>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClinicalBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open>
      <summary style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", marginBottom: 6 }}>{title}</summary>
      <div style={{ display: "grid", gap: 6, maxHeight: 280, overflow: "auto" }}>{children}</div>
    </details>
  );
}

/* ─── 3C: Psixoloq kartı ──────────────────────────────────────────────────── */

function PsychologistCardView({ userId }: { userId: number }) {
  const [profile, setProfile] = useState<Psychologist | null>(null);
  const [card, setCard] = useState<PsychologistCard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadCard = useCallback((psyId: number) => {
    adminApi.getPsychologistCard(psyId).then(setCard).catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => {
    adminApi.getUserPsychologistProfile(userId)
      .then((p) => { setProfile(p); loadCard(p.id); })
      .catch(() => setErr("Bu istifadəçinin psixoloq profili yoxdur (siyahıya əlavə edilməyib)."));
  }, [userId, loadCard]);

  if (err) return <div className="card" style={{ padding: 16, color: "#92400E", fontSize: 12.5 }}>{err}</div>;
  if (!profile || !card) return <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>Yüklənir…</div>;

  const perf = card.performance;

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div style={{ display: "grid", gap: 14 }}>
        {/* Status + suspend */}
        <SuspendCard card={card} onChanged={() => loadCard(card.psychologistId)} />

        {/* Performans bloku */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Performans</h3></div>
          <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <Stat label="Bu ay seans" valueStr={`${perf.monthSessionsCompleted}/${perf.monthSessionsTotal}`} />
            <Stat label="Reytinq" valueStr={perf.rating != null ? `${perf.rating} (${perf.reviewCount})` : "—"} />
            <Stat label="Aktiv kurs" value={perf.activeSeriesCount} />
            <Stat label="Rədd nisbəti (30g)" valueStr={perf.rejectionRatePct != null ? `${perf.rejectionRatePct}%` : "—"} danger={(perf.rejectionRatePct ?? 0) >= 30} />
            <Stat label="Ort. təsdiq" valueStr={perf.avgConfirmMinutes != null ? `${Math.round(perf.avgConfirmMinutes)} dəq` : "—"} />
            <Stat label="7 gün doluluq" valueStr={perf.next7FullnessPct != null ? `${perf.next7FullnessPct}%` : "—"} />
          </div>
          <div className="card-pad" style={{ paddingTop: 0, fontSize: 11.5, color: "var(--muted)" }}>
            Son 30 gün: {perf.received30} qəbul · {perf.rejected30} rədd · Gələn 7 gün: {perf.next7Booked} tutulu / {perf.next7FreeSlots} boş slot
          </div>
        </div>

        {/* Cədvəl inteqrasiyası */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Cədvəl / availability</h3></div>
          <div className="card-pad">
            <Link className="btn" href={`/admin/psychologists/${card.psychologistId}/availability`}>
              Slot cədvəlini aç →
            </Link>
          </div>
        </div>
      </div>

      <VacationsCard psyId={card.psychologistId} vacations={card.vacations} onChanged={() => loadCard(card.psychologistId)} />
    </div>
  );
}

function SuspendCard({ card, onChanged }: { card: PsychologistCard; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const suspended = card.suspendedAt != null;

  const toggle = async () => {
    if (suspended) {
      if (!window.confirm(`${card.name} bərpa edilsin? Yeni təyinatlar yenidən mümkün olacaq.`)) return;
      setBusy(true);
      try { await adminApi.unsuspendPsychologist(card.psychologistId); onChanged(); }
      catch (e) { alert((e as Error).message); }
      finally { setBusy(false); }
    } else {
      const reason = window.prompt("Dayandırma səbəbi (psixoloqa bildiriş gedəcək):", "");
      if (!reason || !reason.trim()) return;
      setBusy(true);
      try { await adminApi.suspendPsychologist(card.psychologistId, reason.trim()); onChanged(); }
      catch (e) { alert((e as Error).message); }
      finally { setBusy(false); }
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Status</h3>
        {suspended
          ? <span className="pill rose">SUSPENDED · {fmtDT(card.suspendedAt)}</span>
          : card.active ? <span className="pill sage">aktiv</span> : <span className="pill muted">deaktiv</span>}
      </div>
      <div className="card-pad">
        {suspended && card.suspendReason && (
          <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 10 }}>Səbəb: «{card.suspendReason}»</div>
        )}
        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 10px" }}>
          SUSPENDED psixoloq yeni təyinat ala bilmir (backend guard) — mövcud randevular toxunulmur.
        </p>
        <button className={`btn ${suspended ? "primary" : "danger"}`} onClick={toggle} disabled={busy}>
          {busy ? "Göndərilir…" : suspended ? "Bərpa et" : "SUSPENDED et (səbəblə)"}
        </button>
      </div>
    </div>
  );
}

function VacationsCard({ psyId, vacations, onChanged }: {
  psyId: number;
  vacations: Vacation[];
  onChanged: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState<number | null>(null);

  const create = async () => {
    setErr(null); setConflictCount(null);
    if (!start || !end) { setErr("Başlama və bitiş tarixləri lazımdır"); return; }
    setBusy(true);
    try {
      const res = await adminApi.createPsyVacation(psyId, {
        startDate: start, endDate: end, reason: reason.trim() || undefined,
      });
      if (!res.created) {
        // GAP-05 qapısı: aralıqda aktiv randevular var — əvvəl onlar həll olunmalıdır.
        setConflictCount(res.conflicts.length);
      } else {
        setStart(""); setEnd(""); setReason("");
        onChanged();
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (vacationId: number) => {
    if (!window.confirm("Məzuniyyət silinsin?")) return;
    try { await adminApi.deletePsyVacation(psyId, vacationId); onChanged(); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Məzuniyyətlər</h3>
        <span className="pill muted">{vacations.length}</span>
      </div>
      <div>
        {vacations.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--muted)" }}>Aktiv məzuniyyət yoxdur</div>}
        {vacations.map((v) => (
          <div className="list-item" key={v.id}>
            <div style={{ flex: 1 }}>
              <div className="li-title">{v.startDate} → {v.endDate}</div>
              <div className="li-meta">
                {v.reason ?? "səbəb yazılmayıb"}
                {v.affectedAppointments > 0 ? ` · ${v.affectedAppointments} randevuya təsir` : ""}
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => remove(v.id)}>Sil</button>
          </div>
        ))}
      </div>
      <div className="divider" style={{ margin: "0 16px" }} />
      <div className="card-pad" style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)" }}>Admin əvəzinə məzuniyyət qoy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Səbəb (opsional)"
          style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }} />
        {conflictCount != null && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E" }}>
            Aralıqda {conflictCount} aktiv randevu var (GAP-05 qapısı) — əvvəlcə onları
            <Link href="/admin/appointments" style={{ marginLeft: 4 }}>randevular səhifəsində</Link> həll edin.
          </div>
        )}
        {err && <div style={{ fontSize: 12, color: "#991B1B" }}>{err}</div>}
        <button className="btn primary" onClick={create} disabled={busy} style={{ justifySelf: "start" }}>
          {busy ? "Yaradılır…" : "Məzuniyyət yarat"}
        </button>
      </div>
    </div>
  );
}

/* ─── 3D: Operator kartı (fərdi) ──────────────────────────────────────────── */

function OperatorCardView({ userId }: { userId: number }) {
  const [row, setRow] = useState<OperatorOverview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    adminApi.getOperatorsOverview()
      .then((rows) => setRow(rows.find((r) => r.userId === userId) ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userId]);

  if (!loaded) return <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>Yüklənir…</div>;
  if (!row) return <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 12.5 }}>Operator statistikası tapılmadı.</div>;

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="card-head">
        <h3 className="card-title">Operator performansı</h3>
        <Link className="btn ghost sm" href="/admin/operators">Bütün operatorlar →</Link>
      </div>
      <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Stat label="Bu gün təyin" value={row.assignedToday} />
        <Stat label="Son 7 gün" value={row.assignedWeek} />
        <Stat label="Son 30 gün" value={row.assigned30} />
        <Stat label="Ort. cavab" valueStr={row.avgResponseMinutes != null ? `${Math.round(row.avgResponseMinutes)} dəq` : "—"} />
        <Stat label="SLA pozuntusu (30g)" value={row.slaViolations30} danger={row.slaViolations30 > 0} />
        <Stat label="Son giriş" valueStr={row.lastLogin ? azFormatDate(row.lastLogin) : "—"} />
      </div>
    </div>
  );
}
