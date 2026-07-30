"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { reactivateConfirm } from "@/lib/api";

export default function ReactivatePage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Yanlış link. Zəhmət olmasa email-inizdəki bərpa linkini yenidən klikləyin.");
      return;
    }
    reactivateConfirm(token)
      .then(() => setStatus("success"))
      .catch(err => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Bərpa uğursuz oldu");
      });
  }, [token]);

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
        textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        {status === "loading" && (
          <>
            <div className="mb-4 animate-pulse" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535]">Bərpa olunur...</h2>
            <p className="text-[#52718F] text-sm mt-2">Hesabınız yenidən aktivləşdirilir</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Hesabınız bərpa olundu!</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-6">
              Bütün məlumatlarınız (profil, tarixçə) yerindədir. İndi köhnə şifrənizlə daxil ola bilərsiniz.
            </p>
            <Link
              href="/login"
              className="block py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Daxil ol
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Bərpa alınmadı</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-6">
              {message || "Bərpa linki keçərsiz və ya vaxtı bitib. Yenidən cəhd edin — giriş səhifəsindən yeni bərpa linki istəyin."}
            </p>
            <Link
              href="/login"
              className="block py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Giriş səhifəsi
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
