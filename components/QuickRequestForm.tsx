"use client";

import { useState } from "react";
import { submitSessionRequest } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import { azNowTime, azTodayIso, pastPreferredCode } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Psixoloqsuz sürətli müraciət forması (Sayt BRD §8.2) — həm Əlaqə səhifəsində
 * inline, həm də sayt boyu "Bizə Müraciət Edin" modalında istifadə olunur.
 * Müraciət Operator Hovuzuna düşür; böhran açar-sözü aşkarlandıqda təcili
 * yardım xəbərdarlığı göstərilir (SAYT-FR-18).
 */

const INITIAL = {
  name: "", phone: "", email: "", age: "", reason: "",
  preferredDate: "", preferredTime: "", notes: "", budget: "",
};

/** Dəyər backend-ə göndərilir və operator panelində göstərilir — tərcümə OLUNMUR;
 *  yalnız görünən etiket lokallaşdırılır. */
const BUDGET_OPTIONS: { value: string; key: MessageKey }[] = [
  { value: "50 AZN-dək",       key: "quickReq.budget1" },
  { value: "50-100 AZN",       key: "quickReq.budget2" },
  { value: "100-200 AZN",      key: "quickReq.budget3" },
  { value: "200 AZN-dən çox",  key: "quickReq.budget4" },
  { value: "Danışıq əsasında", key: "quickReq.budget5" },
];

// Göndərişdən sonra istifadəçiyə prosesin şəffaflığı üçün göstərilir (müraciət → operator →
// psixoloq təyinatı → seans). Operator hovuz/claim/çevirmə axını ilə uyğundur.
const NEXT_STEPS: MessageKey[] = ["quickReq.step1", "quickReq.step2", "quickReq.step3"];

/**
 * @param intro «15 dəqiqəlik ödənişsiz tanışlıq» yolundan açılıbsa true — müraciət
 *        operator hovuzunda nişanla görünür ki, pulsuz görüş olduğu dərhal bilinsin.
 */
