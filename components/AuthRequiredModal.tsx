"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buildPanelUrl, getStoredUser } from "@/lib/auth";

interface Props {
  open: boolean;
  onClose: () => void;
  next?: string;
  title?: string;
  message?: string;
}

const ROLE_LABEL: Record<string, string> = {
  PSYCHOLOGIST: "psixoloq",
  OPERATOR: "operator",
  ADMIN: "admin",
};

export default function AuthRequiredModal({ open, onClose, next, title, message }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  // Logged-in non-patient (psychologist/operator/admin): booking is patient-only,
  // so instead of a login/register prompt we point them to their own panel.
  const user = getStoredUser();
  const nonPatient = !!user && user.role !== "PATIENT";
  const roleLabel = nonPatient ? (ROLE_LABEL[user!.role] ?? "bu") : "";

  const nextParam = next ? `?next=${encodeURIComponent(next)}` : "";

  const headTitle = title ?? (nonPatient
    ? "Randevu yalnız pasiyentlər üçündür"
    : "Davam etmək üçün daxil olun");
  const headMessage = message ?? (nonPatient
    ? `Siz ${roleLabel} hesabı ilə daxil olmusunuz. Randevu yalnız pasiyent hesabı ilə mümkündür.`
    : "Randevu almaq üçün hesabınıza daxil olmalı və ya qeydiyyatdan keçməlisiniz.");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "1.5rem",
          padding: "2.25rem",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
          position: "relative",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Bağla"
          className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#374151] transition-colors"
          style={{ fontSize: 20, lineHeight: 1, padding: "4px 8px" }}
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--brand)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 11h-6" />
              <path d="M19 8v6" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#1A2535]">{headTitle}</h2>
          <p className="text-sm text-[#52718F] mt-2 leading-relaxed">{headMessage}</p>
        </div>

        <div className="flex flex-col gap-3">
          {nonPatient ? (
            <a
              href={buildPanelUrl(user!.role)}
              className="py-3 rounded-xl text-sm font-bold text-white text-center transition-all"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Panelə keç
            </a>
          ) : (
            <>
              <Link
                href={`/login${nextParam}`}
                className="py-3 rounded-xl text-sm font-bold text-white text-center transition-all"
                style={{ background: "var(--brand)", color: "#fff" }}
              >
                Daxil ol
              </Link>
              <Link
                href={`/register${nextParam}`}
                className="py-3 rounded-xl text-sm font-bold text-center transition-all"
                style={{ background: "#FAFCFF", color: "#1A2535", border: "1.5px solid #C0D2E6" }}
              >
                Qeydiyyatdan keç
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-[#8AAABF] mt-5">
          {nonPatient
            ? "Pasiyent kimi randevu almaq üçün həmin hesabdan çıxıb pasiyent hesabı ilə daxil olun."
            : "Yalnız xəstə hesabları randevu ala bilər."}
        </p>
      </div>
    </div>
  );
}
