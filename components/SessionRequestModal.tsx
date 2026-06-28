"use client";

import { useEffect, useRef, useState } from "react";
import { submitSessionRequest } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";

interface Props {
  open: boolean;
  onClose: () => void;
}

const INITIAL = {
  name: "", phone: "", email: "", age: "", reason: "",
  preferredDate: "", preferredTime: "", notes: "",
};

export default function SessionRequestModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(INITIAL);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset when opened
  useEffect(() => {
    if (open) { setForm(INITIAL); setError(""); setSuccess(false); }
  }, [open]);

  if (!open) return null;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())   { setError("Ad Soyad daxil edin"); return; }
    if (!form.phone.trim())  { setError("Telefon nömrəsi daxil edin"); return; }
    if (!form.reason.trim()) { setError("Müraciətin səbəbini yazın"); return; }
    setError("");
    setSending(true);
    try {
      await submitSessionRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        age: form.age ? Number(form.age) : undefined,
        reason: form.reason.trim(),
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        notes: form.notes.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Müraciət göndərilmədi. Yenidən cəhd edin.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(11,26,53,.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
      >
        {/* Modal */}
        <div style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 540,
          maxHeight: "92vh", overflowY: "auto",
          padding: "32px 32px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,.2)",
        }}>
          {/* Close */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0B1A35" }}>
                Seans üçün müraciət
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#52718F" }}>
                Formanı doldurun, operator sizinlə əlaqə saxlayacaq.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Bağla"
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, color: "#9CA3AF", flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {success ? (
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
                Müraciətiniz qəbul edildi!
              </h3>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#374151" }}>
                Ən qısa zamanda operator komandamız sizinlə əlaqə saxlayacaq.
                {form.email && " Təsdiq e-poçtu göndərildi."}
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 28px", background: "#5A4FC8", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Bağla
              </button>
            </div>
          ) : (
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
                <label style={labelStyle}>Ad Soyad *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Adınız və Soyadınız"
                  style={inputStyle}
                />
              </div>

              {/* Phone */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Əlaqə nömrəsi *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+994 50 000 00 00"
                  style={inputStyle}
                />
              </div>

              {/* Email + Age */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>E-poçt (opsional)</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="example@email.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Yaş</label>
                  <input
                    type="number"
                    value={form.age}
                    onChange={set("age")}
                    min={5} max={120}
                    placeholder="25"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Reason */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Müraciətin səbəbi *</label>
                <textarea
                  value={form.reason}
                  onChange={set("reason")}
                  rows={4}
                  placeholder="Nə haqqında məsləhət almaq istədiyinizi qısaca yazın..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Preferred date + time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Üstünlük verilən tarix (opsional)</label>
                  <DatePicker
                    value={form.preferredDate}
                    onChange={val => setForm(prev => ({ ...prev, preferredDate: val }))}
                    placeholder="gg.aa.iiii"
                    theme="light"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Saat (opsional)</label>
                  <TimePicker
                    value={form.preferredTime}
                    onChange={val => setForm(prev => ({ ...prev, preferredTime: val }))}
                    theme="light"
                    size="sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Əlavə qeydlər (opsional)</label>
                <textarea
                  value={form.notes}
                  onChange={set("notes")}
                  rows={2}
                  placeholder="Başqa bildirmək istədiyiniz bir şey..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                style={{
                  width: "100%", padding: "12px 0",
                  background: "#5A4FC8", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Göndərilir..." : "Müraciəti göndər"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
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
