"use client";

import { useEffect, useRef, useState } from "react";
import { meApi, patientApi } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import { azFormatDate, azTodayIso, pastPreferredCode } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * "Fanus təyin etsin" — login olmuş pasiyent hansı psixoloqu seçəcəyini bilmirsə,
 * seçimi Fanus-a həvalə edir. Mərhələ-mərhələ soruşur; ad/telefon/e-poçt
 * profildən öncədən dolu gəlir.
 *
 * Bu QONAQ müraciəti DEYİL — pasiyentin hesabı var, ona görə nəticə sayt
 * müraciətlərinə yox, RANDEVU HOVUZUNA düşür: adi randevudur, sadəcə psixoloq
 * seçilməyib və vaxt məcburi deyil. Toplanan əlavə məlumat (yaş, büdcə, vaxt
 * tərcihi, qeyd) randevunun qeyd sahəsində operatora ötürülür.
 */

/** Backend böhran açar-sözü aşkarlayanda qeydin əvvəlinə bu nişanı qoyur
 *  (AppointmentService.CRISIS_NOTE_MARKER). */
const CRISIS_NOTE_MARKER = "[TƏCİLİ]";

/** Dəyər operator qeydinə yazılır və backend-ə gedir — tərcümə OLUNMUR;
 *  yalnız görünən etiket lokallaşdırılır. */
const BUDGET_OPTIONS: { value: string; key: MessageKey }[] = [
  { value: "50 AZN-dək",       key: "quickReq.budget1" },
  { value: "50-100 AZN",       key: "quickReq.budget2" },
  { value: "100-200 AZN",      key: "quickReq.budget3" },
  { value: "200 AZN-dən çox",  key: "quickReq.budget4" },
  { value: "Danışıq əsasında", key: "quickReq.budget5" },
];

const NEXT_STEPS: MessageKey[] = ["quickReq.step1", "quickReq.step2", "quickReq.step3"];

const STEPS: MessageKey[] = ["patAssign.step1", "patAssign.step2", "patAssign.step3"];

const INITIAL = {
  name: "", phone: "", email: "", age: "", reason: "",
  budget: "", preferredDate: "", preferredTime: "", notes: "",
};

