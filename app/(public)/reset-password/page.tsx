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
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd))
      return t("auth.passwordWeak");
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwdError = validatePassword(newPassword);
    if (pwdError) { setError(pwdError); return; }
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
            <div className="relative">
              <input
                type={showNew ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder={t("auth.passwordRequirements")} required
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none"
                style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
              />
              <button
                type="button" onClick={() => setShowNew(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#52718F] hover:text-[#1A2535]"
                tabIndex={-1}
              >
                {showNew ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">{t("auth.confirmPassword")}</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder={t("auth.confirmPassword")} required
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none"
                style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
              />
              <button
                type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#52718F] hover:text-[#1A2535]"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
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
