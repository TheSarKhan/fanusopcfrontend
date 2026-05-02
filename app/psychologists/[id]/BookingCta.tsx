"use client";

import { useBooking } from "@/context/BookingContext";

export default function BookingCta({ name, accentColor }: { name: string; accentColor: string }) {
  const { open } = useBooking();
  return (
    <button
      className="psy-profile-cta-btn"
      style={{ background: accentColor, color: "white" }}
      onClick={() => open(name)}
    >
      Randevu al
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
           viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  );
}
