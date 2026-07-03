"use client";

import { useEffect, useRef, useState } from "react";
import QuickRequestForm from "@/components/QuickRequestForm";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** "Bizə Müraciət Edin" — psixoloqsuz sürətli müraciət modalı (Sayt BRD §8.2, SAYT-FR-19). */
export default function SessionRequestModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [formKey, setFormKey] = useState(0);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset form state each time the modal opens
  useEffect(() => {
    if (open) setFormKey(k => k + 1);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(11,26,53,.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
      >
        {/* Modal */}
        <div style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 540,
          maxHeight: "92vh", overflowY: "auto",
          padding: "32px 32px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,.2)",
        }}>
          {/* Close */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0B1A35" }}>
                Seans üçün müraciət
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#52718F" }}>
                Formanı doldurun, operator sizinlə əlaqə saxlayacaq.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Bağla"
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, color: "#9CA3AF", flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <QuickRequestForm key={formKey} onDone={onClose} />
        </div>
      </div>
    </>
  );
}
