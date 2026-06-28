"use client";

import { useState } from "react";
import { submitContactMessage } from "@/lib/api";
import { useScrollReveal } from "@/lib/useScrollReveal";

const WHATSAPP_NUMBER = "994502017164";

const CONTACT_ITEMS = [
  {
    label: "Email",
    value: "salam@fanus.az",
    href: "mailto:salam@fanus.az",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    label: "Telefon",
    value: "+994 12 200 00 00",
    href: "tel:+994122000000",
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    value: "+994 50 201 71 64",
    href: `https://wa.me/${WHATSAPP_NUMBER}`,
    external: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    label: "İş saatları",
    value: "B.e–Şənbə: 09:00–18:00",
    href: undefined,
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
  },
];

type FormState = { name: string; email: string; phone: string; subject: string; message: string };

const EMPTY: FormState = { name: "", email: "", phone: "", subject: "", message: "" };

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  // GAP-09: tracking code shown on the success screen
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ref, visible } = useScrollReveal<HTMLElement>(0.1);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    };

    if (!trimmed.name) { setError("Adınızı daxil edin"); return; }
    if (!trimmed.message || trimmed.message.length < 10) {
      setError("Mesaj ən azı 10 simvol olmalıdır");
      return;
    }
    if (!trimmed.email && !trimmed.phone) {
      setError("Email və ya telefon nömrəsi qeyd edin ki, sizinlə əlaqə saxlaya bilək");
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitContactMessage({
        name: trimmed.name,
        email: trimmed.email || undefined,
        phone: trimmed.phone || undefined,
        subject: trimmed.subject || undefined,
        message: trimmed.message,
      });
      setTicketCode(created.ticketCode ?? null);
      setSentEmail(trimmed.email || null);
      setSuccess(true);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mesaj göndərilmədi. Yenidən cəhd edin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section ref={ref} className="contact-section" style={{ minHeight: "calc(100vh - 200px)" }}>
      <div className="container">

        <div
          className="contact-header"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <h1 className="contact-title">Bizə yazın.<br />Tezliklə qayıdırıq.</h1>
          <p className="contact-sub">
            Sualınız, təklifiniz və ya əməkdaşlıq istəyiniz varsa — formu doldurun, biz iş günü ərzində geri dönəcəyik.
          </p>
        </div>

        <div className="contact-grid">

          {/* Left — info chips */}
          <div
            className="contact-chips-col"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(-24px)",
              transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s",
            }}
          >
            {CONTACT_ITEMS.map((item, i) => (
              item.href ? (
                <a
                  key={i}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="contact-chip"
                >
                  <div className="contact-chip-icon">{item.icon}</div>
                  <div>
                    <p className="contact-chip-label">{item.label}</p>
                    <p className="contact-chip-value">{item.value}</p>
                  </div>
                </a>
              ) : (
                <div key={i} className="contact-chip">
                  <div className="contact-chip-icon">{item.icon}</div>
                  <div>
                    <p className="contact-chip-label">{item.label}</p>
                    <p className="contact-chip-value">{item.value}</p>
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Right — form */}
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              border: "1px solid #E4EDF6",
              padding: "32px",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(24px)",
              transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
              boxShadow: "0 4px 24px rgba(15, 28, 46, 0.04)",
            }}
          >
            {success ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#DCFCE7", color: "#166534",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F1C2E", margin: "0 0 8px" }}>
                  Mesajınız göndərildi
                </h3>
                {ticketCode && (
                  <div style={{
                    background: "#EEF5FF", border: "1px solid #C3D6F6", borderRadius: 12,
                    padding: "14px 18px", margin: "0 auto 16px", maxWidth: 280,
                  }}>
                    <p style={{ fontSize: 12, color: "#52718F", margin: "0 0 4px" }}>Müraciət nömrəniz</p>
                    <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "#002147", margin: 0 }}>
                      {ticketCode}
                    </p>
                  </div>
                )}
                <p style={{ fontSize: 14, color: "#52718F", margin: "0 0 24px", lineHeight: 1.5 }}>
                  Komandamız iş günü ərzində sizinlə əlaqə saxlayacaq.
                  {ticketCode ? " Statusu soruşmaq üçün bu nömrəni qeyd edin." : ""}
                  {sentEmail ? ` Təsdiq emaili ${sentEmail} ünvanına göndərildi.` : ""}
                </p>
                <button
                  onClick={() => { setSuccess(false); setTicketCode(null); setSentEmail(null); }}
                  style={{
                    padding: "9px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: "var(--brand)", color: "#fff",
                    border: "none", cursor: "pointer",
                  }}
                >
                  Yeni mesaj yaz
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0F1C2E", margin: "0 0 4px" }}>
                  Mesaj göndərin
                </h3>
                <p style={{ fontSize: 13, color: "#8AAABF", margin: "0 0 8px" }}>
                  Bütün məlumatlar konfidensial qalır
                </p>

                <Field label="Ad və soyad" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setField("name", e.target.value)}
                    placeholder="Adınız"
                    maxLength={120}
                    required
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setField("email", e.target.value)}
                      placeholder="email@nümunə.az"
                      maxLength={255}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Telefon">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setField("phone", e.target.value)}
                      placeholder="+994 50 123 45 67"
                      maxLength={40}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label="Mövzu">
                  <input
                    type="text"
                    value={form.subject}
                    onChange={e => setField("subject", e.target.value)}
                    placeholder="Məs: Randevu haqqında sual"
                    maxLength={200}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Mesajınız" required>
                  <textarea
                    value={form.message}
                    onChange={e => setField("message", e.target.value)}
                    placeholder="Necə kömək edə bilərik? Mümkün qədər ətraflı yazın…"
                    rows={5}
                    minLength={10}
                    maxLength={5000}
                    required
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  />
                </Field>

                {error && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 10,
                    background: "#FEE2E2", color: "#991B1B",
                    fontSize: 13, fontWeight: 500,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: 6,
                    padding: "12px 22px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                    background: submitting ? "#52718F" : "var(--brand)",
                    color: "#fff", border: "none",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {submitting ? "Göndərilir…" : "Mesaj göndər"}
                </button>

                <p style={{ fontSize: 12, color: "#8AAABF", textAlign: "center", margin: "4px 0 0" }}>
                  Yaxud{" "}
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Salam, sualım var.")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: "#25D366", fontWeight: 600, textDecoration: "none" }}
                  >
                    WhatsApp ilə yazın
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #E4EDF6",
  fontSize: 14,
  color: "#1A2535",
  outline: "none",
  background: "#F8FAFD",
  boxSizing: "border-box",
};
