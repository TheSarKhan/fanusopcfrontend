"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      document.cookie = `adminToken=${data.accessToken}; path=/; max-age=900`;
      router.push("/admin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş uğursuz oldu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
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
            F
          </div>
          <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>
            Admin Panel
          </h1>
          <p className="text-sm text-[#52718F] mt-1">Fanus idarəetmə sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@fanus.az"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Şifrə</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
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
            className="py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: loading ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            {loading ? "Daxil olunur..." : "Daxil ol →"}
          </button>
        </form>
      </div>
    </div>
  );
}
