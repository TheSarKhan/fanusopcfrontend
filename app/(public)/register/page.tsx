"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { registerPatient, registerPsychologist } from "@/lib/api";

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

/* ─── Panel content ─── */
const PANEL = {
  patient: {
    title: "Özünüzə qayıt",
    sub: "Bir addım — və mütəxəssis dəstəyi sizin üçün hazır. Heç bir mühakimə, yalnız anlayış.",
    trust: ["Pulsuz ilk görüş", "100% məxfi", "Peşəkar dəstək"],
  },
  psychologist: {
    title: "Platformamıza qoşulun",
    sub: "Azərbaycanda psixoloji yardımı əlçatan etmək missiyasında bizimlə olun.",
    trust: ["Geniş müştəri bazası", "Çevik iş qrafiki", "Peşəkar dəstək komandası"],
  },
};

/* ─── Specs / certs data ─── */
const SPEC_OPTIONS = ["Depressiya", "Narahatlıq", "Travma", "Münasibətlər", "Stress", "Özünüinkişaf", "Ailə terapiyası", "Uşaq psixologiyası", "Böhran dəstəyi", "Yuxu pozğunluqları"];
const SESSION_TYPES = ["Fərdi seans", "Cütlük terapiyası", "Qrup terapiyası", "Uşaq terapiyası"];
const CERT_OPTIONS = ["CBT (Kognitiv-Davranış Terapiyası)", "EMDR", "Mindfulness", "Ailə sistemlər terapiyası", "Gestalt terapiyası", "DBT", "Psixoanaliz", "Pozitiv psixologiya"];
const LANGUAGE_OPTIONS = ["Azərbaycan dili", "Rus dili", "İngilis dili", "Türk dili", "Alman dili", "Fransız dili"];
const ACTIVITY_OPTIONS = [
  { value: "ONLINE", label: "Onlayn" },
  { value: "IN_PERSON", label: "Əyani" },
  { value: "BOTH", label: "Həm onlayn, həm də əyani" },
];

/* ─── Field component ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="auth-label">{label}</label>
      {children}
    </div>
  );
}

/* ─── Step dot ─── */
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

