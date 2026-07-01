"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApplicationStatus, type ApplicationStatusResult } from "@/lib/api";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function ApplicationStatusPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<ApplicationStatusResult | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("error");
      return;
    }
    getApplicationStatus(token)
      .then(res => { setData(res); setPhase("ready"); })
      .catch(() => setPhase("error"));
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
        maxWidth: 420,
        textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        {phase === "loading" && (
          <>
            <div className="mb-4 animate-pulse" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535]">Yoxlanılır...</h2>
            <p className="text-[#52718F] text-sm mt-2">Müraciətinizin statusu yüklənir</p>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Link etibarsızdır</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-6">
              Müraciət statusu linki etibarsızdır və ya vaxtı bitib. Zəhmət olmasa e-poçtunuzdakı düyməni yenidən klikləyin.
            </p>
            <Link
              href="/contact"
              className="block py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Bizimlə əlaqə
            </Link>
          </>
        )}

        {phase === "ready" && data?.status === "PENDING" && (
          <>
            <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Müraciətiniz baxılır</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-2">
              {data.firstName ? `Salam, ${data.firstName}! ` : ""}
              Müraciətiniz qəbul edilib və komandamız sənədlərinizi yoxlayır.
              Nəticə barədə e-poçt vasitəsilə bildiriş alacaqsınız.
            </p>
            <p className="text-[#8AAABF] text-xs leading-relaxed mb-6">
              Adətən bu proses 2–5 iş günü ərzində tamamlanır.
              {data.submittedAt ? ` Göndərilmə tarixi: ${fmtDate(data.submittedAt)}.` : ""}
            </p>
            <Link
              href="/"
              className="block py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--bg-blue)", color: "var(--oxford)" }}
            >
              Ana səhifəyə qayıt
            </Link>
          </>
        )}

        {phase === "ready" && data?.status === "APPROVED" && (
          <>
            <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Müraciətiniz təsdiqləndi!</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-6">
              {data.firstName ? `Təbriklər, ${data.firstName}! ` : ""}
              Artıq mövcud email və şifrənizlə psixoloq panelinə daxil ola bilərsiniz.
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

        {phase === "ready" && data?.status === "REJECTED" && (
          <>
            <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A2535] mb-2">Müraciətiniz qəbul edilmədi</h2>
            <p className="text-[#52718F] text-sm leading-relaxed mb-3">
              Təəssüf ki, hazırda müraciətinizi təsdiqləyə bilmədik.
            </p>
            {data.adminNote && (
              <div style={{
                background: "#FEF2F2", borderLeft: "4px solid #EF4444", borderRadius: 6,
                padding: "10px 14px", margin: "0 0 16px", textAlign: "left",
              }}>
                <p style={{ margin: 0, color: "#991B1B", fontSize: 13 }}>
                  <strong>Qeyd:</strong> {data.adminNote}
                </p>
              </div>
            )}
            <Link
              href="/contact"
              className="block py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Bizimlə əlaqə
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
