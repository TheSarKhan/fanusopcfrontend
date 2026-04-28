"use client";

import Link from "next/link";
import { getStoredUser } from "@/lib/auth";

export default function PatientDashboard() {
  const user = getStoredUser();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A2535]">
          Salam, {user?.firstName ?? "Pasiyent"}! 👋
        </h1>
        <p className="text-[#52718F] text-sm mt-1">
          Fanus Pasiyent Panelinə xoş gəldiniz
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div style={{
          background: "#fff", borderRadius: "1rem", padding: "1.5rem",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div className="text-3xl mb-3">📅</div>
          <div className="text-lg font-bold text-[#1A2535]">Randevularım</div>
          <p className="text-[#52718F] text-sm mt-1">Randevu tarixçənizi izləyin</p>
          <Link
            href="/patient/appointments"
            className="inline-block mt-4 text-xs font-semibold text-[#3B6FA5] hover:underline"
          >
            Bax →
          </Link>
        </div>

        <div style={{
          background: "#fff", borderRadius: "1rem", padding: "1.5rem",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div className="text-3xl mb-3">👤</div>
          <div className="text-lg font-bold text-[#1A2535]">Profilim</div>
          <p className="text-[#52718F] text-sm mt-1">Şəxsi məlumatlarınızı idarə edin</p>
          <Link
            href="/patient/profile"
            className="inline-block mt-4 text-xs font-semibold text-[#3B6FA5] hover:underline"
          >
            Redaktə et →
          </Link>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #002147, #5A4FC8)", borderRadius: "1rem", padding: "1.5rem",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}>
          <div className="text-3xl mb-3">🔍</div>
          <div className="text-lg font-bold text-white">Psixoloq tap</div>
          <p className="text-white/70 text-sm mt-1">Sizə uyğun psixoloqu seçin</p>
          <Link
            href="/psychologists"
            className="inline-block mt-4 text-xs font-semibold text-white hover:underline"
          >
            Psixoloqlara bax →
          </Link>
        </div>
      </div>

      <div style={{
        background: "#fff", borderRadius: "1rem", padding: "2rem",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        <h2 className="font-bold text-[#1A2535] mb-2">Tez randevu al</h2>
        <p className="text-[#52718F] text-sm mb-4">
          Psixologlarımızdan biri ilə vaxtını ayır
        </p>
        <Link
          href="/psychologists"
          className="inline-block py-2.5 px-6 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
        >
          Randevu al →
        </Link>
      </div>
    </div>
  );
}
