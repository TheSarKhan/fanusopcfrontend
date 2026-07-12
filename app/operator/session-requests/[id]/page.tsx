"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type AvailableSlot, type PackageDto, type Psychologist, type SessionRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { azFormatDate, azFormatDateTime, azFormatTime, isoToAzLocal } from "@/lib/datetime";
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

function pad2(n: number) { return String(n).padStart(2, "0"); }
function dateOnly(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

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
      <span className="fx-muted" style={{ minWidth: 120, fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--oxford)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/** Kiçik böyük hərflərlə bölmə başlığı — sol/sağ sütunları alt-seksiyalara ayırır. */
function SectionLabel({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="fx-section-label"
      style={{ marginTop: first ? 0 : 20, paddingTop: first ? 0 : 20, borderTop: first ? "none" : "1px solid var(--hairline)", marginBottom: 12 }}>
      {children}
    </div>
  );
}

/** "Pasiyent özü istəyib" seçimi — başlıq + izah birlikdə, hər iki formada (randevu/paket) eyni görünüş. */
function DirectChoiceCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      <input type="checkbox" className="fx-checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17 }} />
      <span style={{ display: "block" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>
          Pasiyent bu psixoloqu telefonda özü istəyib
        </span>
        <span className="fx-muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
          Komissiyasız / azaldılmış faiz tətbiq olunur
        </span>
      </span>
    </label>
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

  // Sağ panel: Randevu yarat / Paket sat seçimi (bir anda yalnız biri doldurulur).
  const [actionMode, setActionMode] = useState<"APPOINTMENT" | "PACKAGE">("APPOINTMENT");

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
  // Seans qiyməti — psixoloq seçiləndə onun standart qiyməti (individualPrice) ilə öndoldurulur,
  // operator dəyişə bilər. Boş buraxılsa backend individualPrice-a (o da yoxdursa 0-a) düşür.
  const [convertPrice, setConvertPrice] = useState("");
  // Psixoloqun boş saatları — randevu alarkən istifadə olunan eyni slot-seçici (Müştərilər/Paket
  // axınları ilə eyni nümunə): psixoloq seçiləndə yaxın 3 həftənin boş vaxtları göstərilir.
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // Paket sat
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

  // Psixoloq seçiləndə seans qiymətini onun standart qiyməti ilə öndoldur (operator dəyişə bilər).
  useEffect(() => {
    if (!psyId) { setConvertPrice(""); return; }
    const p = psychologists.find(x => x.id === psyId);
    setConvertPrice(p?.individualPrice != null ? String(p.individualPrice) : "");
  }, [psyId, psychologists]);

  useEffect(() => {
    setCatalog([]); setCatalogId("");
    if (actionMode !== "PACKAGE" || pkgMode !== "catalog" || !psyId) return;
    operatorApi.psychologistPackages(Number(psyId))
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]));
  }, [actionMode, pkgMode, psyId]);

  // Psixoloq (və ya seans növü — INTRO 15 dəq addımla bölünür) seçiləndə yaxın 3 həftənin
  // boş saatlarını gətir, randevu alarkən istifadə olunan eyni axın.
  useEffect(() => {
    if (!psyId) { setSlots([]); return; }
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date(); to.setDate(to.getDate() + 21);
    operatorApi.availability(Number(psyId), dateOnly(today), dateOnly(to), convertSessionKind === "INTRO" ? "INTRO" : undefined)
      .then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [psyId, convertSessionKind]);

  useEffect(() => { setStartAt(""); setManualOpen(false); }, [psyId, convertSessionKind]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = azFormatDate(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  if (loading) return (
    <div style={{ maxWidth: 1000 }}>
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
    <div style={{ maxWidth: 1000 }}>
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

  // Seçilmiş psixoloqun qiymət/müddət məlumatı — operatora çevirmədən əvvəl göstərilir.
  const selectedPsy = psyId ? psychologists.find(p => p.id === psyId) : undefined;
  const sessionMinutes = convertSessionKind === "INTRO" ? 15 : (selectedPsy?.defaultSessionMinutes || 50);
  const psyCurrency = selectedPsy?.currency || "AZN";

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
    // INTRO pulsuzdur → qiymət göndərilmir. STANDARD üçün qiymət verilibsə düzgün olmalıdır.
    const priceNum = convertSessionKind === "INTRO" || convertPrice.trim() === "" ? undefined : Number(convertPrice);
    if (priceNum !== undefined && (!Number.isFinite(priceNum) || priceNum < 0)) {
      setConvertError("Qiymət düzgün deyil"); return;
    }
    setConvertError("");
    setConverting(true);
    try {
      const updated = await operatorApi.convertSessionRequestToAppointment(req.id, {
        psychologistId: Number(psyId), startAt, note: note.trim() || undefined,
        patientChoseDirectly: convertPatientChoseDirectly,
        sessionKind: convertSessionKind === "INTRO" ? "INTRO" : undefined,
        sessionPrice: priceNum,
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

  const psySelect = (
    <div className="fx-field">
      <label className="fx-label">Psixoloq *</label>
      <select className="fx-select" value={psyId} onChange={e => setPsyId(e.target.value === "" ? "" : Number(e.target.value))}>
        <option value="">Psixoloq seçin...</option>
        {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000 }}>
      <button type="button" className="fx-btn fx-btn--quiet fx-btn--sm" style={{ marginBottom: 12 }}
        onClick={() => router.push("/operator/session-requests")}>
        <IconChevronLeft className="fx-icon--sm" />
        Geri
      </button>

      {claimedByOther && (
        <div className="fx-banner fx-banner--info" style={{ marginBottom: 20 }}>
          Bu müraciəti hazırda <strong>{req.claimedByName}</strong> aparır — yalnız o çevirmə/ləğv edə bilər.
        </div>
      )}

      <div className="fx-card" style={{ overflow: "hidden" }}>
        {/* Başlıq zolağı */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "20px 24px", borderBottom: "1px solid var(--hairline)", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <h1 className="fx-h1" style={{ fontSize: 21 }}>{req.name}</h1>
              <span className={`fx-pill ${badge.className}`}>{badge.label}</span>
              {req.priority && <span className="fx-pill fx-pill--pending">Prioritet</span>}
            </div>
            <p className="fx-subtitle" style={{ margin: 0, fontSize: 13, maxWidth: 480 }}>{statusHint}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="fx-muted fx-num" style={{ fontSize: 12, marginBottom: canAct ? 10 : 0, whiteSpace: "nowrap" }}>
              Göndərildi: <span style={{ fontWeight: 600, color: "var(--oxford-80)" }}>{azFormatDateTime(req.createdAt)}</span>
            </div>
            {canAct && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" disabled={claimBusy} onClick={release} className="fx-btn fx-btn--ghost fx-btn--sm">
                  Hovuza buraxdır
                </button>
                <button type="button" disabled={cancelBusy} onClick={() => setCancelModalOpen(true)} className="fx-btn fx-btn--danger-ghost fx-btn--sm">
                  Ləğv et
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gövdə: sol məlumat sütunu + sağ əməliyyat sütunu (yalnız canAct-də) */}
        <div style={{ display: "grid", gridTemplateColumns: canAct ? "1.6fr 1fr" : "1fr", alignItems: "start" }}>
          <div style={{ padding: "20px 24px" }}>
            <InfoRow label="Telefon" value={req.phone} />
            <InfoRow label="E-poçt" value={req.email} />
            <InfoRow label="Yaş" value={req.age} />
            <InfoRow label="Büdcə" value={req.budget} />

            <SectionLabel>Müraciətin səbəbi</SectionLabel>
            <p style={{ margin: 0, fontSize: 14, color: "var(--oxford)", lineHeight: 1.6 }}>{req.reason}</p>

            {(req.preferredDate || req.preferredTime || req.notes) && (
              <>
                <SectionLabel>Əlavə məlumat</SectionLabel>
                <InfoRow label="Üstünlük verilən tarix" value={req.preferredDate ? azFormatDate(req.preferredDate) : req.preferredDate} />
                <InfoRow label="Üstünlük verilən saat" value={req.preferredTime} />
                {req.notes && (
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--oxford-80)", lineHeight: 1.6 }}>
                    <span className="fx-muted">Əlavə qeydlər: </span>{req.notes}
                  </div>
                )}
              </>
            )}

            {isConverted && (
              <>
                <SectionLabel>Nəticə</SectionLabel>
                <div style={{ padding: 16, borderRadius: 12, background: "var(--sage-bg)", border: "1px solid rgba(74,155,127,.35)" }}>
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
              </>
            )}

            {isCancelled && (
              <>
                <SectionLabel>Vəziyyət</SectionLabel>
                <div style={{ padding: 16, borderRadius: 12, background: "var(--rose-bg)", border: "1px solid rgba(201,125,125,.4)" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--rose)", fontWeight: 500 }}>Bu müraciət ləğv edilib.</p>
                  {mine && (
                    <button type="button" className="fx-btn fx-btn--ghost fx-btn--sm" style={{ marginTop: 10 }}
                      onClick={() => operatorApi.updateSessionRequestStatus(req.id, { status: "IN_REVIEW" }).then(load)}>
                      Bərpa et
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {canAct && (
            <div style={{ padding: "20px 24px", borderLeft: "1px solid var(--hairline)" }}>
              {!req.email ? (
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
              ) : (
                <>
                  <div className="fx-section-label" style={{ marginBottom: 10 }}>Əməliyyat seçin</div>
                  <div className="fx-segmented" style={{ width: "100%", marginBottom: 18 }}>
                    <button type="button" style={{ flex: 1, padding: "9px 14px", fontSize: 13 }}
                      className={actionMode === "APPOINTMENT" ? "fx-seg--active" : ""}
                      onClick={() => setActionMode("APPOINTMENT")}>
                      Randevu yarat
                    </button>
                    <button type="button" style={{ flex: 1, padding: "9px 14px", fontSize: 13 }}
                      className={actionMode === "PACKAGE" ? "fx-seg--active" : ""}
                      onClick={() => setActionMode("PACKAGE")}>
                      Paket sat
                    </button>
                  </div>

                  {actionMode === "APPOINTMENT" ? (
                    <>
                      {convertError && (
                        <div className="fx-error-text" style={{ marginBottom: 12 }}><IconAlert className="fx-icon--sm" />{convertError}</div>
                      )}

                      <SectionLabel first>1 · Psixoloq və seans</SectionLabel>
                      {psySelect}

                      <div className="fx-field" style={{ marginTop: 12 }}>
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

                      {selectedPsy && (
                        <div style={{ marginTop: 12, background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: convertSessionKind === "INTRO" ? 0 : 10 }}>
                            <span className="fx-muted">Seans müddəti</span>
                            <span style={{ fontWeight: 600, color: "var(--oxford)" }}>{sessionMinutes} dəq</span>
                          </div>
                          {convertSessionKind === "INTRO" ? (
                            <div style={{ marginTop: 8, fontSize: 12.5, color: "#2E6B54", fontWeight: 600 }}>
                              Pulsuz tanışlıq görüşü — ödəniş yaranmır.
                            </div>
                          ) : (
                            <>
                              <label className="fx-label" style={{ marginBottom: 4 }}>Seans qiyməti ({psyCurrency})</label>
                              <input className="fx-input" type="number" min={0} step="0.01" value={convertPrice}
                                onChange={e => setConvertPrice(e.target.value)}
                                placeholder={selectedPsy.individualPrice != null ? String(selectedPsy.individualPrice) : "Qiymət təyin olunmayıb"} />
                              <p className="fx-muted" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.45 }}>
                                {selectedPsy.individualPrice != null
                                  ? `Psixoloqun standart qiyməti: ${selectedPsy.individualPrice} ${psyCurrency}. Lazım olsa dəyişin.`
                                  : "Bu psixoloq üçün qiymət təyin olunmayıb — məbləği əl ilə yazın (boş buraxsanız 0 ilə yaranır, sonra Ödənişlərdə doldurulur)."}
                              </p>
                              <p className="fx-muted" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.45 }}>
                                {convertPatientChoseDirectly
                                  ? "Pasient özü seçib → komissiyasız/azaldılmış faiz. Pasient bu qiyməti ödəyir."
                                  : "Platforma təyinatı → ödəniş təsdiqlənəndə platforma komissiyası tutulur. Pasient bu qiyməti ödəyir."}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      <SectionLabel>2 · Tarix və qeydlər</SectionLabel>
                      <div className="fx-field">
                        <label className="fx-label">Seans tarixi/saatı * — boş saatlardan seçin</label>
                        {!psyId ? (
                          <div className="fx-muted" style={{ fontSize: 12.5 }}>Əvvəlcə psixoloq seçin.</div>
                        ) : slotsLoading ? (
                          <div className="fx-muted" style={{ fontSize: 12.5 }}>Boş saatlar yüklənir…</div>
                        ) : slots.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: "var(--status-pending-fg)", background: "var(--status-pending-bg)", border: "1px solid rgba(201,125,46,.3)", borderRadius: 10, padding: "10px 12px" }}>
                            Yaxın 3 həftədə boş saat yoxdur — aşağıdan əl ilə daxil edin.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
                            {groupedSlots.map(([day, daySlots]) => (
                              <div key={day}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>{day}</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {daySlots.map(s => {
                                    const sel = startAt === isoToAzLocal(s.startAt);
                                    return (
                                      <button key={s.startAt} type="button"
                                        onClick={() => { setManualOpen(false); setStartAt(isoToAzLocal(s.startAt)); }}
                                        style={{ border: `1.5px solid ${sel ? "var(--brand)" : "var(--hairline)"}`, background: sel ? "var(--brand)" : "var(--surface)", color: sel ? "#fff" : "var(--oxford)", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
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
                          <div style={{ marginTop: 8 }}>
                            <DatePicker value={startAt} onChange={setStartAt} placeholder="gg.aa.iiii ss:dd" theme="light" withTime />
                          </div>
                        )}
                        {startAt && <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600, marginTop: 8 }}>Seçilmiş vaxt: {azFormatDate(startAt)}, saat {azFormatTime(startAt)}</div>}
                      </div>
                      <div className="fx-field" style={{ marginTop: 12 }}>
                        <label className="fx-label">Qeyd (opsional)</label>
                        <textarea className="fx-textarea" value={note} onChange={e => setNote(e.target.value)} rows={2}
                          placeholder="Daxili qeyd (istifadəçiyə göstərilmir)" />
                      </div>

                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
                        <DirectChoiceCheckbox checked={convertPatientChoseDirectly} onChange={setConvertPatientChoseDirectly} />
                      </div>

                      <button type="button" disabled={converting} onClick={convertToAppointment}
                        className="fx-btn fx-btn--primary" style={{ width: "100%", marginTop: 18 }}>
                        {converting ? "Göndərilir..." : "Randevu yarat"}
                      </button>
                      <p className="fx-muted" style={{ margin: "8px 0 0", fontSize: 11, textAlign: "center" }}>
                        Yeni hesab yaransa pasiyentə şifrə təyini üçün email göndəriləcək.
                      </p>
                    </>
                  ) : (
                    <>
                      {pkgError && (
                        <div className="fx-error-text" style={{ marginBottom: 12 }}><IconAlert className="fx-icon--sm" />{pkgError}</div>
                      )}

                      <SectionLabel first>1 · Psixoloq</SectionLabel>
                      {psySelect}

                      <SectionLabel>2 · Paket</SectionLabel>
                      <div className="fx-segmented" style={{ width: "100%", marginBottom: 12 }}>
                        <button type="button" style={{ flex: 1 }} className={pkgMode === "catalog" ? "fx-seg--active" : ""} onClick={() => setPkgMode("catalog")}>
                          Kataloqdan
                        </button>
                        <button type="button" style={{ flex: 1 }} className={pkgMode === "custom" ? "fx-seg--active" : ""} onClick={() => setPkgMode("custom")}>
                          Xüsusi
                        </button>
                      </div>

                      {pkgMode === "catalog" ? (
                        <div className="fx-field">
                          <select className="fx-select" value={catalogId} onChange={e => setCatalogId(e.target.value === "" ? "" : Number(e.target.value))}>
                            <option value="">Paket seçin...</option>
                            {catalog.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sessionCount} seans — {p.packagePrice} AZN</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="fx-stack" style={{ gap: 8 }}>
                          <input className="fx-input" type="text" value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Paket adı (opsional)" />
                          <div style={{ display: "flex", gap: 8 }}>
                            <input className="fx-input" type="number" min={1} value={pkgSessions} onChange={e => setPkgSessions(e.target.value)} placeholder="Seans sayı" />
                            <input className="fx-input" type="number" min={0} value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} placeholder="Qiymət (AZN)" />
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
                        <DirectChoiceCheckbox checked={pkgPatientChoseDirectly} onChange={setPkgPatientChoseDirectly} />
                      </div>

                      <button type="button" disabled={sellingPkg} onClick={sellPackage}
                        className="fx-btn" style={{ width: "100%", marginTop: 18, background: "var(--lilac)", borderColor: "var(--lilac)", color: "#fff" }}>
                        {sellingPkg ? "Göndərilir..." : "Paketi sat"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {unclaimed && (
            <div style={{ margin: "0 24px 24px", padding: 18, borderRadius: 12, background: "var(--sage-bg)", border: "1px solid rgba(74,155,127,.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#2E6B54", marginBottom: 4 }}>Bu müraciət hovuzdadır</div>
                <div className="fx-muted" style={{ fontSize: 12.5 }}>Hələ heç kimə aid deyil — götürsəniz yalnız siz görəcəksiniz.</div>
              </div>
              <button type="button" disabled={claimBusy} onClick={claim}
                className="fx-btn" style={{ background: "var(--sage)", borderColor: "var(--sage)", color: "#fff", flexShrink: 0, cursor: claimBusy ? "wait" : "pointer", opacity: claimBusy ? 0.6 : 1 }}>
                <IconCheck className="fx-icon--sm" />
                Götür
              </button>
            </div>
          )}
        </div>
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
