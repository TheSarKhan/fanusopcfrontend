"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { checkEmail, registerPatient, registerPsychologist, type PsychologistRegistrationData } from "@/lib/api";
import PhotoCropper from "@/components/PhotoCropper";
import DatePicker from "@/components/DatePicker";
import { useT } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/* ─── Eye toggle ─── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const PANEL = {
  patient: {
    title: "Özünüzə qayıt",
    sub: "Bir addım — və mütəxəssis dəstəyi sizin üçün hazır.",
    trust: ["Pulsuz ilk görüş", "100% məxfi", "Peşəkar dəstək"],
  },
  psychologist: {
    title: "Platformamıza qoşulun",
    sub: "Azərbaycanda psixoloji yardımı əlçatan etmək missiyasında bizimlə olun.",
    trust: ["Geniş müştəri bazası", "Çevik iş qrafiki", "Peşəkar dəstək komandası"],
  },
};

const SPEC_OPTIONS = ["Depressiya", "Anksiyete", "Travma", "Münasibətlər", "Stress", "Özünüinkişaf", "Ailə terapiyası", "Uşaq psixologiyası", "Asılılıq", "Yuxu pozğunluqları", "Sevgi", "Böhran dəstəyi"];
const SESSION_TYPES = ["Fərdi seans", "Cütlük terapiyası", "Qrup terapiyası", "Uşaq terapiyası"];
const LANGUAGE_OPTIONS = ["Azərbaycan dili", "Rus dili", "İngilis dili", "Türk dili", "Alman dili", "Fransız dili"];
const DEGREE_OPTIONS = ["Bakalavr", "Magistr", "PhD / Doktor", "Rezident", "Digər"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="auth-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="auth-steps">
        {steps.map((_, i) => (
          <div key={i} className="auth-step" style={{ flex: i < steps.length - 1 ? "1" : "0" }}>
            <div className={`auth-step-dot ${i < current ? "done" : i === current ? "active" : ""}`}>
              {i < current ? (
                <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`auth-step-line ${i < current ? "done" : ""}`} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {steps.map((s, i) => (
          <span key={i} style={{ fontSize: 11, color: i <= current ? "var(--oxford)" : "var(--oxford-60)", fontWeight: i === current ? 600 : 400 }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function ChipToggle({ options, selected, onChange, allowCustom = false, customPlaceholder = "Başqa..." }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; allowCustom?: boolean; customPlaceholder?: string }) {
  const [custom, setCustom] = useState("");

  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]);

  // Selected values the preset list doesn't contain — user-added customs.
  // Render them as chips too so they stay visible and removable.
  const extras = selected.filter(s => !options.includes(s));

  const addCustom = () => {
    // Storage joins values with commas, so strip any to avoid a split later.
    const v = custom.replace(/,/g, " ").trim().replace(/\s+/g, " ");
    if (!v) { setCustom(""); return; }
    // Case-insensitive dedupe against presets + already-selected values.
    const exists = [...options, ...selected].some(x => x.toLowerCase() === v.toLowerCase());
    if (!exists) onChange([...selected, v]);
    setCustom("");
  };

  return (
    <div>
      <div className="auth-cert-grid">
        {[...options, ...extras].map(o => (
          <button key={o} type="button"
            className={`auth-cert-chip${selected.includes(o) ? " selected" : ""}`}
            onClick={() => toggle(o)}>
            {selected.includes(o) && (
              <svg width="11" height="11" fill="none" stroke="var(--oxford)" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
            {o}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            className="auth-input"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder={customPlaceholder}
            maxLength={40}
          />
          <button type="button" className="btn btn-ghost" onClick={addCustom}
            style={{ height: 48, borderRadius: 10, paddingLeft: 18, paddingRight: 18, whiteSpace: "nowrap" }}>
            Əlavə et
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Patient form ─── */
function PatientForm({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "", residentialAddress: "", password: "", confirmPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password))
      return setError("Şifrə ən az 8 simvol, böyük hərf, kiçik hərf və rəqəm ehtiva etməlidir.");
    if (form.password !== form.confirmPassword) return setError("Şifrələr uyğun deyil");
    setLoading(true); setError("");
    try {
      await registerPatient({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined, emergencyContactName: form.emergencyContactName || undefined, emergencyContactPhone: form.emergencyContactPhone || undefined, emergencyContactRelation: form.emergencyContactRelation || undefined, residentialAddress: form.residentialAddress || undefined });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Qeydiyyat uğursuz oldu");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--sage-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="28" height="28" fill="none" stroke="var(--sage)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--oxford)", marginBottom: 10 }}>Email göndərildi!</h2>
      <p style={{ fontSize: 14, color: "var(--oxford-60)", marginBottom: 28 }}>
        <strong style={{ color: "var(--oxford)" }}>{form.email}</strong> ünvanına təsdiq linki göndərildi.
      </p>
      <Link href="/login" className="btn btn-primary" style={{ borderRadius: 10, display: "block", textAlign: "center", height: 50, lineHeight: "50px" }}>Daxil ol</Link>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Ad"><input className="auth-input" value={form.firstName} onChange={set("firstName")} required /></Field>
        <Field label="Soyad"><input className="auth-input" value={form.lastName} onChange={set("lastName")} required /></Field>
      </div>
      <Field label="Email"><input type="email" className="auth-input" value={form.email} onChange={set("email")} required /></Field>
      <Field label="Telefon (opsional)"><input type="tel" className="auth-input" value={form.phone} onChange={set("phone")} /></Field>

      <div style={{ background: "#F9FAFB", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <strong style={{ fontSize: 13, color: "var(--oxford)" }}>{t("emergency.sectionTitle")}</strong>
          <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 4 }}>{t("emergency.note")}</div>
        </div>
        <Field label={t("emergency.contactName")}>
          <input className="auth-input" value={form.emergencyContactName} onChange={set("emergencyContactName")} placeholder={t("emergency.contactNamePh")} />
        </Field>
        <Field label={t("emergency.contactPhone")}>
          <input type="tel" className="auth-input" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder={t("emergency.contactPhonePh")} />
        </Field>
        <Field label={t("emergency.contactRelation")}>
          <input className="auth-input" value={form.emergencyContactRelation} onChange={set("emergencyContactRelation")} placeholder={t("emergency.contactRelationPh")} />
        </Field>
        <Field label={t("emergency.address")}>
          <input className="auth-input" value={form.residentialAddress} onChange={set("residentialAddress")} placeholder={t("emergency.addressPh")} />
        </Field>
      </div>

      <Field label="Şifrə">
        <div className="auth-input-wrap">
          <input type={showPass ? "text" : "password"} className="auth-input" value={form.password} onChange={set("password")} required />
          <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}><EyeIcon open={showPass} /></button>
        </div>
      </Field>
      <Field label="Şifrəni təsdiqlə">
        <div className="auth-input-wrap">
          <input type={showConfirm ? "text" : "password"} className="auth-input" value={form.confirmPassword} onChange={set("confirmPassword")} required />
          <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)}><EyeIcon open={showConfirm} /></button>
        </div>
      </Field>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onBack} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>
          {loading ? "Qeydiyyat..." : "Qeydiyyatdan keç"}
        </button>
      </div>
    </form>
  );
}