/* ─── Toggle chips ─── */
function ChipToggle({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="auth-cert-grid">
      {options.map(o => (
        <button
          key={o}
          type="button"
          className={`auth-cert-chip${selected.includes(o) ? " selected" : ""}`}
          onClick={() => onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o])}
        >
          {selected.includes(o) && (
            <svg width="11" height="11" fill="none" stroke="var(--oxford)" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          )}
          {o}
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════
   PATIENT FORM
════════════════════════════════════ */
function PatientForm({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return setError("Şifrələr uyğun deyil");
    setLoading(true); setError("");
    try {
      await registerPatient({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined });
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
      <p style={{ fontSize: 14, color: "var(--oxford-60)", lineHeight: 1.65, marginBottom: 28 }}>
        <strong style={{ color: "var(--oxford)" }}>{form.email}</strong> ünvanına təsdiq linki göndərildi. Linki klikləyərək hesabınızı fəallaşdırın.
      </p>
      <Link href="/login" className="btn btn-primary" style={{ borderRadius: 10, display: "block", textAlign: "center", height: 50, lineHeight: "50px", padding: "0 24px" }}>
        Daxil ol
      </Link>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Ad"><input className="auth-input" value={form.firstName} onChange={set("firstName")} placeholder="Adınız" required /></Field>
        <Field label="Soyad"><input className="auth-input" value={form.lastName} onChange={set("lastName")} placeholder="Soyadınız" required /></Field>
      </div>
      <Field label="Email"><input type="email" className="auth-input" value={form.email} onChange={set("email")} placeholder="email@nümunə.az" required /></Field>
      <Field label="Telefon (istəyə bağlı)"><input type="tel" className="auth-input" value={form.phone} onChange={set("phone")} placeholder="+994 50 000 00 00" /></Field>
      <Field label="Şifrə">
        <div className="auth-input-wrap">
          <input type={showPass ? "text" : "password"} className="auth-input" value={form.password} onChange={set("password")} placeholder="Ən az 8 simvol" required minLength={8} />
          <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}><EyeIcon open={showPass} /></button>
        </div>
      </Field>
      <Field label="Şifrəni təsdiqlə">
        <input type="password" className="auth-input" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Şifrənizi təkrar daxil edin" required />
      </Field>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onBack} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, flex: "0 0 auto", paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>
          {loading ? "Qeydiyyat edilir..." : "Qeydiyyatdan keç"}
        </button>
      </div>
    </form>
  );
}

/* ════════════════════════════════════
   PSYCHOLOGIST FORM (3 steps)
════════════════════════════════════ */
const PSY_STEPS = ["Şəxsi", "Təhsil", "Peşəkar"];

function PsychologistForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [personal, setPersonal] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", languages: [] as string[] });
  const [education, setEducation] = useState({ university: "", degree: "", graduationYear: "" });
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [certificateFiles, setCertificateFiles] = useState<File[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [professional, setProfessional] = useState({ specializations: [] as string[], sessionTypes: [] as string[], experienceYears: "", bio: "", certifications: [] as string[], activityFormat: "" });

  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setPersonal(p => ({ ...p, [k]: e.target.value }));
  const setE = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEducation(p => ({ ...p, [k]: e.target.value }));
  const setPro = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setProfessional(p => ({ ...p, [k]: e.target.value }));

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0 && personal.password !== personal.confirmPassword) return setError("Şifrələr uyğun deyil");
    if (step === 0 && personal.languages.length === 0) return setError("Ən az bir dil seçin");
    if (step === 1 && !diplomaFile) return setError("Zəhmət olmasa diplom faylını yükləyin");
    setError("");
    setStep(s => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (professional.specializations.length === 0) return setError("Ən az bir ixtisaslaşma seçin");
    if (!professional.activityFormat) return setError("Fəaliyyət formasını seçin");
    setLoading(true); setError("");
    try {
      await registerPsychologist({ ...personal, ...education, ...professional }, diplomaFile, certificateFiles, photoFile);
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
      <p style={{ fontSize: 14, color: "var(--oxford-60)", lineHeight: 1.65, marginBottom: 28 }}>
        Komandamız məlumatlarınızı yoxladıqdan sonra <strong style={{ color: "var(--oxford)" }}>{personal.email}</strong> ünvanına bildiriş göndərəcək. Bu adətən 1-2 iş günü çəkir.
      </p>
      <Link href="/login" className="btn btn-primary" style={{ borderRadius: 10, display: "block", textAlign: "center", height: 50, lineHeight: "50px" }}>
        Ana səhifəyə qayıt
      </Link>
    </div>
  );

  const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));
  const EXP_YEARS = ["1 ildən az", "1-3 il", "3-5 il", "5-10 il", "10+ il"];

  return (
    <>
      <StepIndicator steps={PSY_STEPS} current={step} />

      {/* STEP 0: Personal */}
      {step === 0 && (
        <form onSubmit={nextStep} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Ad"><input className="auth-input" value={personal.firstName} onChange={setP("firstName")} placeholder="Adınız" required /></Field>
            <Field label="Soyad"><input className="auth-input" value={personal.lastName} onChange={setP("lastName")} placeholder="Soyadınız" required /></Field>
          </div>
          <Field label="Email"><input type="email" className="auth-input" value={personal.email} onChange={setP("email")} placeholder="email@nümunə.az" required /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Telefon"><input type="tel" className="auth-input" value={personal.phone} onChange={setP("phone")} placeholder="+994 50 000 00 00" required /></Field>
            <Field label="Profil şəkli">
              <label className="auth-file-label" style={{ height: 42 }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
                <div className="auth-file-box" style={{ height: "100%", padding: "0 12px", justifyContent: "flex-start", gap: 8, fontSize: 13 }}>
                   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                   <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photoFile ? photoFile.name : "Şəkil seç"}</span>
                </div>
              </label>
            </Field>
          </div>
          <Field label="Bildiyi dillər">
            <div style={{ marginTop: 8 }}>
              <ChipToggle options={LANGUAGE_OPTIONS} selected={personal.languages} onChange={v => setPersonal(p => ({ ...p, languages: v }))} />
            </div>
          </Field>
          <Field label="Şifrə">
            <div className="auth-input-wrap">
              <input type={showPass ? "text" : "password"} className="auth-input" value={personal.password} onChange={setP("password")} placeholder="Ən az 8 simvol" required minLength={8} />
              <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}><EyeIcon open={showPass} /></button>
            </div>
          </Field>
          <Field label="Şifrəni təsdiqlə">
            <input type="password" className="auth-input" value={personal.confirmPassword} onChange={setP("confirmPassword")} placeholder="Şifrənizi təkrar daxil edin" required />
          </Field>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onBack} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, flex: "0 0 auto", paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>Növbəti →</button>
          </div>
        </form>
      )}

      {/* STEP 1: Education */}
      {step === 1 && (
        <form onSubmit={nextStep} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-blue)", border: "1px solid var(--oxford-10)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--oxford-60)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <svg width="16" height="16" fill="none" stroke="var(--oxford-60)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Psixologiya sahəsindəki diplom və təhsil məlumatlarınızı daxil edin. Yoxlama prosesindən keçəcək.
          </div>
          <Field label="Universitet / Ali məktəb">
            <input className="auth-input" value={education.university} onChange={setE("university")} placeholder="məs. Bakı Dövlət Universiteti" required />
          </Field>
          <Field label="İxtisas (diplom üzrə)">
            <input className="auth-input" value={education.degree} onChange={setE("degree")} placeholder="məs. Klinik psixologiya" required />
          </Field>
          <Field label="Bitirmə ili">
            <select className="auth-select" value={education.graduationYear} onChange={setE("graduationYear")} required>
              <option value="">Seçin</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Diplom faylı">
            <label className="auth-file-label">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={e => setDiplomaFile(e.target.files?.[0] ?? null)}
              />
              <div className="auth-file-box">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {diplomaFile ? (
                  <span style={{ color: "var(--oxford)", fontWeight: 500 }}>{diplomaFile.name}</span>
                ) : (
                  <span>PDF, JPG və ya PNG yükləyin</span>
                )}
              </div>
            </label>
          </Field>
          <Field label="Sertifikatlar və digər sənədlər (istəyə bağlı)">
            <label className="auth-file-label">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                style={{ display: "none" }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) setCertificateFiles(prev => [...prev, ...files]);
                }}
              />
              <div className="auth-file-box">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {certificateFiles.length > 0 ? (
                  <span style={{ color: "var(--oxford)", fontWeight: 500 }}>{certificateFiles.length} fayl seçildi</span>
                ) : (
                  <span>Çoxlu fayl seçə bilərsiniz</span>
                )}
              </div>
            </label>
            {certificateFiles.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {certificateFiles.map((f, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 8px", background: "var(--bg-blue)", border: "1px solid var(--oxford-10)", borderRadius: 6, color: "var(--oxford)" }}>
                    {f.name}
                    <button type="button" onClick={() => setCertificateFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--oxford-60)", lineHeight: 1, padding: 0, fontSize: 14 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setStep(0)} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, flex: "0 0 auto", paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>Növbəti →</button>
          </div>
        </form>
      )}

      {/* STEP 2: Professional */}
      {step === 2 && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="İxtisaslaşma sahələri (bir neçə seçə bilərsiniz)">
            <div style={{ marginTop: 8 }}>
              <ChipToggle options={SPEC_OPTIONS} selected={professional.specializations} onChange={v => setProfessional(p => ({ ...p, specializations: v }))} />
            </div>
          </Field>
          <Field label="Seans növləri">
            <div style={{ marginTop: 8 }}>
              <ChipToggle options={SESSION_TYPES} selected={professional.sessionTypes} onChange={v => setProfessional(p => ({ ...p, sessionTypes: v }))} />
            </div>
          </Field>
          <Field label="Fəaliyyət forması">
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {ACTIVITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProfessional(p => ({ ...p, activityFormat: opt.value }))}
                  style={{
                    flex: 1, padding: "10px 0", cursor: "pointer", fontSize: 13, transition: "all 0.18s",
                    border: `1.5px solid ${professional.activityFormat === opt.value ? "var(--oxford)" : "#DDE6F0"}`,
                    borderRadius: 8,
                    background: professional.activityFormat === opt.value ? "var(--bg-blue)" : "white",
                    color: professional.activityFormat === opt.value ? "var(--oxford)" : "var(--oxford-60)",
                    fontWeight: professional.activityFormat === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="İş təcrübəsi">
            <select className="auth-select" value={professional.experienceYears} onChange={e => setProfessional(p => ({ ...p, experienceYears: e.target.value }))} required>
              <option value="">Seçin</option>
              {EXP_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Özünüz haqqında (müştərilər görəcək)">
            <textarea
              className="auth-textarea"
              value={professional.bio}
              onChange={e => setProfessional(p => ({ ...p, bio: e.target.value }))}
              placeholder="Yanaşmanız, metodlarınız, müştərilərinizə nə vəd etdiyiniz haqqında qısa məlumat..."
              required
              rows={4}
            />
          </Field>
          <Field label="Sertifikatlar (istəyə bağlı)">
            <div style={{ marginTop: 8 }}>
              <ChipToggle options={CERT_OPTIONS} selected={professional.certifications} onChange={v => setProfessional(p => ({ ...p, certifications: v }))} />
            </div>
          </Field>
          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost" style={{ height: 50, borderRadius: 10, flex: "0 0 auto", paddingLeft: 20, paddingRight: 20 }}>← Geri</button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 50, fontSize: 15, borderRadius: 10, flex: 1 }}>
              {loading ? "Göndərilir..." : "Müraciət göndər"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

/* ════════════════════════════════════
   MAIN PAGE
════════════════════════════════════ */
type Role = "patient" | "psychologist" | null;

export default function RegisterPage() {
  const [role, setRole] = useState<Role>(null);

  const panelData = role ? PANEL[role] : PANEL.patient;

  return (
    <div className="auth-split">
      {/* ── Form side ── */}
      <div className="auth-form-side">
        {/* Top bar */}
        <div className="auth-topbar">
          <Link href="/">
            <Image src="/images/logos/logo-blue.png" alt="Fanus" width={100} height={33} style={{ objectFit: "contain" }} priority />
          </Link>
          <Link href="/" className="auth-back-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Sayta qayıt
          </Link>
        </div>

        <div className="auth-form-center">
        <div className="auth-form-box">

          {/* Role selector */}
          {!role && (
            <>
              <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>
                Qeydiyyat
              </h1>
              <p style={{ fontSize: 15, color: "var(--oxford-60)", marginBottom: 28 }}>
                Hansı rolda qeydiyyatdan keçmək istəyirsiniz?
              </p>
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
                Hesabınız var?{" "}
                <Link href="/login" style={{ color: "var(--oxford)", fontWeight: 600, textDecoration: "none" }}>Daxil ol</Link>
              </p>
            </>
          )}

          {/* Patient form */}
          {role === "patient" && (
            <>
              <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>
                Müştəri qeydiyyatı
              </h1>
              <p style={{ fontSize: 14, color: "var(--oxford-60)", marginBottom: 24 }}>
                Bir neçə saniyəyə hesabınızı yaradın
              </p>
              <PatientForm onBack={() => setRole(null)} />
              <p style={{ textAlign: "center", fontSize: 14, color: "var(--oxford-60)", marginTop: 20 }}>
                Hesabınız var?{" "}
                <Link href="/login" style={{ color: "var(--oxford)", fontWeight: 600, textDecoration: "none" }}>Daxil ol</Link>
              </p>
            </>
          )}

          {/* Psychologist form */}
          {role === "psychologist" && (
            <>
              <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>
                Psixoloq qeydiyyatı
              </h1>
              <p style={{ fontSize: 14, color: "var(--oxford-60)", marginBottom: 24 }}>
                Profilinizi yaradın — komandamız yoxladıqdan sonra aktivləşəcək
              </p>
              <PsychologistForm onBack={() => setRole(null)} />
              <p style={{ textAlign: "center", fontSize: 14, color: "var(--oxford-60)", marginTop: 20 }}>
                Hesabınız var?{" "}
                <Link href="/login" style={{ color: "var(--oxford)", fontWeight: 600, textDecoration: "none" }}>Daxil ol</Link>
              </p>
            </>
          )}
        </div>
        </div>
      </div>

      {/* ── Decorative panel ── */}
      <div className="auth-panel">
        <div className="auth-panel-blob auth-panel-blob-1" />
        <div className="auth-panel-blob auth-panel-blob-2" />
        <div className="auth-panel-content">
          <Image src="/images/logos/logo-white.png" alt="Fanus" width={120} height={40} style={{ objectFit: "contain" }} />
          <h2 className="auth-panel-title">{panelData.title}</h2>
          <p className="auth-panel-sub">{panelData.sub}</p>
          <div className="auth-panel-trust">
            {panelData.trust.map((t, i) => (
              <div key={i} className="auth-panel-trust-item">
                <div className="auth-panel-trust-icon">
                  <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
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
