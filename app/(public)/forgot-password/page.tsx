"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

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
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            🔑
          </div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Şifrəni sıfırla</h1>
          <p className="text-sm text-[#52718F] mt-1">
            {sent ? "Email göndərildi" : "Email ünvanınızı daxil edin"}
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-[#374151] text-sm leading-relaxed mb-6">
              Əgər <strong>{email}</strong> sistemdə mövcuddursa,
              şifrə sıfırlama linki göndərildi. Email-inizi yoxlayın.
            </p>
            <Link
              href="/login"
              className="block py-3 rounded-xl text-sm font-bold text-white text-center"
              style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
            >
              Daxil ol səhifəsinə qayıt
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@nümunə.az"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: loading ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}
            >
              {loading ? "Göndərilir..." : "Sıfırlama linki göndər →"}
            </button>

            <Link
              href="/login"
              className="text-center text-sm text-[#52718F] hover:underline"
            >
              ← Geri qayıt
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