/* ─── Psychologist form (4 steps) ─── */
const PSY_STEPS = ["Şəxsi", "Təhsil", "Peşəkar", "Sertifikat"];
const EXP_YEARS = ["1 ildən az", "1-3 il", "3-5 il", "5-10 il", "10+ il"];
const YEARS = Array.from({ length: 60 }, (_, i) => String(new Date().getFullYear() - i));
/** Bir təhsili bitirmək üçün minimal ağlabatan yaş — doğum ili ilə bitirmə ilinin
 *  məntiqi ziddiyyətini (məs. doğum ili = bitirmə ili) qabaqcadan əngəlləyir. */
const MIN_GRADUATION_AGE = 18;

type EducationRow = { institution: string; degree: string; graduationYear: string };
type CertificateRow = { title: string; issuer: string; year: string; type: "CERTIFICATE" | "SEMINAR" };

function PsychologistForm({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    password: "", confirmPassword: "",
    birthDate: "", gender: "" as "" | "FEMALE" | "MALE" | "OTHER",
    finId: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoForCrop, setPhotoForCrop] = useState<File | null>(null);

  const [educations, setEducations] = useState<EducationRow[]>([
    { institution: "", degree: "", graduationYear: "" }
  ]);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);

  const birthYear = personal.birthDate ? Number(personal.birthDate.slice(0, 4)) : null;
  const graduationYearOptions = birthYear
    ? YEARS.filter(y => Number(y) - birthYear >= MIN_GRADUATION_AGE)
    : YEARS;

  const [professional, setProfessional] = useState({
    title: "", experienceYears: "", priorSessions: "",
    languages: [] as string[],
    specializations: [] as string[],
    sessionTypes: [] as string[],
    bio: "", motivation: "",
  });

  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [certificateFiles, setCertificateFiles] = useState<File[]>([]);
  const [consents, setConsents] = useState({ ethics: false, gdpr: false, terms: false });

  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPersonal(p => ({ ...p, [k]: e.target.value }));

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhotoForCrop(f);
    e.target.value = "";
  };
  const onCropped = (file: File, preview: string) => {
    setPhotoFile(file); setPhotoPreview(preview); setPhotoForCrop(null);
  };

  const addEducation = () => setEducations(prev => [...prev, { institution: "", degree: "", graduationYear: "" }]);
  const removeEducation = (i: number) => setEducations(prev => prev.filter((_, idx) => idx !== i));
  const updateEducation = (i: number, k: keyof EducationRow, v: string) =>
    setEducations(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const addCertificate = (type: "CERTIFICATE" | "SEMINAR") =>
    setCertificates(prev => [...prev, { title: "", issuer: "", year: "", type }]);
  const removeCertificate = (i: number) => setCertificates(prev => prev.filter((_, idx) => idx !== i));
  const updateCertificate = (i: number, k: keyof CertificateRow, v: string) =>
    setCertificates(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const validateStep0 = () => {
    if (!personal.firstName || !personal.lastName) return "Ad və soyad tələb olunur";
    if (!personal.email) return "Email tələb olunur";
    if (!personal.phone) return "Telefon tələb olunur";
    if (!personal.password || personal.password.length < 8 || !/[A-Z]/.test(personal.password) || !/[a-z]/.test(personal.password) || !/[0-9]/.test(personal.password))
      return "Şifrə ən az 8 simvol, böyük hərf, kiçik hərf və rəqəm ehtiva etməlidir.";
    if (personal.password !== personal.confirmPassword) return "Şifrələr uyğun deyil";
    if (!personal.birthDate) return "Doğum tarixi tələb olunur";
    if (!personal.gender) return "Cinsiyyət seçin";
    if (!personal.finId || personal.finId.length !== 7) return "FIN nömrəsi dəqiq 7 simvol olmalıdır";
    if (!photoFile) return "Profil şəklini yükləyib düzəldin";
    return null;
  };
  const validateStep1 = () => {
    const valid = educations.filter(e => e.institution.trim() && e.degree.trim() && e.graduationYear);
    if (valid.length === 0) return "Ən azı 1 təhsil tam doldurun";
    if (birthYear) {
      const invalid = valid.find(e => Number(e.graduationYear) - birthYear < MIN_GRADUATION_AGE);
      if (invalid) return `Bitirmə ili (${invalid.graduationYear}) doğum tarixinizlə uyğun deyil`;
    }
    if (!diplomaFile) return "Diplom faylı tələb olunur";
    return null;
  };
  const validateStep2 = () => {
    if (!professional.title) return "İxtisas / vəzifə adı daxil edin";
    if (!professional.experienceYears) return "Təcrübəni seçin";
    if (professional.priorSessions !== "" && (!Number.isFinite(Number(professional.priorSessions)) || Number(professional.priorSessions) < 0)) return "Seans sayı mənfi ola bilməz";
    if (professional.languages.length === 0) return "Ən azı bir dil seçin";
    if (professional.specializations.length === 0) return "Ən azı bir ixtisaslaşma seçin";
    const bioLen = professional.bio.trim().length;
    if (bioLen < 100) return "Bio ən azı 100 simvol olmalıdır";
    if (bioLen > 1000) return "Bio 1000 simvoldan uzun ola bilməz";
    return null;
  };
  const validateStep3 = () => {
    if (!consents.ethics || !consents.gdpr || !consents.terms) return "Bütün razılıqları işarələyin";
    return null;
  };

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    let err: string | null = null;
    if (step === 0) err = validateStep0();
    else if (step === 1) err = validateStep1();
    else if (step === 2) err = validateStep2();
    if (err) { setError(err); return; }

    if (step === 0) {
      setLoading(true);
      try {
        const res = await checkEmail(personal.email);
        if (res.taken) {
          setError("Bu email artıq qeydiyyatdan keçib. Daxil olmağa cəhd edin.");
          return;
        }
      } catch {
        // Network error — let the final submit surface it
      } finally {
        setLoading(false);
      }
    }

    setStep(s => s + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validateStep3();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const data: PsychologistRegistrationData = {
        email: personal.email, password: personal.password,
        firstName: personal.firstName, lastName: personal.lastName,
        phone: personal.phone,
        birthDate: personal.birthDate,
        gender: personal.gender as "FEMALE" | "MALE" | "OTHER",
        finId: personal.finId,
        title: professional.title,
        experienceYears: professional.experienceYears,
        priorSessions: professional.priorSessions ? Number(professional.priorSessions) : undefined,
        languages: professional.languages,
        specializations: professional.specializations,
        sessionTypes: professional.sessionTypes,
        educations: educations
          .filter(ed => ed.institution.trim())
          .map(ed => ({ institution: ed.institution.trim(), degree: ed.degree.trim() || undefined, graduationYear: ed.graduationYear || undefined })),
        certificates: certificates
          .filter(c => c.title.trim())
          .map(c => ({ title: c.title.trim(), issuer: c.issuer.trim() || undefined, year: c.year || undefined, type: c.type })),
        bio: professional.bio.trim(),
        motivation: professional.motivation.trim() || undefined,
        consentEthics: consents.ethics,
        consentGdpr: consents.gdpr,
        consentTerms: consents.terms,
      };
      await registerPsychologist(data, diplomaFile, certificateFiles, photoFile);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Qeydiyyat uğursuz oldu");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--sage-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="28" height="28" fill="none" stroke="var(--sage)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--oxford)", marginBottom: 10 }}>Müraciətiniz qəbul edildi!</h2>
      <p style={{ fontSize: 14, color: "var(--oxford-60)", marginBottom: 28 }}>
        Komandamız məlumatlarınızı yoxladıqdan sonra <strong style={{ color: "var(--oxford)" }}>{personal.email}</strong> ünvanına bildiriş göndərəcək.
      </p>
      <Link href="/" className="btn btn-primary" style={{ borderRadius: 10, display: "block", textAlign: "center", height: 50, lineHeight: "50px" }}>Ana səhifəyə qayıt</Link>
    </div>
  );

  return (
    <>
      <StepIndicator steps={PSY_STEPS} current={step} />

      {/* STEP 0 — Personal */}
      {step === 0 && (
        <form onSubmit={next} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Profil şəkli (məcburi)">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 80, height: 80, borderRadius: 10, background: "#F0F4FA", overflow: "hidden", border: "2px solid #E5E7EB", flexShrink: 0 }}>
                {photoPreview ? (
                   
                  <img src={photoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8AAABF", fontSize: 24 }}>?</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                <label style={{ display: "inline-block", cursor: "pointer" }}>
                  <input type="file" accept="image/*" onChange={onPickPhoto} style={{ display: "none" }} />
                  <span style={{ display: "inline-block", padding: "8px 14px", border: "1.5px solid var(--oxford)", borderRadius: 8, fontSize: 13, color: "var(--oxford)", background: "#fff", whiteSpace: "nowrap" }}>
                    {photoFile ? "Şəkli dəyiş" : "Şəkil seç və düzəlt"}
                  </span>
                </label>
                {photoFile && (
                  <div style={{ fontSize: 11, color: "var(--oxford-60)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={photoFile.name}>
                    {photoFile.name}
                  </div>
                )}
                {!photoFile && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "var(--oxford-60)", marginTop: 4 }}>
                    <span>JPG/PNG</span>
                    <span>sürüşdür və zoom et</span>
                  </div>
                )}
              </div>
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Ad"><input className="auth-input" value={personal.firstName} onChange={setP("firstName")} required style={{ minWidth: 0, width: "100%" }} /></Field>
            <Field label="Soyad"><input className="auth-input" value={personal.lastName} onChange={setP("lastName")} required style={{ minWidth: 0, width: "100%" }} /></Field>
          </div>
          <Field label="Email"><input type="email" className="auth-input" value={personal.email} onChange={setP("email")} required style={{ minWidth: 0, width: "100%" }} /></Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Telefon"><input type="tel" className="auth-input" value={personal.phone} onChange={setP("phone")} placeholder="+994 50 000 00 00" required style={{ minWidth: 0, width: "100%" }} /></Field>
            <Field label="Doğum tarixi"><DatePicker value={personal.birthDate} onChange={v => setPersonal(p => ({ ...p, birthDate: v }))} theme="light" style={{ minWidth: 0, width: "100%" }} ariaLabel="Doğum tarixi" /></Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Cinsiyyət">
              <select className="auth-select" value={personal.gender} onChange={setP("gender")} required style={{ minWidth: 0, width: "100%" }}>
                <option value="">Seçin</option>
                <option value="FEMALE">Qadın</option>
                <option value="MALE">Kişi</option>
                <option value="OTHER">Digər</option>
              </select>
            </Field>
            <Field label="FIN / ID nömrəsi">
              <input className="auth-input" value={personal.finId} onChange={setP("finId")} placeholder="məs. 1ABC234" required maxLength={7} style={{ minWidth: 0, width: "100%" }} />
            </Field>
          </div>

          <Field label="Şifrə">
            <div className="auth-input-wrap">
              <input type={showPass ? "text" : "password"} className="auth-input" value={personal.password} onChange={setP("password")} required />
              <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}><EyeIcon open={showPass} /></button>
            </div>
          </Field>
          <Field label="Şifrəni təsdiqlə">
            <div className="auth-input-wrap">
              <input type={showConfirm ? "text" : "password"} className="auth-input" value={personal.confirmPassword} onChange={setP("confirmPassword")} required />
              <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)}><EyeIcon open={showConfirm} /></button>
            </div>
          </Field>

          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onBack} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>
              {loading ? "Yoxlanılır..." : "Növbəti →"}
            </button>
          </div>
        </form>
      )}

      {/* STEP 1 — Education */}
      {step === 1 && (
        <form onSubmit={next} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-blue)", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--oxford-60)" }}>
            Bütün təhsillərinizi əlavə edin. Ən azı 1 ali təhsil tələb olunur.
          </div>

          {educations.map((ed, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: "var(--oxford)" }}>Təhsil #{i + 1}</strong>
                {educations.length > 1 && (
                  <button type="button" onClick={() => removeEducation(i)} style={{ fontSize: 12, color: "#991B1B", background: "transparent", border: "none", cursor: "pointer" }}>Sil</button>
                )}
              </div>
              <Field label="Təhsil müəssisəsi">
                <input className="auth-input" value={ed.institution} onChange={(e) => updateEducation(i, "institution", e.target.value)} placeholder="məs. Bakı Dövlət Universiteti" required />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 10, marginTop: 10 }}>
                <Field label="Dərəcə">
                  <select className="auth-select" value={ed.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)} required>
                    <option value="">Seçin</option>
                    {DEGREE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Bitirmə ili">
                  <select className="auth-select" value={ed.graduationYear} onChange={(e) => updateEducation(i, "graduationYear", e.target.value)} required>
                    <option value="">İl</option>
                    {graduationYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          ))}

          <button type="button" onClick={addEducation}
            style={{ padding: "10px 14px", border: "1.5px dashed var(--oxford-20)", background: "transparent", borderRadius: 10, fontSize: 13, color: "var(--oxford-60)", cursor: "pointer" }}>
            + Daha bir təhsil əlavə et
          </button>

          <Field label="Diplom faylı (məcburi)" hint="PDF, JPG və ya PNG. Admin yoxlayır">
            <label className="auth-file-label">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                onChange={e => setDiplomaFile(e.target.files?.[0] ?? null)} />
              <div className="auth-file-box">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {diplomaFile ? (
                  <span style={{ color: "var(--oxford)", fontWeight: 500 }}>{diplomaFile.name}</span>
                ) : (
                  <span>Diplom yükləyin</span>
                )}
              </div>
            </label>
          </Field>

          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setStep(0)} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>Növbəti →</button>
          </div>
        </form>
      )}

      {/* STEP 2 — Professional */}
      {step === 2 && (
        <form onSubmit={next} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="İxtisas / vəzifə adı" hint="məs. Klinik Psixoloq, Psixoterapevt">
            <input className="auth-input" value={professional.title}
              onChange={e => setProfessional(p => ({ ...p, title: e.target.value }))}
              placeholder="Klinik Psixoloq" required />
          </Field>

          <Field label="Ümumi təcrübə">
            <select className="auth-select" value={professional.experienceYears}
              onChange={e => setProfessional(p => ({ ...p, experienceYears: e.target.value }))} required>
              <option value="">Seçin</option>
              {EXP_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>

          <Field label={t("psyStats.registerLabel")} hint={t("psyStats.registerHint")}>
            <input type="number" min={0} className="auth-input" value={professional.priorSessions}
              onChange={e => setProfessional(p => ({ ...p, priorSessions: e.target.value }))}
              placeholder="0" />
          </Field>

          <Field label="Bildiyi dillər (bir neçə seçin)" hint="Siyahıda yoxdursa, dili yazıb əlavə edin">
            <ChipToggle options={LANGUAGE_OPTIONS} selected={professional.languages}
              onChange={v => setProfessional(p => ({ ...p, languages: v }))}
              allowCustom customPlaceholder="Başqa dil əlavə et..." />
          </Field>

          <Field label="İxtisaslaşma sahələri (bir neçə seçin)" hint="Müştərilər filter üçün bunu görəcək">
            <ChipToggle options={SPEC_OPTIONS} selected={professional.specializations}
              onChange={v => setProfessional(p => ({ ...p, specializations: v }))} />
          </Field>

          <Field label="Seans növləri (opsional)">
            <ChipToggle options={SESSION_TYPES} selected={professional.sessionTypes}
              onChange={v => setProfessional(p => ({ ...p, sessionTypes: v }))} />
          </Field>

          <Field label={`Özünüz haqqında — bio (${professional.bio.length}/1000)`} hint="100-1000 simvol — müştərilər görəcək">
            <textarea className="auth-textarea" rows={5} value={professional.bio}
              onChange={e => setProfessional(p => ({ ...p, bio: e.target.value }))}
              placeholder="Yanaşmanız, metodlarınız, müştərilərinizə nə vəd edirsiniz..." required />
          </Field>

          <Field label="Motivasiya / yanaşma (opsional)">
            <textarea className="auth-textarea" rows={3} value={professional.motivation}
              onChange={e => setProfessional(p => ({ ...p, motivation: e.target.value }))} />
          </Field>

          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>Növbəti →</button>
          </div>
        </form>
      )}

      {/* STEP 3 — Certificates + consents */}
      {step === 3 && (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-blue)", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--oxford-60)" }}>
            Sertifikat və seminarlar opsionaldır, lakin profilinizi gücləndirir.
          </div>

          {certificates.map((c, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: "var(--oxford)" }}>
                  {c.type === "SEMINAR" ? "Seminar" : "Sertifikat"} #{i + 1}
                </strong>
                <button type="button" onClick={() => removeCertificate(i)} style={{ fontSize: 12, color: "#991B1B", background: "transparent", border: "none", cursor: "pointer" }}>Sil</button>
              </div>
              <Field label={c.type === "SEMINAR" ? "Seminar adı" : "Sertifikat adı"}>
                <input className="auth-input" value={c.title}
                  onChange={(e) => updateCertificate(i, "title", e.target.value)} required />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 10, marginTop: 10 }}>
                <Field label="Verən təşkilat">
                  <input className="auth-input" value={c.issuer}
                    onChange={(e) => updateCertificate(i, "issuer", e.target.value)} />
                </Field>
                <Field label="İl">
                  <select className="auth-select" value={c.year}
                    onChange={(e) => updateCertificate(i, "year", e.target.value)}>
                    <option value="">İl</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => addCertificate("CERTIFICATE")}
              style={{ flex: 1, padding: "10px 14px", border: "1.5px dashed var(--oxford-20)", background: "transparent", borderRadius: 10, fontSize: 13, color: "var(--oxford-60)", cursor: "pointer" }}>
              + Sertifikat
            </button>
            <button type="button" onClick={() => addCertificate("SEMINAR")}
              style={{ flex: 1, padding: "10px 14px", border: "1.5px dashed var(--oxford-20)", background: "transparent", borderRadius: 10, fontSize: 13, color: "var(--oxford-60)", cursor: "pointer" }}>
              + Seminar
            </button>
          </div>

          <Field label="Sertifikat skanları (opsional)">
            <label className="auth-file-label">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: "none" }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) setCertificateFiles(prev => [...prev, ...files]);
                }} />
              <div className="auth-file-box">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {certificateFiles.length > 0 ? (
                  <span style={{ color: "var(--oxford)", fontWeight: 500 }}>{certificateFiles.length} fayl seçildi</span>
                ) : (
                  <span>Skanları yükləyin</span>
                )}
              </div>
            </label>
            {certificateFiles.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {certificateFiles.map((f, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 8px", background: "var(--bg-blue)", border: "1px solid var(--oxford-10)", borderRadius: 6, color: "var(--oxford)" }}>
                    {f.name}
                    <button type="button" onClick={() => setCertificateFiles(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--oxford-60)", lineHeight: 1, padding: 0, fontSize: 14 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <div style={{ background: "#F9FAFB", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <strong style={{ fontSize: 13, color: "var(--oxford)" }}>Razılıqlar (məcburi)</strong>
            <ConsentRow checked={consents.ethics} onChange={v => setConsents(c => ({ ...c, ethics: v }))}
              label="Mərkəzin etik kodeksini oxudum və qəbul edirəm" />
            <ConsentRow checked={consents.gdpr} onChange={v => setConsents(c => ({ ...c, gdpr: v }))}
              label="Şəxsi məlumatlarımın işlənməsinə razıyam (GDPR)" />
            <ConsentRow checked={consents.terms} onChange={v => setConsents(c => ({ ...c, terms: v }))}
              label="Platforma istifadə şərtlərini qəbul edirəm" />
          </div>

          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setStep(2)} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>
              {loading ? "Göndərilir..." : "Müraciət göndər"}
            </button>
          </div>
        </form>
      )}

      {photoForCrop && (
        <PhotoCropper initialFile={photoForCrop} onCropped={onCropped} onCancel={() => setPhotoForCrop(null)} />
      )}
    </>
  );
}

function ConsentRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "var(--oxford)", lineHeight: 1.4 }}>{label}</span>
    </label>
  );
}

/* ─── Main page ─── */
type Role = "patient" | "psychologist" | null;

export default function RegisterPage() {
  const { t } = useT();
  const [role, setRole] = useState<Role>(null);
  const panelData = role ? PANEL[role] : PANEL.patient;

  // "Bizə Qoşulun" (header/footer) linki psixoloq formasını birbaşa açır (Sayt BRD §16)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("role");
    if (p === "psychologist" || p === "patient") setRole(p);
  }, []);

  return (
    <div className="auth-split">
      <div className="auth-form-side">
        <div className="auth-topbar">
          <Link href="/">
            <Image src="/images/logos/logo-blue.png" alt="Fanus" width={100} height={33} style={{ objectFit: "contain" }} priority />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LanguageSwitcher variant="default" />
            <Link href="/" className="auth-back-btn">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {t("common.back")}
            </Link>
          </div>
        </div>

        <div className="auth-form-center">
          <div className="auth-form-box">
            {!role && (
              <>
                <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>{t("auth.registerTitle")}</h1>
                <p style={{ fontSize: 15, color: "var(--oxford-60)", marginBottom: 28 }}>{t("auth.registerSubtitle")}</p>
                <div className="auth-role-grid">
                  <button type="button" className="auth-role-card" onClick={() => setRole("patient")}>
                    <div className="auth-role-icon" style={{ background: "var(--bg-blue)", color: "var(--oxford)" }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                    <h3>Müştəri</h3>
                    <p>Psixoloji dəstək almaq istəyirəm</p>
                  </button>
                  <button type="button" className="auth-role-card" onClick={() => setRole("psychologist")}>
                    <div className="auth-role-icon" style={{ background: "var(--sage-soft)", color: "var(--sage)" }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </div>
                    <h3>Psixoloq</h3>
                    <p>Platforma üzərindən müştəri qəbul etmək istəyirəm</p>
                  </button>
                </div>
                <p style={{ textAlign: "center", fontSize: 14, color: "var(--oxford-60)", marginTop: 28 }}>
                  {t("auth.haveAccount")}{" "}
                  <Link href="/login" style={{ color: "var(--oxford)", fontWeight: 600, textDecoration: "none" }}>{t("nav.login")}</Link>
                </p>
              </>
            )}

            {role === "patient" && (
              <>
                <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>Müştəri qeydiyyatı</h1>
                <p style={{ fontSize: 14, color: "var(--oxford-60)", marginBottom: 24 }}>Bir neçə saniyəyə hesabınızı yaradın</p>
                <PatientForm onBack={() => setRole(null)} />
              </>
            )}

            {role === "psychologist" && (
              <>
                <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>Psixoloq qeydiyyatı</h1>
                <p style={{ fontSize: 14, color: "var(--oxford-60)", marginBottom: 24 }}>Profilinizi yaradın — komandamız yoxladıqdan sonra aktivləşəcək</p>
                <PsychologistForm onBack={() => setRole(null)} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-panel-content">
          <Image src="/images/logos/logo-white.png" alt="Fanus" width={110} height={36} style={{ objectFit: "contain" }} />
          <h2 className="auth-panel-title" style={{ fontFamily: "var(--serif)" }}>{panelData.title}</h2>
          <p className="auth-panel-sub">{panelData.sub}</p>
          <div className="auth-panel-trust">
            {panelData.trust.map(t => (
              <div key={t} className="auth-panel-trust-item">
                <div className="auth-panel-trust-icon">
                  <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <div className="auth-panel-trust-text">
                  <strong>{t}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
