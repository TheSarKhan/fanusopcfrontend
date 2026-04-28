"use client";

import { useState } from "react";
import { getStoredUser } from "@/lib/auth";

export default function PatientProfilePage() {
  const user = getStoredUser();

  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: "",
    dateOfBirth: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // TODO: Phase 3-də patient profile API əlavə olunacaq
    await new Promise(r => setTimeout(r, 600));
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-[#1A2535] mb-1">Profilim</h1>
      <p className="text-[#52718F] text-sm mb-8">Şəxsi məlumatlarınızı idarə edin</p>

      <div style={{
        background: "#fff", borderRadius: "1rem", padding: "2rem",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8 pb-6" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            {(form.firstName?.[0] ?? "P").toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-[#1A2535]">
              {form.firstName} {form.lastName}
            </div>
            <div className="text-[#52718F] text-sm">{form.email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Ad</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Soyad</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              disabled
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #E5E7EB", background: "#F9FAFB", color: "#9CA3AF" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Telefon</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+994 50 000 00 00"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Doğum tarixi</label>
            <input
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          <div className="flex items-center gap-4 mt-2">
            <button
              type="submit"
              disabled={saving}
              className="py-3 px-8 rounded-xl text-sm font-bold text-white"
              style={{ background: saving ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}
            >
              {saving ? "Saxlanılır..." : "Yadda saxla"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">✓ Saxlanıldı</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
