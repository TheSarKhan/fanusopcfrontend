"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function ResetPasswordPage() {
  const { t } = useT();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) { setError(t("auth.passwordMismatch")); return; }
    setLoading(true);
    setError("");
    try {
      await resetPassword(token, newPassword);
      router.push("/login?reset=1");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand) 100%)" }}
    >
      <div style={{
        background: "#fff", borderRadius: "1.5rem", padding: "2.5rem",
        width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1A2535]">{t("auth.resetTitle")}</h1>
          <p className="text-sm text-[#52718F] mt-1">{t("auth.resetSubtitle")}</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">{t("auth.password")}</label>
            <input
              type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder={t("auth.passwordRequirements")} required minLength={8}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">{t("auth.confirmPassword")}</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder={t("auth.confirmPassword")} required
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
            style={{ background: loading ? "#52718F" : "var(--brand)" }}
          >
            {loading ? t("common.saving") : `${t("auth.resetCta")} →`}
          </button>
          <Link href="/login" className="text-center text-sm text-[#52718F] hover:underline">
            ← {t("auth.backToLogin")}
          </Link>
        </form>
      </div>
    </div>
  );
}
