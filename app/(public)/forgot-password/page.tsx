"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function ForgotPasswordPage() {
  const { t } = useT();
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
      style={{ background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand) 100%)" }}
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
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto mb-4"
            style={{ background: "var(--brand)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1A2535]">{t("auth.forgotTitle")}</h1>
          <p className="text-sm text-[#52718F] mt-1">
            {sent ? t("auth.successForgot") : t("auth.forgotSubtitle")}
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-[#374151] text-sm leading-relaxed mb-6">
              <strong>{email}</strong> — {t("auth.successForgot")}
            </p>
            <Link
              href="/login"
              className="block py-3 rounded-xl text-sm font-bold text-center"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">{t("auth.email")}</label>
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
              style={{ background: loading ? "#52718F" : "var(--brand)" }}
            >
              {loading ? t("common.sending") : `${t("auth.forgotCta")} →`}
            </button>

            <Link
              href="/login"
              className="text-center text-sm text-[#52718F] hover:underline"
            >
              ← {t("auth.backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
