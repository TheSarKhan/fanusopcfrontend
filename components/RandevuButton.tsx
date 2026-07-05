"use client";

import { useState } from "react";
import SessionRequestModal from "./SessionRequestModal";

/** Sağ alt küncdə daim görünən "Randevu" düyməsi — "Bizə Müraciət Edin" axınını
 *  bütün saytda əlçatan edir (əvvəllər yalnız Ana səhifə Hero-sunda idi). */
export default function RandevuButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Randevu üçün müraciət edin"
        className="fanus-randevu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 16l2 2 4-4" />
        </svg>
        <style>{`
          .fanus-randevu {
            position: fixed; right: 24px; bottom: 24px; z-index: 7000;
            width: 54px; height: 54px; border-radius: 50%;
            background: var(--fanus-primary); color: #fff; border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(16,81,183,.4);
            transition: transform .2s ease, box-shadow .2s ease;
          }
          .fanus-randevu:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 26px rgba(16,81,183,.5);
          }
          @media (max-width: 540px) {
            .fanus-randevu { right: 16px; bottom: 16px; width: 48px; height: 48px; }
          }
        `}</style>
      </button>
      <SessionRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
