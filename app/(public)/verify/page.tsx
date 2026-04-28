"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/api";

export default function VerifyPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Yanlış link. Zəhmət olmasa email-inizdəki linki yenidən klikləyin.");
      return;
    }
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(err => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Təsdiq uğursuz oldu");
      });
  }, [token]);

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
        {status === "loading" && (
          <>
            <div className="text-4xl mb-4 animate-pulse">🔄</div>
            <h2 className="text-xl font-bold text-[#1A2535]">Yoxlanılır...</h2>
            <p className="text-[#52718F] text-sm mt-2">Email ünvanınız təsdiqlənir</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Email təsdiqləndi!</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-6">
              Hesabınız fəallaşdırıldı. İndi daxil ola bilərsiniz.
            </p>
            <Link
              href="/login"
              className="block py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
            >
              Daxil ol →
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Xəta baş verdi</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-6">
              {message || "Təsdiq linki etibarsızdır və ya müddəti bitib."}
            </p>
            <Link
              href="/register"
              className="block py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
            >
              Yenidən qeydiyyat
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