export default function FanusAssignWizard({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState(false);
  /** Hesabdan gələn və dəyişdirilə bilməyən sahələr. */
  const [locked, setLocked] = useState({ name: false, phone: false, email: false });

  const set = (k: keyof typeof INITIAL) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  // Vaxt tərcihi tək `withTime` seçici ilə idarə olunur, amma aşağıdakı məntiq
  // (keçmiş vaxt yoxlaması, requestedStartAt, operator qeydi) tarix və saatı ayrı
  // görməli olduğu üçün burada birləşdirilib/parçalanır.
  const preferredAt = form.preferredDate
    ? `${form.preferredDate}T${form.preferredTime || "00:00"}`
    : "";
  const setPreferredAt = (v: string) => {
    const [d, t] = v.split("T");
    setForm(f => ({ ...f, preferredDate: d ?? "", preferredTime: (t ?? "").slice(0, 5) }));
  };

  // Açılanda sıfırla + profildən ad/telefon/e-poçt gətir (yenidən yazmasın).
  useEffect(() => {
    if (!open) return;
    setStep(0); setForm(INITIAL); setError(""); setSuccess(false); setCrisisDetected(false);
    setLocked({ name: false, phone: false, email: false });
    let cancelled = false;
    meApi.get().then(me => {
      if (cancelled) return;
      const full = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
      setForm(f => ({ ...f, name: full, email: me.email ?? "", phone: me.phone ?? "" }));
      // Yalnız hesabda DOLU olan sahə kilidlənir — profildə telefon yoxdursa
      // istifadəçi onu yaza bilsin, yoxsa forma keçilməz olur.
      setLocked({
        name: !!full,
        phone: !!(me.phone && me.phone.trim()),
        email: !!(me.email && me.email.trim()),
      });
    }).catch(() => { /* profil gəlmədisə istifadəçi əl ilə doldurar */ });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const validateStep = (): string => {
    if (step === 0) {
      if (!form.name.trim()) return t("patAssign.errName");
      if (!form.phone.trim()) return t("patAssign.errPhone");
      if (!form.email.trim()) return t("patAssign.errEmail");
    }
    if (step === 1) {
      if (!form.reason.trim()) return t("quickReq.errReason");
      if (!form.budget) return t("patAssign.errBudget");
    }
    if (step === 2) {
      // Keçmiş tarix/saat üçün müraciət qəbul edilmir.
      const past = pastPreferredCode(form.preferredDate, form.preferredTime);
      if (past) return t(`sched.${past}` as MessageKey);
    }
    return "";
  };

  const next = () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setError("");
    setStep(s => s + 1);
  };

  const back = () => { setError(""); setStep(s => Math.max(0, s - 1)); };

  const submit = async () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setError("");
    setSending(true);
    try {
      // Vaxt YALNIZ hər ikisi seçildikdə struktur sahəyə gedir; yarımçıq
      // tərcih (tək tarix) qeyddə qalır ki, operator nəzərə alsın.
      const requestedStartAt =
        form.preferredDate && form.preferredTime
          ? `${form.preferredDate}T${form.preferredTime}:00`
          : undefined;

      const timePref = form.preferredDate
        ? `${azFormatDate(form.preferredDate)}${form.preferredTime ? ` ${form.preferredTime}` : ""}`
        : "Fərq etmir";

      // Operator detal səhifəsi bu mətni «Etiket: dəyər» sətirlərinə görə
      // səliqəli cüt-cüt göstərir (bax RequestNote) — ona görə hər məlumat
      // AYRI sətirdə və qısa etiketlə gedir, sərbəst mətn birinci sətirdədir.
      const note = [
        "Psixoloq seçimi Fanusa həvalə edilib",
        `Səbəb: ${form.reason.trim()}`,
        form.age ? `Yaş: ${form.age}` : null,
        `Büdcə: ${form.budget}`,
        `Vaxt tərcihi: ${timePref}`,
        form.notes.trim() ? `Əlavə qeyd: ${form.notes.trim()}` : null,
        `Telefon: ${form.phone.trim()}`,
        `E-poçt: ${form.email.trim()}`,
      ].filter(Boolean).join("\n");

      const created = await patientApi.book({
        note,
        requestedPsychologistId: null,
        requestedStartAt,
        sessionKind: "STANDARD",
      });
      setCrisisDetected(!!created?.note?.startsWith(CRISIS_NOTE_MARKER));
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        err instanceof TypeError
          ? t("quickReq.errNetwork")
          : (err instanceof Error && err.message
              ? err.message
              : t("quickReq.errSubmit"))
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(11,26,53,.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540,
        maxHeight: "92vh", overflowY: "auto", padding: "28px 28px 24px",
        boxShadow: "0 20px 60px rgba(0,0,0,.2)",
      }}>
        {/* Başlıq — uğur ekranında yalnız bağlama düyməsi qalır, mətn
            mərkəzləşdirilmiş nəticə blokunun içindədir (qonaq müraciəti ilə eyni). */}
        <div style={{
          display: "flex", justifyContent: success ? "flex-end" : "space-between",
          alignItems: "flex-start", marginBottom: success ? 0 : 18,
        }}>
          {!success && (
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0B1A35" }}>
                {t("patAssign.title")}
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#52718F" }}>
                {t("patAssign.sub")}
              </p>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9CA3AF", flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {success ? (
          /* Nəticə ekranı qonaq müraciətindəki (QuickRequestForm) ilə eynidir —
             eyni axının iki qapısı olduğu üçün eyni görünməlidir. */
          <div style={{ textAlign: "center", padding: "8px 0 0" }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#065F46" }}>
              {t("quickReq.successTitle")}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151" }}>
              {t("quickReq.successBody")}
            </p>

            <div style={{
              background: "var(--brand-50)", border: "1px solid var(--brand-100)",
              borderRadius: 12, padding: "16px 18px", marginBottom: 14, textAlign: "left",
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1A35", marginBottom: 12 }}>
                {t("quickReq.stepsTitle")}
              </div>
              {NEXT_STEPS.map((stepKey, i) => (
                <div key={stepKey} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  marginBottom: i === NEXT_STEPS.length - 1 ? 0 : 12,
                }}>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                    background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.5, paddingTop: 1 }}>{t(stepKey)}</span>
                </div>
              ))}
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
              {t("quickReq.emailNote")}
            </p>

            {crisisDetected && (
              <div style={{
                background: "#FEF3C7", border: "1px solid #F59E0B",
                borderRadius: 10, padding: "14px 16px", marginBottom: 20, textAlign: "left",
              }}>
                <strong style={{ display: "block", fontSize: 14, color: "#92400E", marginBottom: 6 }}>
                  {t("quickReq.crisisTitle")}
                </strong>
                <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>
                  {t("quickReq.crisisP1")} <strong>103</strong> {t("quickReq.crisisP2")}{" "}
                  <strong>*1123</strong> {t("quickReq.crisisP3")}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 28px", background: "var(--brand)", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t("common.close")}
            </button>
          </div>
        ) : (
          <>
            {/* Mərhələ göstəricisi */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {STEPS.map((labelKey, i) => (
                <div key={labelKey} style={{ flex: 1 }}>
                  <div style={{
                    height: 4, borderRadius: 999,
                    background: i <= step ? "var(--brand, #1051B7)" : "#E5EAF2",
                  }} />
                  <div style={{
                    marginTop: 6, fontSize: 11, fontWeight: 600,
                    color: i <= step ? "var(--brand, #1051B7)" : "#9CA3AF",
                  }}>
                    {t(labelKey)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {step === 0 && (
                <>
                  {/* Kimlik sahələri hesabdan gəlir və MÖHÜRLÜDÜR. Əvvəl redaktə
                      oluna bilirdi: başqa e-poçt yazıldıqda müraciət qonaq kimi
                      düşür və operator çevirəndə dublikat pasiyent yaranırdı.
                      Server də eyni qaydanı tətbiq edir (yalnız UI-a güvənmirik). */}
                  <div style={{
                    background: "#F2F6FD", border: "1px solid #D8E2EF", borderRadius: 10,
                    padding: "10px 12px", fontSize: 12.5, color: "#52718F", lineHeight: 1.55,
                  }}>
                    {t("patAssign.accountNote")}
                  </div>
                  <Field label={locked.name ? t("patAssign.fName") : t("patAssign.fNameReq")}>
                    <input style={locked.name ? lockedStyle : inputStyle} value={form.name}
                           readOnly={locked.name}
                           onChange={e => set("name")(e.target.value)} />
                  </Field>
                  <Field label={locked.phone ? t("patAssign.fPhone") : t("patAssign.fPhoneReq")}>
                    <input style={locked.phone ? lockedStyle : inputStyle} value={form.phone}
                           readOnly={locked.phone}
                           onChange={e => set("phone")(e.target.value)}
                           placeholder="+994 XX XXX XX XX" />
                  </Field>
                  <Field label={locked.email ? t("patAssign.fEmail") : t("patAssign.fEmailReq")}>
                    <input style={locked.email ? lockedStyle : inputStyle} type="email" value={form.email}
                           readOnly={locked.email}
                           onChange={e => set("email")(e.target.value)} />
                  </Field>
                  <Field label={t("patAssign.fAge")}>
                    <input style={inputStyle} type="number" min={0} value={form.age} onChange={e => set("age")(e.target.value)} />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label={t("patAssign.fReason")}>
                    <textarea
                      style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
                      value={form.reason}
                      onChange={e => set("reason")(e.target.value)}
                      placeholder={t("patAssign.reasonPh")}
                    />
                  </Field>
                  <Field label={t("patAssign.fBudget")}>
                    <select style={inputStyle} value={form.budget} onChange={e => set("budget")(e.target.value)}>
                      <option value="">{t("patAssign.budgetPh")}</option>
                      {BUDGET_OPTIONS.map(b => <option key={b.value} value={b.value}>{t(b.key)}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  {/* Tarix və saat AYRI sahələr idi (DatePicker + TimePicker) — indi
                      randevu istəyindəki kimi tək `withTime` seçici: təqvimin altında
                      saat/dəqiqə sətri və "Hazır" düyməsi var, seçim orada bitir. */}
                  <Field label={t("patAssign.fPreferred")}>
                    <DatePicker
                      withTime
                      value={preferredAt}
                      onChange={setPreferredAt}
                      placeholder="gg.aa.iiii ss:dd"
                      theme="light"
                      clearable
                      min={azTodayIso()}
                    />
                  </Field>
                  <Field label={t("patAssign.fNotes")}>
                    <textarea
                      style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                      value={form.notes}
                      onChange={e => set("notes")(e.target.value)}
                    />
                  </Field>
                </>
              )}

              {error && (
                <div style={{
                  background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
                  padding: "10px 12px", fontSize: 13, color: "#991B1B",
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                {step > 0 && (
                  <button type="button" onClick={back} disabled={sending} className="fanus-btn fanus-btn-ghost">
                    {t("common.back")}
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={next} className="fanus-btn fanus-btn-primary">
                    {t("common.next")}
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={sending} className="fanus-btn fanus-btn-primary">
                    {sending ? t("common.sending") : t("quickReq.submit")}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#0B1A35" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid #D8E2EF", background: "#fff",
  fontSize: 14, color: "#0B1A35", fontFamily: "inherit",
};

/** Hesabdan gələn, dəyişdirilə bilməyən sahə. */
const lockedStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#F7F9FC",
  color: "#52718F",
  cursor: "not-allowed",
};
