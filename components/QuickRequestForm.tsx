"use client";

import { useState } from "react";
import { submitSessionRequest } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import { azNowLocal } from "@/lib/datetime";

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

const BUDGET_OPTIONS = [
  "50 AZN-dək",
  "50-100 AZN",
  "100-200 AZN",
  "200 AZN-dən çox",
  "Danışıq əsasında",
];

export default function QuickRequestForm({ onDone }: { onDone?: () => void }) {
  const [form, setForm] = useState(INITIAL);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())   { setError("Ad Soyad daxil edin"); return; }
    if (!form.phone.trim())  { setError("Telefon nömrəsi daxil edin"); return; }
    if (!form.budget)        { setError("Büdcə seçin"); return; }
    if (!form.reason.trim()) { setError("Müraciətin səbəbini yazın"); return; }
    // Üstünlük verilən tarix/saat opsionaldır, lakin verilibsə keçmiş ola bilməz
    // (Asia/Baku divar-saatı; backend də eyni yoxlamanı aparır).
    if (form.preferredDate) {
      const nowLocal = azNowLocal();            // "YYYY-MM-DDTHH:mm" (Asia/Baku)
      const today = nowLocal.slice(0, 10);
      if (form.preferredDate < today) {
        setError("Keçmiş tarix üçün müraciət göndərmək olmaz");
        return;
      }
      if (form.preferredDate === today && form.preferredTime
          && `${form.preferredDate}T${form.preferredTime}` < nowLocal) {
        setError("Keçmiş saat üçün müraciət göndərmək olmaz");
        return;
      }
    }
    setError("");
    setSending(true);
    try {
      const res = await submitSessionRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        age: form.age ? Number(form.age) : undefined,
        reason: form.reason.trim(),
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        notes: form.notes.trim() || undefined,
        budget: form.budget || undefined,
      });
      setCrisisDetected(!!res?.crisisDetected);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Müraciət göndərilmədi. Yenidən cəhd edin.");
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
          Müraciətiniz qəbul edildi!
        </h3>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#374151" }}>
          Ən qısa zamanda operator komandamız sizinlə əlaqə saxlayacaq.
          {form.email && " Təsdiq e-poçtu göndərildi."}
        </p>
        {crisisDetected && (
          <div style={{
            background: "#FEF3C7", border: "1px solid #F59E0B",
            borderRadius: 10, padding: "14px 16px", marginBottom: 24,
            textAlign: "left",
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
        {onDone && (
          <button
            onClick={onDone}
            style={{
              padding: "10px 28px", background: "#5A4FC8", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Bağla
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
        <label style={labelStyle}>Ad Soyad *</label>
        <input type="text" value={form.name} onChange={set("name")}
          placeholder="Adınız və Soyadınız" style={inputStyle} />
      </div>

      {/* Phone */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Əlaqə nömrəsi *</label>
        <input type="tel" value={form.phone} onChange={set("phone")}
          placeholder="+994 50 000 00 00" style={inputStyle} />
      </div>

      {/* Email + Age */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>E-poçt (opsional)</label>
          <input type="email" value={form.email} onChange={set("email")}
            placeholder="example@email.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Yaş</label>
          <input type="number" value={form.age} onChange={set("age")}
            min={5} max={120} placeholder="25" style={inputStyle} />
        </div>
      </div>

      {/* Budget (Sayt BRD §8.2 — məcburi) */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Büdcə *</label>
        <select value={form.budget} onChange={set("budget")} style={inputStyle}>
          <option value="">Seçin...</option>
          {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Reason */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Müraciətin səbəbi *</label>
        <textarea value={form.reason} onChange={set("reason")} rows={4}
          placeholder="Nə haqqında məsləhət almaq istədiyinizi qısaca yazın..."
          style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Preferred date + time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Üstünlük verilən tarix (opsional)</label>
          <DatePicker
            value={form.preferredDate}
            onChange={val => setForm(prev => ({ ...prev, preferredDate: val }))}
            min={azNowLocal().slice(0, 10)}
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
        <textarea value={form.notes} onChange={set("notes")} rows={2}
          placeholder="Başqa bildirmək istədiyiniz bir şey..."
          style={{ ...inputStyle, resize: "vertical" }} />
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
