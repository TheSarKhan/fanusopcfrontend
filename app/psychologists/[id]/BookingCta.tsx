"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import AuthRequiredModal from "@/components/AuthRequiredModal";

export default function BookingCta({
  psychologistId,
  name,
  accentColor,
}: {
  psychologistId: number;
  name: string;
  accentColor: string;
}) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const target = `/book/${psychologistId}`;

  const onClick = () => {
    const user = getStoredUser();
    if (!user || user.role !== "PATIENT") {
      setAuthOpen(true);
      return;
    }
    router.push(target);
  };

  return (
    <>
      <AuthRequiredModal open={authOpen} onClose={() => setAuthOpen(false)} next={target} />
      <button
        className="psy-profile-cta-btn"
        style={{ background: accentColor, color: "white" }}
        onClick={onClick}
        aria-label={`${name} ilə randevu al`}
      >
        Randevu al
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
             viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </>
  );
}