export default function QuickRequestForm({ onDone, intro }: { onDone?: () => void; intro?: boolean }) {
  const { t } = useT();
  const [form, setForm] = useState(INITIAL);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Hərf və xüsusi simvolları qəbul etmir — yalnız rəqəm, +, boşluq və defis.
  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = e.target.value.replace(/[^\d+\s-]/g, "");
    setForm(prev => ({ ...prev, phone: filtered }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())   { setError(t("quickReq.errName")); return; }
    if (!form.phone.trim())  { setError(t("quickReq.errPhone")); return; }
    if (form.phone.replace(/\D/g, "").length < 9) { setError(t("quickReq.errPhoneInvalid")); return; }
    if (!form.email.trim())  { setError(t("quickReq.errEmail")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError(t("quickReq.errEmailInvalid")); return; }
    if (!form.budget)        { setError(t("quickReq.errBudget")); return; }
    if (!form.reason.trim()) { setError(t("quickReq.errReason")); return; }
    // Keçmiş tarix/saat üçün müraciət qəbul edilmir.
    const past = pastPreferredCode(form.preferredDate, form.preferredTime);
    if (past) { setError(t(`sched.${past}` as MessageKey)); return; }
    // Üstünlük verilən tarix/saat sadəcə istəyi göstərir (real bron deyil, operator
    // zəngləşib uyğun vaxtı təyin edəcək) — vaxt məhdudiyyəti yoxdur.
    setError("");
    setSending(true);
    try {
      const res = await submitSessionRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        age: form.age ? Number(form.age) : undefined,
        reason: form.reason.trim(),
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        notes: form.notes.trim() || undefined,
        budget: form.budget || undefined,
        intro: intro || undefined,
      });
      setCrisisDetected(!!res?.crisisDetected);
      setSuccess(true);
    } catch (err: unknown) {
      // Brauzerin fetch() TypeError-u ("Failed to fetch" və s.) şəbəkə/CORS
      // səviyyəsində baş verir və backend-dən gələn oxunaqlı mesajdan fərqli
      // olaraq istifadəçi üçün mənasızdır — əvəzinə izah edici mesaj göstəririk.
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

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
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

        {/* Növbəti addımlar — prosesin şəffaflığı */}
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

        <p style={{ margin: "0 0 24px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
          {t("quickReq.emailNote")}
        </p>

        {/* Birbaşa əlaqə qaydası — məhz burada yazılır, çünki müraciət göndərildikdən
            sonrakı an ən çox oxunan andır. Şərtlər səhifəsində və FAQ-da da var. */}
        <p style={{
          margin: "0 0 24px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.55,
          background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "12px 14px",
          textAlign: "left",
        }}>
          {t("quickReq.contactRule")}
        </p>
        {crisisDetected && (
          <div style={{
            background: "#FEF3C7", border: "1px solid #F59E0B",
            borderRadius: 10, padding: "14px 16px", marginBottom: 24,
            textAlign: "left",
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
        {onDone && (
          <button
            onClick={onDone}
            style={{
              padding: "10px 28px", background: "var(--brand)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t("common.close")}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div style={{
          background: "#FEE2E2", color: "#991B1B",
          borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Name */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{t("quickReq.labelName")}</label>
        <input type="text" value={form.name} onChange={set("name")}
          placeholder={t("quickReq.phName")} style={inputStyle} />
      </div>

      {/* Phone */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{t("quickReq.labelPhone")}</label>
        <input type="tel" inputMode="tel" value={form.phone} onChange={setPhone}
          placeholder="+994 50 000 00 00" maxLength={20} style={inputStyle} />
      </div>

      {/* Email + Age */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>{t("quickReq.labelEmail")}</label>
          <input type="email" value={form.email} onChange={set("email")}
            placeholder="example@email.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t("quickReq.labelAge")}</label>
          <input type="number" value={form.age} onChange={set("age")}
            min={5} max={120} placeholder="25" style={inputStyle} />
        </div>
      </div>

      {/* Budget (Sayt BRD §8.2 — məcburi) */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{t("quickReq.labelBudget")}</label>
        <select value={form.budget} onChange={set("budget")} style={inputStyle}>
          <option value="">{t("quickReq.budgetPh")}</option>
          {BUDGET_OPTIONS.map(b => <option key={b.value} value={b.value}>{t(b.key)}</option>)}
        </select>
      </div>

      {/* Reason */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{t("quickReq.labelReason")}</label>
        <textarea value={form.reason} onChange={set("reason")} rows={4}
          placeholder={t("quickReq.phReason")}
          style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Preferred date + time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>{t("quickReq.labelDate")}</label>
          <DatePicker
            value={form.preferredDate}
            onChange={val => setForm(prev => ({ ...prev, preferredDate: val }))}
            placeholder="gg.aa.iiii"
            theme="light"
            min={azTodayIso()}
          />
        </div>
        <div>
          <label style={labelStyle}>{t("quickReq.labelTime")}</label>
          <TimePicker
            value={form.preferredTime}
            onChange={val => setForm(prev => ({ ...prev, preferredTime: val }))}
            theme="light"
            size="sm"
            min={form.preferredDate === azTodayIso() ? azNowTime() : undefined}
          />
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 22 }}>
        <label style={labelStyle}>{t("quickReq.labelNotes")}</label>
        <textarea value={form.notes} onChange={set("notes")} rows={2}
          placeholder={t("quickReq.phNotes")}
          style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <button
        type="submit"
        disabled={sending}
        style={{
          width: "100%", padding: "12px 0",
          background: "var(--brand)", color: "#fff",
          border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
          cursor: sending ? "not-allowed" : "pointer",
          opacity: sending ? 0.7 : 1,
        }}
      >
        {sending ? t("common.sending") : t("quickReq.submit")}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: 13,
  color: "#111",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
