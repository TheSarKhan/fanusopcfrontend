"use client";

import { useState, useEffect, useRef } from "react";
import { useBooking } from "@/context/BookingContext";

const WHATSAPP_NUMBER = "994501234567";

type Step = "choice" | "form" | "success";

interface FormData {
  name: string;
  contact: string;
  problem: string;
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function BookingModal() {
  const { isOpen, psychologistName, close } = useBooking();
  const [step, setStep] = useState<Step>("choice");
  const [form, setForm] = useState<FormData>({ name: "", contact: "", problem: "" });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("choice");
      setForm({ name: "", contact: "", problem: "" });
      setErrors({});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

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
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Ad Soyad daxil edin";
    if (!form.contact.trim()) e.contact = "Əlaqə məlumatı daxil edin";
    if (!form.problem.trim()) e.problem = "Problemin qısa təsvirini daxil edin";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setStep("success");
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(26,37,53,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
    >
      <div
        className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: "95dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#EEF4FB] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #3B6FA5, #1E4070)" }}
            >
              F
            </div>
            <div>
              <p className="font-bold text-[#1A2535] text-sm">
                {step === "choice" && "Randevu al"}
                {step === "form" && "Müraciət formu"}
                {step === "success" && "Müraciət qəbul edildi"}
              </p>
              {psychologistName && step !== "success" && (
                <p className="text-xs text-[#6B85A0]">{psychologistName}</p>
              )}
            </div>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B85A0] hover:bg-[#EEF4FB] transition-colors"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* STEP: CHOICE */}
          {step === "choice" && (
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-[#6B85A0] leading-relaxed">
                Randevu almaq üçün üsul seçin. Hər iki halda da 24 saat ərzində sizinlə əlaqə saxlanılacaq.
              </p>

              {/* Platform option */}
              <button
                onClick={() => setStep("form")}
                className="flex items-start gap-4 w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 group"
                style={{ borderColor: "#D5E3F0", background: "#FAFCFF" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#3B6FA5";
                  (e.currentTarget as HTMLElement).style.background = "#EEF4FB";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#D5E3F0";
                  (e.currentTarget as HTMLElement).style.background = "#FAFCFF";
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-[#EEF4FB] flex items-center justify-center text-[#3B6FA5] flex-shrink-0 mt-0.5">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1A2535] mb-1">Platforma üzərindən</p>
                  <p className="text-xs text-[#6B85A0] leading-relaxed">
                    Formu doldurun, admin sizə uyğun psixoloqunu təyin edib geri dönəcək.
                  </p>
                </div>
                <svg className="text-[#3B6FA5] flex-shrink-0 self-center" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* WhatsApp option */}
              <button
                onClick={handleWhatsApp}
                className="flex items-start gap-4 w-full text-left p-5 rounded-2xl border-2 transition-all duration-200"
                style={{ borderColor: "#D5E3F0", background: "#FAFCFF" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#22c55e";
                  (e.currentTarget as HTMLElement).style.background = "#f0fdf4";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#D5E3F0";
                  (e.currentTarget as HTMLElement).style.background = "#FAFCFF";
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#dcfce7", color: "#16a34a" }}>
                  <WhatsAppIcon />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1A2535] mb-1">WhatsApp ilə müraciət</p>
                  <p className="text-xs text-[#6B85A0] leading-relaxed">
                    Əvvəlcədən hazırlanmış mesajla birbaşa WhatsApp-a keçin.
                  </p>
                </div>
                <svg className="text-[#22c55e] flex-shrink-0 self-center" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <p className="text-center text-xs text-[#6B85A0]">
                🔒 Məlumatlarınız tam məxfi saxlanılır
              </p>
            </div>
          )}

          {/* STEP: FORM */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              <p className="text-sm text-[#6B85A0] leading-relaxed -mt-1">
                Aşağıdakı məlumatları doldurun. Komandamız 24 saat ərzində sizinlə əlaqə saxlayacaq.
              </p>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">
                  Ad Soyad <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Məs: Aytən Hüseynova"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-[#1A2535] placeholder-[#A8C0D6] outline-none transition-all duration-200"
                  style={{
                    border: `1.5px solid ${errors.name ? "#f87171" : "#D5E3F0"}`,
                    background: "#FAFCFF",
                  }}
                  onFocus={(e) => { if (!errors.name) (e.target as HTMLElement).style.borderColor = "#3B6FA5"; }}
                  onBlur={(e) => { if (!errors.name) (e.target as HTMLElement).style.borderColor = "#D5E3F0"; }}
                />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>

              {/* Contact */}
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">
                  Telefon və ya Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Məs: +994 50 123 45 67"
                  value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-[#1A2535] placeholder-[#A8C0D6] outline-none transition-all duration-200"
                  style={{
                    border: `1.5px solid ${errors.contact ? "#f87171" : "#D5E3F0"}`,
                    background: "#FAFCFF",
                  }}
                  onFocus={(e) => { if (!errors.contact) (e.target as HTMLElement).style.borderColor = "#3B6FA5"; }}
                  onBlur={(e) => { if (!errors.contact) (e.target as HTMLElement).style.borderColor = "#D5E3F0"; }}
                />
                {errors.contact && <p className="text-xs text-red-400 mt-1">{errors.contact}</p>}
              </div>

              {/* Problem */}
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">
                  Qısa problem təsviri <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Özünüzü necə hiss etdiyinizi qısaca izah edin..."
                  value={form.problem}
                  onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-[#1A2535] placeholder-[#A8C0D6] outline-none resize-none transition-all duration-200"
                  style={{
                    border: `1.5px solid ${errors.problem ? "#f87171" : "#D5E3F0"}`,
                    background: "#FAFCFF",
                  }}
                  onFocus={(e) => { if (!errors.problem) (e.target as HTMLElement).style.borderColor = "#3B6FA5"; }}
                  onBlur={(e) => { if (!errors.problem) (e.target as HTMLElement).style.borderColor = "#D5E3F0"; }}
                />
                {errors.problem && <p className="text-xs text-red-400 mt-1">{errors.problem}</p>}
              </div>

              <p className="text-xs text-[#6B85A0] flex items-center gap-1.5 -mt-1">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
                </svg>
                Məlumatlarınız gizli saxlanılır
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("choice")}
                  className="flex-shrink-0 px-4 py-3 rounded-xl text-sm font-semibold text-[#6B85A0] hover:bg-[#EEF4FB] transition-colors"
                >
                  ← Geri
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ background: loading ? "#6B85A0" : "#3B6FA5" }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Göndərilir...
                    </>
                  ) : (
                    "Müraciəti göndər →"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP: SUCCESS */}
          {step === "success" && (
            <div className="p-8 flex flex-col items-center text-center gap-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "#EEF4FB" }}
              >
                <svg width="28" height="28" fill="none" stroke="#3B6FA5" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-[#1A2535] text-lg mb-2">Müraciətiniz qəbul edildi!</h3>
                <p className="text-sm text-[#6B85A0] leading-relaxed max-w-xs mx-auto">
                  Komandamız <strong className="text-[#1A2535]">24 saat</strong> ərzində sizinlə{" "}
                  <strong className="text-[#1A2535]">{form.contact}</strong> vasitəsilə əlaqə saxlayacaq.
                </p>
              </div>

              <div
                className="w-full rounded-2xl p-4 text-sm text-[#3B6FA5] flex items-center gap-3"
                style={{ background: "#EEF4FB" }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
                <span>Ortalama cavab müddəti: <strong>2–4 saat</strong></span>
              </div>

              <button
                onClick={close}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "#3B6FA5" }}
              >
                Bağla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
