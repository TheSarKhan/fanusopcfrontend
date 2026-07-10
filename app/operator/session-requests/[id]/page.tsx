"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type PackageDto, type Psychologist, type SessionRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import DatePicker from "@/components/DatePicker";
import { toast as uiToast } from "@/components/Toast";
import ErrorState from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { IconAlert, IconCheck, IconChevronLeft } from "../icons";

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  NEW: { label: "Yeni", className: "fx-pill--pending" },
  IN_REVIEW: { label: "Baxılır", className: "fx-pill--info" },
  CONVERTED: { label: "Qəbul edildi", className: "fx-pill--paid" },
  CANCELLED: { label: "Ləğv edilib", className: "fx-pill--cancelled" },
};

function fmtSchedule(dateIso: string, time?: string | null) {
  // gg.aa.iiii — locale-dən asılı deyil (az-AZ ICU datası olmayan runtime-larda
  // toLocaleDateString month:"long" tarixi "2026 M07 12" kimi ISO-fallback verirdi).
  const d = azFormatDate(dateIso);
  return time ? `${d}, saat ${time}` : d;
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
      <span className="fx-muted" style={{ minWidth: 160, fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--oxford)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function SessionRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const me = getStoredUser();

  const [req, setReq] = useState<SessionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);

  // Randevuya çevir
  const [psyId, setPsyId] = useState<number | "">("");
  const [startAt, setStartAt] = useState("");
  const [note, setNote] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  // Pasient telefonda bu psixoloqu özü istəyibsə komissiyasız/azaldılmış faiz tətbiq olunur.
  const [convertPatientChoseDirectly, setConvertPatientChoseDirectly] = useState(false);
  // Operator qəbul edərkən seans növünü seçir: tək seans və ya pulsuz tanışlıq (15 dəq).
  // Eligibility (1 pulsuz haqq) serverdə yoxlanır — pasient hələ yaranmadığı üçün burada
  // əvvəlcədən yoxlanıla bilmir, uyğun deyilsə backend xəta qaytarır (convertError göstərir).
  const [convertSessionKind, setConvertSessionKind] = useState<"STANDARD" | "INTRO">("STANDARD");

  // Paket sat
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgMode, setPkgMode] = useState<"catalog" | "custom">("catalog");
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [catalogId, setCatalogId] = useState<number | "">("");
  const [pkgName, setPkgName] = useState("");
  const [pkgSessions, setPkgSessions] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [sellingPkg, setSellingPkg] = useState(false);
  const [pkgError, setPkgError] = useState("");
  const [pkgPatientChoseDirectly, setPkgPatientChoseDirectly] = useState(false);

  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    operatorApi.getSessionRequest(Number(id))
      .then(data => setReq(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { operatorApi.listPsychologists().then(setPsychologists).catch(() => {}); }, []);

  useEffect(() => {
    setCatalog([]); setCatalogId("");
    if (!pkgOpen || pkgMode !== "catalog" || !psyId) return;
    operatorApi.psychologistPackages(Number(psyId))
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]));
  }, [pkgOpen, pkgMode, psyId]);

  if (loading) return (
    <div style={{ maxWidth: 900 }}>
      <Skeleton width={220} height={24} />
      <div className="fx-card fx-card__pad" style={{ marginTop: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={`${70 - i * 6}%`} height={14} style={{ marginTop: i === 0 ? 0 : 14 }} />
        ))}
      </div>
      <div className="fx-card fx-card__pad" style={{ marginTop: 16 }}>
        <Skeleton width="40%" height={13} />
        <Skeleton width="90%" height={13} style={{ marginTop: 12 }} />
      </div>
    </div>
  );
  if (error) return (
    <div style={{ maxWidth: 900 }}>
      <ErrorState
        title="Müraciət yüklənmədi"
        sub="Bağlantı problemi ola bilər. Yenidən cəhd edin və ya siyahıya qayıdın."
        onRetry={load}
        action={
          <button type="button" className="fx-btn fx-btn--ghost" onClick={() => router.push("/operator/session-requests")}>
            Siyahıya qayıt
          </button>
        }
      />
    </div>
  );
  if (!req) return <div style={{ padding: 32, color: "var(--error)" }}>Müraciət tapılmadı.</div>;

  const badge = STATUS_PILL[req.status] ?? { label: req.status, className: "fx-pill--neutral" };
  const mine = me != null && req.claimedByUserId === me.userId;
  const unclaimed = req.claimedByUserId == null;
  const claimedByOther = !unclaimed && !mine;
  const isConverted = req.status === "CONVERTED";
  const isCancelled = req.status === "CANCELLED";
  const canAct = mine && !isConverted && !isCancelled;

  // Operatora cari mərhələni + növbəti addımı bir cümlə ilə izah edir (şəffaflıq).
  const statusHint =
    isConverted ? "Bu müraciət qəbul edilib (randevu / paket) — nəticə aşağıda göstərilir."
    : isCancelled ? "Bu müraciət ləğv edilib. İstəsəniz aşağıdan bərpa edə bilərsiniz."
    : unclaimed ? "Hovuzda — hələ heç kim götürməyib. Növbəti addım: “Götür”."
    : claimedByOther ? `Hazırda ${req.claimedByName ?? "başqa operator"} aparır — yalnız o çevirə/ləğv edə bilər.`
    : !req.email ? "Sizdədir — çevirmək üçün əvvəlcə pasiyentdən e-poçt alın."
    : "Sizdədir — pasiyentlə əlaqə saxlayıb randevuya çevirin və ya paket satın.";

  const claim = () => {
    setClaimBusy(true);
    operatorApi.claimSessionRequest(req.id)
      .then(() => { uiToast("Müraciət götürüldü", "success"); load(); })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setClaimBusy(false));
  };

  const release = () => {
    setClaimBusy(true);
    operatorApi.releaseSessionRequest(req.id)
      .then(() => { uiToast("Müraciət hovuza buraxıldı", "success"); load(); })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setClaimBusy(false));
  };

  const cancelWithReason = (reason: string) => {
    setCancelBusy(true);
    operatorApi.updateSessionRequestStatus(req.id, { status: "CANCELLED", operatorNote: reason })
      .then(() => { setCancelModalOpen(false); uiToast("Müraciət ləğv edildi", "success"); load(); })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setCancelBusy(false));
  };

  const convertToAppointment = async () => {
    if (!psyId) { setConvertError("Psixoloq seçin"); return; }
    if (!startAt) { setConvertError("Vaxt seçin"); return; }
    setConvertError("");
    setConverting(true);
    try {
      const updated = await operatorApi.convertSessionRequestToAppointment(req.id, {
        psychologistId: Number(psyId), startAt, note: note.trim() || undefined,
        patientChoseDirectly: convertPatientChoseDirectly,
        sessionKind: convertSessionKind === "INTRO" ? "INTRO" : undefined,
      });
      setReq(updated);
      uiToast("Randevu yaradıldı", "success");
    } catch (e) {
      setConvertError((e as Error).message ?? "Xəta baş verdi");
    } finally {
      setConverting(false);
    }
  };

  const sellPackage = async () => {
    if (!psyId) { setPkgError("Psixoloq seçin"); return; }
    setPkgError("");
    if (pkgMode === "catalog" && !catalogId) { setPkgError("Kataloqdan paket seçin"); return; }
    if (pkgMode === "custom") {
      const s = Number(pkgSessions), p = Number(pkgPrice);
      if (!Number.isFinite(s) || s < 1) { setPkgError("Seans sayı düzgün deyil"); return; }
      if (!Number.isFinite(p) || p < 0) { setPkgError("Qiymət düzgün deyil"); return; }
    }
    setSellingPkg(true);
    try {
      const updated = await operatorApi.convertSessionRequestToPackage(req.id,
        pkgMode === "catalog"
          ? { sessionPackageId: Number(catalogId), patientChoseDirectly: pkgPatientChoseDirectly }
          : { psychologistId: Number(psyId), packageName: pkgName.trim() || undefined, sessionCount: Number(pkgSessions), price: Number(pkgPrice), patientChoseDirectly: pkgPatientChoseDirectly });
      setReq(updated);
      uiToast("Paket satıldı", "success");
    } catch (e) {
      setPkgError((e as Error).message ?? "Xəta baş verdi");
    } finally {
      setSellingPkg(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <button type="button" className="fx-btn fx-btn--quiet fx-btn--sm" onClick={() => router.push("/operator/session-requests")}>
          <IconChevronLeft className="fx-icon--sm" />
          Geri
        </button>
        <h1 className="fx-h1">Müraciət #{req.id}</h1>
        <span className={`fx-pill ${badge.className}`}>{badge.label}</span>
        {req.priority && <span className="fx-pill fx-pill--pending">Prioritet</span>}
      </div>
      <p className="fx-subtitle" style={{ margin: "0 0 24px", fontSize: 13, maxWidth: 640 }}>{statusHint}</p>

      {claimedByOther && (
        <div className="fx-banner fx-banner--info" style={{ marginBottom: 20 }}>
          Bu müraciəti hazırda <strong>{req.claimedByName}</strong> aparır — yalnız o çevirmə/ləğv edə bilər.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: unclaimed || claimedByOther || isConverted || isCancelled ? "1fr" : "1.6fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="fx-stack">
          <div className="fx-card">
            <div className="fx-card__head"><span className="fx-card-title">Müraciət məlumatları</span></div>
            <div className="fx-card__pad">
              <InfoRow label="Ad Soyad" value={req.name} />
              <InfoRow label="Telefon" value={req.phone} />
              <InfoRow label="E-poçt" value={req.email} />
              <InfoRow label="Yaş" value={req.age} />
              <InfoRow label="Büdcə" value={req.budget} />
              <InfoRow label="Göndərildi" value={azFormatDateTime(req.createdAt)} />
            </div>
          </div>

          <div className="fx-card">
            <div className="fx-card__head"><span className="fx-card-title">Müraciətin səbəbi</span></div>
            <div className="fx-card__pad">
              <p style={{ margin: 0, fontSize: 14, color: "var(--oxford)", lineHeight: 1.6 }}>{req.reason}</p>
            </div>
          </div>

          {(req.preferredDate || req.preferredTime || req.notes) && (
            <div className="fx-card">
              <div className="fx-card__head"><span className="fx-card-title">Əlavə məlumat</span></div>
              <div className="fx-card__pad">
                <InfoRow label="Üstünlük verilən tarix" value={req.preferredDate ? azFormatDate(req.preferredDate) : req.preferredDate} />
                <InfoRow label="Üstünlük verilən saat" value={req.preferredTime} />
                {req.notes && (
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--oxford-80)", lineHeight: 1.6 }}>
                    <span className="fx-muted">Əlavə qeydlər: </span>{req.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {isConverted && (
            <div className="fx-card" style={{ background: "var(--sage-bg)", borderColor: "rgba(74,155,127,.35)" }}>
              <div className="fx-card__pad">
                <div className="fx-label" style={{ color: "#2E6B54", marginBottom: 12 }}>Qəbul edildi — nəticə</div>
                {(req.assignedPsychologistName || req.scheduledDate || req.sessionPackage) && (
                  <div style={{ marginBottom: 16 }}>
                    <InfoRow label="Təyin olunan psixoloq" value={req.assignedPsychologistName} />
                    {req.scheduledDate && <InfoRow label="Seans vaxtı" value={fmtSchedule(req.scheduledDate, req.scheduledTime)} />}
                    <InfoRow label="Paket" value={req.sessionPackage} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {req.convertedAppointmentId && (
                    <button type="button" className="fx-btn" style={{ background: "var(--sage)", borderColor: "var(--sage)", color: "#fff" }}
                      onClick={() => router.push(`/operator/appointments/${req.convertedAppointmentId}`)}>
                      Randevuya bax
                    </button>
                  )}
                  {req.convertedPatientId && (
                    <button type="button" className="fx-btn fx-btn--ghost" style={{ borderColor: "rgba(74,155,127,.35)", color: "#2E6B54" }}
                      onClick={() => router.push(`/operator/customers/${req.convertedPatientId}`)}>
                      Müştəri profilinə bax
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="fx-card fx-card--error" style={{ background: "var(--rose-bg)" }}>
              <div className="fx-card__pad">
                <p style={{ margin: 0, fontSize: 13, color: "var(--rose)", fontWeight: 500 }}>Bu müraciət ləğv edilib.</p>
                {mine && (
                  <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" style={{ marginTop: 10 }}
                    onClick={() => operatorApi.updateSessionRequestStatus(req.id, { status: "IN_REVIEW" }).then(load)}>
                    Bərpa et
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {unclaimed && (
          <div className="fx-card fx-card__pad">
            <p className="fx-muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
              Bu müraciət hələ heç kimə aid deyil. Götürsəniz yalnız siz görəcəksiniz.
            </p>
            <button type="button" disabled={claimBusy} onClick={claim}
              className="fx-btn" style={{ width: "100%", background: "var(--sage)", borderColor: "var(--sage)", color: "#fff", cursor: claimBusy ? "wait" : "pointer", opacity: claimBusy ? 0.6 : 1 }}>
              <IconCheck className="fx-icon--md" />
              Götür
            </button>
          </div>
        )}

        {canAct && !req.email && (
          <div className="fx-alert">
            <IconAlert />
            <div>
              <div className="fx-alert__title">Email tələb olunur</div>
              <div className="fx-alert__text">
                Bu müraciətdə email yoxdur. Pasiyent hesabı yaratmaq üçün email tələb olunur —
                zəng edib email öyrənin, sonra çevirməyə davam edin.
              </div>
            </div>
          </div>
        )}

        {canAct && req.email && (
          <div className="fx-stack">
            <div className="fx-card">
              <div className="fx-card__head"><span className="fx-card-title">Randevuya çevir</span></div>
              <div className="fx-card__pad">
                {convertError && (
                  <div className="fx-error-text" style={{ marginBottom: 12 }}><IconAlert className="fx-icon--sm" />{convertError}</div>
                )}
                <div className="fx-field" style={{ marginBottom: 12 }}>
                  <label className="fx-label">Psixoloq *</label>
                  <select className="fx-select" value={psyId} onChange={e => setPsyId(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Psixoloq seçin...</option>
                    {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="fx-field" style={{ marginBottom: 12 }}>
                  <label className="fx-label">Seans növü</label>
                  <div className="fx-segmented" style={{ width: "100%" }}>
                    <button type="button" style={{ flex: 1 }} className={convertSessionKind === "STANDARD" ? "fx-seg--active" : ""}
                      onClick={() => setConvertSessionKind("STANDARD")}>
                      Tək seans
                    </button>
                    <button type="button" style={{ flex: 1 }} className={convertSessionKind === "INTRO" ? "fx-seg--active" : ""}
                      onClick={() => setConvertSessionKind("INTRO")}>
                      Tanışlıq (15 dəq, pulsuz)
                    </button>
                  </div>
                  {convertSessionKind === "INTRO" && (
                    <p className="fx-muted" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.4 }}>
                      Pasientin pulsuz tanışlıq haqqı istifadə olunubsa, sistem xəta qaytaracaq —
                      2-ci tanışlıq üçün Pasiyent 360-dan əvvəlcə icazə verilməlidir.
                    </p>
                  )}
                </div>

                <div className="fx-field" style={{ marginBottom: 12 }}>
                  <label className="fx-label">Seans tarixi/saatı *</label>
                  <DatePicker value={startAt} onChange={setStartAt} placeholder="gg.aa.iiii ss:dd" theme="light" withTime />
                </div>

                <div className="fx-field" style={{ marginBottom: 14 }}>
                  <label className="fx-label">Qeyd</label>
                  <textarea className="fx-textarea" value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="Daxili qeyd (istifadəçiyə göstərilmir)" />
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, cursor: "pointer" }}>
                  <input type="checkbox" className="fx-checkbox" checked={convertPatientChoseDirectly}
                    onChange={e => setConvertPatientChoseDirectly(e.target.checked)} style={{ marginTop: 1 }} />
                  <span className="fx-muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                    Pasient telefonda bu psixoloqu özü istəyib (komissiyasız/azaldılmış faiz tətbiq olunur)
                  </span>
                </label>

                <button type="button" disabled={converting} onClick={convertToAppointment}
                  className="fx-btn fx-btn--primary" style={{ width: "100%" }}>
                  {converting ? "Göndərilir..." : "Randevu yarat"}
                </button>
                <p className="fx-muted" style={{ margin: "8px 0 0", fontSize: 11, textAlign: "center" }}>
                  {req.email ? "Yeni hesab yaransa pasiyentə şifrə təyini üçün email göndəriləcək." : "Email yoxdur — hesab yaransa dəvət göndərilməyəcək."}
                </p>
              </div>
            </div>

            <div className="fx-card">
              <div className="fx-card__head">
                <span className="fx-card-title">Paket sat</span>
                <button type="button" className="fx-btn fx-btn--quiet fx-btn--sm" onClick={() => setPkgOpen(o => !o)}>
                  {pkgOpen ? "Bağla" : "Aç"}
                </button>
              </div>
              {pkgOpen && (
                <div className="fx-card__pad">
                  {pkgError && (
                    <div className="fx-error-text" style={{ marginBottom: 12 }}><IconAlert className="fx-icon--sm" />{pkgError}</div>
                  )}
                  <div className="fx-field" style={{ marginBottom: 12 }}>
                    <label className="fx-label">Psixoloq *</label>
                    <select className="fx-select" value={psyId} onChange={e => setPsyId(e.target.value === "" ? "" : Number(e.target.value))}>
                      <option value="">Psixoloq seçin...</option>
                      {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="fx-segmented" style={{ width: "100%", marginBottom: 12 }}>
                    <button type="button" style={{ flex: 1 }} className={pkgMode === "catalog" ? "fx-seg--active" : ""} onClick={() => setPkgMode("catalog")}>
                      Kataloqdan
                    </button>
                    <button type="button" style={{ flex: 1 }} className={pkgMode === "custom" ? "fx-seg--active" : ""} onClick={() => setPkgMode("custom")}>
                      Xüsusi
                    </button>
                  </div>

                  {pkgMode === "catalog" ? (
                    <div className="fx-field" style={{ marginBottom: 12 }}>
                      <select className="fx-select" value={catalogId} onChange={e => setCatalogId(e.target.value === "" ? "" : Number(e.target.value))}>
                        <option value="">Paket seçin...</option>
                        {catalog.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sessionCount} seans — {p.packagePrice} AZN</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="fx-stack" style={{ gap: 8, marginBottom: 12 }}>
                      <input className="fx-input" type="text" value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Paket adı (opsional)" />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input className="fx-input" type="number" min={1} value={pkgSessions} onChange={e => setPkgSessions(e.target.value)} placeholder="Seans sayı" />
                        <input className="fx-input" type="number" min={0} value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} placeholder="Qiymət (AZN)" />
                      </div>
                    </div>
                  )}

                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, cursor: "pointer" }}>
                    <input type="checkbox" className="fx-checkbox" checked={pkgPatientChoseDirectly}
                      onChange={e => setPkgPatientChoseDirectly(e.target.checked)} style={{ marginTop: 1 }} />
                    <span className="fx-muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                      Pasient telefonda bu psixoloqu özü istəyib (komissiyasız/azaldılmış faiz tətbiq olunur)
                    </span>
                  </label>

                  <button type="button" disabled={sellingPkg} onClick={sellPackage}
                    className="fx-btn" style={{ width: "100%", background: "var(--lilac)", borderColor: "var(--lilac)", color: "#fff" }}>
                    {sellingPkg ? "Göndərilir..." : "Paketi sat"}
                  </button>
                </div>
              )}
            </div>

            <div className="fx-card fx-card__pad" style={{ display: "flex", gap: 10 }}>
              <button type="button" disabled={claimBusy} onClick={release} className="fx-btn fx-btn--ghost" style={{ flex: 1 }}>
                Hovuza buraxdır
              </button>
              <button type="button" disabled={cancelBusy} onClick={() => setCancelModalOpen(true)} className="fx-btn fx-btn--danger-ghost" style={{ flex: 1 }}>
                Ləğv et
              </button>
            </div>
          </div>
        )}
      </div>

      {cancelModalOpen && (
        <CancelReasonModal
          busy={cancelBusy}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={cancelWithReason}
        />
      )}
    </div>
  );
}

/* ─── Ləğv səbəbi modalı — səbəb yazılmadan ləğv mümkün deyil ─────────────── */

function CancelReasonModal({ busy, onClose, onConfirm }: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <div className="fx-overlay fx-overlay--center" onClick={busy ? undefined : onClose} style={{ padding: 16 }}>
      <div className="fx-modal" onClick={e => e.stopPropagation()} style={{ width: "min(440px, 100%)" }}>
        <h3 className="fx-h3">Müraciəti ləğv et</h3>
        <p className="fx-modal__text" style={{ marginTop: -6 }}>
          Ləğv səbəbini yazın — bu qeyd müraciətin tarixçəsində saxlanılır. Sonra “Bərpa et” ilə geri qaytara bilərsiniz.
        </p>
        <textarea className="fx-textarea" rows={3} autoFocus value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Məsələn: Əlaqə saxlanılmadı, müştəri imtina etdi, uyğun vaxt tapılmadı..." />
        <div className="fx-modal__actions">
          <button type="button" onClick={onClose} disabled={busy} className="fx-btn fx-btn--ghost">
            Vaz keç
          </button>
          <button type="button" onClick={() => onConfirm(trimmed)} disabled={busy || !trimmed}
            className="fx-btn fx-btn--danger" style={{ opacity: busy || !trimmed ? 0.6 : 1, cursor: busy || !trimmed ? "not-allowed" : "pointer" }}>
            {busy ? "…" : "Ləğv et"}
          </button>
        </div>
      </div>
    </div>
  );
}
