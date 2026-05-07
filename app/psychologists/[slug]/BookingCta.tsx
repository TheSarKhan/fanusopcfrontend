"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, buildPanelUrl } from "@/lib/auth";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { patientApi } from "@/lib/api";

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
  const [starting, setStarting] = useState(false);
  const target = `/book/${psychologistId}`;

  const onClick = () => {
    const user = getStoredUser();
    if (!user || user.role !== "PATIENT") { setAuthOpen(true); return; }
    router.push(target);
  };

  const onMessage = async () => {
    const user = getStoredUser();
    if (!user || user.role !== "PATIENT") { setAuthOpen(true); return; }
    setStarting(true);
    try {
      await patientApi.chatStart(psychologistId);
      window.location.href = `${buildPanelUrl("PATIENT")}/chat`;
    } catch { setStarting(false); }
  };

  return (
    <>
      <AuthRequiredModal open={authOpen} onClose={() => setAuthOpen(false)} next={target} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <button
          onClick={onMessage}
          disabled={starting}
          style={{ background: "#fff", color: accentColor, border: `1.5px solid ${accentColor}`, padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: starting ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
          aria-label={`${name} ilə mesaj göndər`}
        >
          💬 {starting ? "Açılır…" : "Mesaj göndər"}
        </button>
      </div>
    </>
  );
}
