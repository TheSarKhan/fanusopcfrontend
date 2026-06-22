"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import AuthRequiredModal from "@/components/AuthRequiredModal";

export default function BookingCta({
  psychologistId,
  psychologistSlug,
  name,
}: {
  psychologistId: number;
  psychologistSlug?: string;
  name: string;
}) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const target = `/book/${psychologistSlug ?? psychologistId}`;

  const onClick = () => {
    const user = getStoredUser();
    if (!user || user.role !== "PATIENT") { setAuthOpen(true); return; }
    router.push(target);
  };

  return (
    <>
      <AuthRequiredModal open={authOpen} onClose={() => setAuthOpen(false)} next={target} />
      <button
        type="button"
        onClick={onClick}
        aria-label={`${name} ilə randevu al`}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", background: "var(--brand)", color: "#fff", border: "none",
          borderRadius: 11, padding: 14, fontSize: 15, fontWeight: 700, fontFamily: "inherit",
          cursor: "pointer", boxShadow: "0 4px 14px rgba(16,81,183,.28)",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
        </svg>
        Randevu al
      </button>
    </>
  );
}
