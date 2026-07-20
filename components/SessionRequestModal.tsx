"use client";

import { useEffect, useRef, useState } from "react";
import QuickRequestForm from "@/components/QuickRequestForm";
import { buildPanelUrl, clearUser, getStoredUser } from "@/lib/auth";
import { tryGetMe } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  PATIENT: "Pasiyent",
  PSYCHOLOGIST: "Psixoloq",
  OPERATOR: "Operator",
  ADMIN: "Administrator",
};

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

  // Sayt üzərindən müraciət QONAQ axınıdır. Login olmuş istifadəçi bura düşməməlidir:
  // pasiyent öz bron axınına yönləndirilir, digər rollarda forma ümumiyyətlə açılmır
  // (əvvəl admin hesabı ilə də müraciət göndərmək mümkün idi).
  // undefined = hələ yoxlanılır, null = qonaq.
  const [role, setRole] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!open) { setRole(undefined); return; }
    // Keşdən dərhal (forma bir anlıq görünməsin), sonra cookie ilə təsdiqlə.
    setRole(getStoredUser()?.role ?? null);
    let cancelled = false;
    tryGetMe().then(me => {
      if (cancelled) return;
      if (!me) { clearUser(); setRole(null); return; }
      setRole(me.role);
    }).catch(() => { /* şəbəkə xətası — keşdəki dəyər qalsın */ });
    return () => { cancelled = true; };
  }, [open]);

  // Pasiyent: qonaq forması yerinə öz psixoloq seçimi/bron axını.
  useEffect(() => {
    if (!open || role !== "PATIENT") return;
    window.location.href = `${buildPanelUrl("PATIENT")}/psychologists`;
  }, [open, role]);

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
                {role === null
                  ? "Formanı doldurun, operator sizinlə əlaqə saxlayacaq."
                  : "Hesab məlumatı yoxlanılır…"}
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

          {role === undefined || role === "PATIENT" ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "#52718F" }}>Yüklənir…</p>
          ) : role === null ? (
            <QuickRequestForm key={formKey} onDone={onClose} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#0B1A35" }}>
                Siz <strong>{ROLE_LABEL[role] ?? role}</strong> hesabı ilə daxil olmusunuz.
                Seans müraciəti yalnız pasiyentlər üçündür.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => { window.location.href = buildPanelUrl(role); }}
                  className="fanus-btn fanus-btn-primary"
                >
                  Panelə keç
                </button>
                <button type="button" onClick={onClose} className="fanus-btn fanus-btn-ghost">
                  Bağla
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
