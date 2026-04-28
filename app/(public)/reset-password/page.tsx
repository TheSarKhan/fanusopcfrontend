"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) { setError("Şifrələr uyğun deyil"); return; }
    setLoading(true);
    setError("");
    try {
      await resetPassword(token, newPassword);
      router.push("/login?reset=1");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xəta baş verdi");
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
        background: "#fff", borderRadius: "1.5rem", padding: "2.5rem",
        width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1A2535]">Yeni şifrə təyin et</h1>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Yeni şifrə</label>
            <input
              type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Ən az 8 simvol" required minLength={8}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Şifrəni təsdiqlə</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Şifrənizi təkrar daxil edin" required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>
          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 rounded-xl py-2 px-3">{error}</div>
          )}
          <button
            type="submit" disabled={loading || !token}
            className="py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: loading ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            {loading ? "Yenilənir..." : "Şifrəni yenilə →"}
          </button>
          <Link href="/login" className="text-center text-sm text-[#52718F] hover:underline">
            ← Giriş səhifəsinə qayıt
          </Link>
        </form>
      </div>
    </div>
  );
}
