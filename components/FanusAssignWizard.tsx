"use client";

import { useEffect, useRef, useState } from "react";
import { meApi, patientApi } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import { azFormatDate, azNowTime, azTodayIso, pastPreferredError } from "@/lib/datetime";

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

const BUDGET_OPTIONS = [
  "50 AZN-dək",
  "50-100 AZN",
  "100-200 AZN",
  "200 AZN-dən çox",
  "Danışıq əsasında",
];

const NEXT_STEPS = [
  "Operatorumuz müraciətinizi nəzərdən keçirir.",
  "Sizinlə əlaqə saxlayıb ehtiyacınıza uyğun psixoloqu təklif edirik.",
  "Psixoloq və seans vaxtı təsdiqlənir — seansınız planlanır.",
];

const STEPS = ["Əlaqə", "Ehtiyacınız", "Vaxt tərcihi"];

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
      if (!form.name.trim()) return "Ad və soyadınızı yazın";
      if (!form.phone.trim()) return "Əlaqə nömrənizi yazın";
      if (!form.email.trim()) return "E-poçtunuzu yazın";
    }
    if (step === 1) {
      if (!form.reason.trim()) return "Müraciətin səbəbini yazın";
      if (!form.budget) return "Büdcə aralığını seçin";
    }
    if (step === 2) {
      // Keçmiş tarix/saat üçün müraciət qəbul edilmir.
      const past = pastPreferredError(form.preferredDate, form.preferredTime);
      if (past) return past;
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

      const note = [
        "Fanus təyin etsin — psixoloq seçimi platformaya həvalə edilib.",
        "",
        `Səbəb: ${form.reason.trim()}`,
        form.age ? `Yaş: ${form.age}` : null,
        `Büdcə: ${form.budget}`,
        `Vaxt tərcihi: ${timePref}`,
        form.notes.trim() ? `Əlavə qeyd: ${form.notes.trim()}` : null,
        `Əlaqə: ${form.phone.trim()}, ${form.email.trim()}`,
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
          ? "Serverlə əlaqə qurula bilmədi. İnternet bağlantınızı yoxlayıb yenidən cəhd edin."
          : (err instanceof Error && err.message
              ? err.message
              : "Müraciət göndərilmədi. Yenidən cəhd edin.")
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
                Fanus təyin etsin
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#52718F" }}>
                Bir neçə sual — ehtiyacınıza uyğun psixoloqu biz seçək.
              </p>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Bağla"
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
              Müraciətiniz qəbul edildi!
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151" }}>
              Müraciətiniz operator komandamıza çatdı. Bundan sonra proses belə davam edir:
            </p>

            <div style={{
              background: "var(--brand-50)", border: "1px solid var(--brand-100)",
              borderRadius: 12, padding: "16px 18px", marginBottom: 14, textAlign: "left",
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0B1A35", marginBottom: 12 }}>
                Növbəti addımlar
              </div>
              {NEXT_STEPS.map((step, i) => (
                <div key={step} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  marginBottom: i === NEXT_STEPS.length - 1 ? 0 : 12,
                }}>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                    background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.5, paddingTop: 1 }}>{step}</span>
                </div>
              ))}
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
              Prosesin gedişatı və psixoloq təyinatı barədə e-poçtunuza bildiriş göndəriləcək.
            </p>

            {crisisDetected && (
              <div style={{
                background: "#FEF3C7", border: "1px solid #F59E0B",
                borderRadius: 10, padding: "14px 16px", marginBottom: 20, textAlign: "left",
              }}>
                <strong style={{ display: "block", fontSize: 14, color: "#92400E", marginBottom: 6 }}>
                  Təcili dəstəyə ehtiyacınız varsa
                </strong>
                <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>
                  Müraciətiniz prioritet olaraq qəbul edildi. Özünüzə zərər vermə düşüncələriniz
                  varsa, gözləməyin — dərhal <strong>103</strong> Təcili Tibbi Yardım xəttinə və ya{" "}
                  <strong>*1123</strong> Psixoloji Dəstək xəttinə zəng edin.
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
              Bağla
            </button>
          </div>
        ) : (
          <>
            {/* Mərhələ göstəricisi */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {STEPS.map((label, i) => (
                <div key={label} style={{ flex: 1 }}>
                  <div style={{
                    height: 4, borderRadius: 999,
                    background: i <= step ? "var(--brand, #1051B7)" : "#E5EAF2",
                  }} />
                  <div style={{
                    marginTop: 6, fontSize: 11, fontWeight: 600,
                    color: i <= step ? "var(--brand, #1051B7)" : "#9CA3AF",
                  }}>
                    {label}
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
                    Bu məlumatlar hesabınızdan götürülür. Dəyişmək üçün profil səhifənizi yeniləyin.
                  </div>
                  <Field label={locked.name ? "Ad Soyad" : "Ad Soyad *"}>
                    <input style={locked.name ? lockedStyle : inputStyle} value={form.name}
                           readOnly={locked.name}
                           onChange={e => set("name")(e.target.value)} />
                  </Field>
                  <Field label={locked.phone ? "Əlaqə nömrəsi" : "Əlaqə nömrəsi *"}>
                    <input style={locked.phone ? lockedStyle : inputStyle} value={form.phone}
                           readOnly={locked.phone}
                           onChange={e => set("phone")(e.target.value)}
                           placeholder="+994 XX XXX XX XX" />
                  </Field>
                  <Field label={locked.email ? "E-poçt" : "E-poçt *"}>
                    <input style={locked.email ? lockedStyle : inputStyle} type="email" value={form.email}
                           readOnly={locked.email}
                           onChange={e => set("email")(e.target.value)} />
                  </Field>
                  <Field label="Yaş (opsional)">
                    <input style={inputStyle} type="number" min={0} value={form.age} onChange={e => set("age")(e.target.value)} />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Müraciətin səbəbi *">
                    <textarea
                      style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
                      value={form.reason}
                      onChange={e => set("reason")(e.target.value)}
                      placeholder="Nə ilə bağlı dəstək axtarırsınız?"
                    />
                  </Field>
                  <Field label="Büdcə *">
                    <select style={inputStyle} value={form.budget} onChange={e => set("budget")(e.target.value)}>
                      <option value="">Seçin</option>
                      {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Üstünlük verilən tarix (opsional)">
                    <DatePicker
                      value={form.preferredDate}
                      onChange={set("preferredDate")}
                      placeholder="gg.aa.iiii"
                      theme="light"
                      min={azTodayIso()}
                    />
                  </Field>
                  <Field label="Saat (opsional)">
                    <TimePicker
                      value={form.preferredTime}
                      onChange={set("preferredTime")}
                      theme="light"
                      size="sm"
                      min={form.preferredDate === azTodayIso() ? azNowTime() : undefined}
                    />
                  </Field>
                  <Field label="Əlavə qeydlər (opsional)">
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
                    Geri
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={next} className="fanus-btn fanus-btn-primary">
                    İrəli
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={sending} className="fanus-btn fanus-btn-primary">
                    {sending ? "Göndərilir…" : "Müraciəti göndər"}
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
