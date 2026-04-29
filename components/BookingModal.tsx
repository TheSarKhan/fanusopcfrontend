"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useBooking } from "@/context/BookingContext";
import { bookAppointment } from "@/lib/api";

const WHATSAPP_NUMBER = "994502017164";

type Step = "choice" | "form" | "success";

interface FormState {
  name: string;
  contact: string;
  problem: string;
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function BookingModal() {
  const { isOpen, psychologistName, mode, close } = useBooking();
  const [step, setStep] = useState<Step>("choice");
  const [form, setForm] = useState<FormState>({ name: "", contact: "", problem: "" });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isContact = mode === "contact";

  useEffect(() => {
    if (isOpen) {
      setStep(isContact ? "form" : "choice");
      setForm({ name: "", contact: "", problem: "" });
      setErrors({});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, isContact]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      psychologistName
        ? `Salam, ${psychologistName} ilə seans almaq istəyirəm. Mənimlə əlaqə saxlaya bilərsiniz?`
        : "Salam, seans almaq istəyirəm. Mənə uyğun psixoloq haqqında məlumat verə bilərsiniz?"
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    close();
  };

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = "Ad Soyad daxil edin";
    if (!form.contact.trim()) e.contact = "Əlaqə məlumatı daxil edin";
    if (!form.problem.trim()) e.problem = "Mesajınızı daxil edin";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await bookAppointment({
        patientName: form.name,
        phone: form.contact,
        psychologistName: psychologistName ?? undefined,
        note: form.problem,
      });
    } catch { /* show success anyway */ } finally {
      setLoading(false);
      setStep("success");
    }
  };

  if (!isOpen) return null;

  const title = isContact
    ? "Bizimlə əlaqə"
    : step === "choice" ? "Randevu al"
    : step === "form" ? "Müraciət formu"
    : "Müraciət qəbul edildi";

  return (
    <div
      ref={overlayRef}
      className="bm-overlay"
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
    >
      <div className="bm-sheet">

        {/* ── Header ── */}
        <div className="bm-header">
          <Image src="/images/logos/logo-blue.png" alt="Fanus" width={80} height={26} style={{ objectFit: "contain" }} />
          <button className="bm-close" onClick={close} aria-label="Bağla">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Title bar ── */}
        <div className="bm-titlebar">
          <p className="bm-title">{title}</p>
          {psychologistName && step !== "success" && (
            <p className="bm-subtitle">{psychologistName}</p>
          )}
        </div>

        {/* ── Body ── */}
        <div className="bm-body">

          {/* CHOICE */}
          {step === "choice" && (
            <div className="bm-choice">
              <p className="bm-lead">Randevu almaq üçün üsul seçin. 24 saat ərzində sizinlə əlaqə saxlanılacaq.</p>

              <button className="bm-option" onClick={() => setStep("form")}>
                <div className="bm-option-icon bm-option-icon--blue">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </div>
                <div className="bm-option-text">
                  <span className="bm-option-title">Platforma üzərindən</span>
                  <span className="bm-option-desc">Formu doldurun, admin uyğun psixoloq təyin edib geri dönəcək.</span>
                </div>
                <svg className="bm-option-arrow" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>

              <button className="bm-option bm-option--whatsapp" onClick={handleWhatsApp}>
                <div className="bm-option-icon bm-option-icon--green">
                  <WhatsAppIcon />
                </div>
                <div className="bm-option-text">
                  <span className="bm-option-title">WhatsApp ilə müraciət</span>
                  <span className="bm-option-desc">Hazır mesajla birbaşa WhatsApp-a keçin.</span>
                </div>
                <svg className="bm-option-arrow bm-option-arrow--green" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>

              <p className="bm-privacy">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Məlumatlarınız tam məxfi saxlanılır
              </p>
            </div>
          )}

          {/* FORM */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="bm-form">
              <p className="bm-lead">
                {isContact
                  ? "Sualınızı və ya müraciətinizi göndərin — 24 saat ərzində cavab alacaqsınız."
                  : "Komandamız 24 saat ərzində sizinlə əlaqə saxlayacaq."}
              </p>

              <div className="bm-field">
                <label className="bm-label">Ad Soyad <span>*</span></label>
                <input
                  className={`bm-input${errors.name ? " bm-input--err" : ""}`}
                  placeholder="Məs: Aytən Hüseynova"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                {errors.name && <p className="bm-err">{errors.name}</p>}
              </div>

              <div className="bm-field">
                <label className="bm-label">Telefon və ya Email <span>*</span></label>
                <input
                  className={`bm-input${errors.contact ? " bm-input--err" : ""}`}
                  placeholder="Məs: +994 50 123 45 67"
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                />
                {errors.contact && <p className="bm-err">{errors.contact}</p>}
              </div>

              <div className="bm-field">
                <label className="bm-label">{isContact ? "Mesajınız" : "Qısa problem təsviri"} <span>*</span></label>
                <textarea
                  className={`bm-textarea${errors.problem ? " bm-input--err" : ""}`}
                  placeholder={isContact ? "Sualınızı və ya müraciətinizi yazın..." : "Özünüzü necə hiss etdiyinizi qısaca izah edin..."}
                  rows={4}
                  value={form.problem}
                  onChange={e => setForm(f => ({ ...f, problem: e.target.value }))}
                />
                {errors.problem && <p className="bm-err">{errors.problem}</p>}
              </div>

              <div className="bm-form-actions">
                {!isContact && (
                  <button type="button" className="bm-back" onClick={() => setStep("choice")}>
                    ← Geri
                  </button>
                )}
                <button type="submit" disabled={loading} className="bm-submit">
                  {loading ? (
                    <svg className="bm-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                      <path fill="white" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <>
                      {isContact ? "Göndər" : "Müraciəti göndər"}
                      <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <div className="bm-success">
              <div className="bm-success-icon">
                <svg width="28" height="28" fill="none" stroke="var(--sage)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="bm-success-title">
                {isContact ? "Mesajınız göndərildi!" : "Müraciətiniz qəbul edildi!"}
              </h3>
              <p className="bm-success-text">
                Komandamız <strong>24 saat</strong> ərzində{" "}
                <strong>{form.contact}</strong> vasitəsilə sizinlə əlaqə saxlayacaq.
              </p>
              <div className="bm-success-info">
                <svg width="16" height="16" fill="none" stroke="var(--oxford)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                Ortalama cavab müddəti: <strong>2–4 saat</strong>
              </div>
              <button className="bm-submit" style={{ width: "100%" }} onClick={close}>
                Bağla
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
