"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerPatient } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Şifrələr uyğun deyil");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await registerPatient({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Qeydiyyat uğursuz oldu");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "linear-gradient(135deg, #0F1C2E 0%, #1E3A5F 50%, #2A57B0 100%)" }}
      >
        <div style={{
          background: "#fff",
          borderRadius: "1.5rem",
          padding: "2.5rem",
          width: "100%",
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        }}>
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-xl font-bold text-[#1A2535] mb-2">Email göndərildi!</h2>
          <p className="text-[#52718F] text-sm leading-relaxed">
            <strong>{form.email}</strong> ünvanına təsdiq linki göndərildi.
            Email-inizdəki linki klikləyərək hesabınızı fəallaşdırın.
          </p>
          <Link
            href="/login"
            className="block mt-6 py-3 rounded-xl text-sm font-bold text-white text-center"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            Daxil ol
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(135deg, #0F1C2E 0%, #1E3A5F 50%, #2A57B0 100%)" }}
    >
      <div style={{
        background: "#fff",
        borderRadius: "1.5rem",
        padding: "2.5rem",
        width: "100%",
        maxWidth: 440,
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            F
          </div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Qeydiyyat</h1>
          <p className="text-sm text-[#52718F] mt-1">Fanus platformasına qoşulun</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Ad</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="Adınız"
                required
                className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Soyad</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Soyadınız"
                required
                className="w-full px-3 py-3 rounded-xl text-sm outline-none"
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
              onChange={handleChange}
              placeholder="email@nümunə.az"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Telefon (istəyə bağlı)</label>
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
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Şifrə</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Ən az 8 simvol"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Şifrəni təsdiqlə</label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Şifrənizi təkrar daxil edin"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 rounded-xl py-2 px-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="py-3 rounded-xl text-sm font-bold text-white transition-all mt-1"
            style={{ background: loading ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            {loading ? "Qeydiyyat edilir..." : "Qeydiyyatdan keç →"}
          </button>
        </form>

        <p className="text-center text-sm text-[#52718F] mt-6">
          Hesabınız var?{" "}
          <Link href="/login" className="text-[#3B6FA5] font-semibold hover:underline">
            Daxil ol
          </Link>
        </p>
      </div>
    </div>
  );
}
