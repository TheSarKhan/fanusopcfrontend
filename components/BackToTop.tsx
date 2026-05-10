"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Yuxarı qayıt"
      className={`fanus-totop ${visible ? "is-visible" : ""}`}
    >
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>

      <style>{`
        .fanus-totop {
          position: fixed;
          right: 24px; bottom: 24px;
          z-index: 60;
          width: 48px; height: 48px;
          border-radius: 50%;
          border: none;
          background: var(--fanus-primary);
          color: white;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(16,81,183,.28);
          opacity: 0; transform: translateY(16px) scale(.8);
          pointer-events: none;
          transition: opacity .25s ease, transform .25s ease, background .2s ease, box-shadow .2s ease;
        }
        .fanus-totop.is-visible {
          opacity: 1; transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .fanus-totop:hover {
          background: var(--fanus-primary-600, #0B3F90);
          box-shadow: 0 12px 32px rgba(16,81,183,.36);
          transform: translateY(-2px) scale(1);
        }
        .fanus-totop:active {
          transform: translateY(0) scale(.96);
        }
        @media (max-width: 540px) {
          .fanus-totop { right: 16px; bottom: 16px; width: 44px; height: 44px; }
        }
      `}</style>
    </button>
  );
}
