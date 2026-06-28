"use client";

import type { AppointmentDetail } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

interface Props {
  appointment: AppointmentDetail;
  /** Inline / compact / button style. Compact uses small padding. */
  variant?: "default" | "compact";
}

// Modul B: seans görüş linkinə "Seansa qoşul" düyməsi. Operator linki təyin etdikdə
// görünür; bitmiş/ləğv olunmuş seanslarda gizlənir.
// Ödəniş PENDING olduqda düymə bloklanır — operator təsdiqi gözlənilir.
const HIDDEN_STATUSES = new Set(["CANCELLED", "REJECTED", "NO_SHOW", "COMPLETED"]);

export default function JoinSessionButton({ appointment, variant = "default" }: Props) {
  const { t } = useT();

  const link = appointment.meetingLink;
  if (!link) return null;
  if (HIDDEN_STATUSES.has(appointment.status)) return null;

  const paymentPending = appointment.paymentStatus === "PENDING";

  if (paymentPending) {
    return (
      <span className={`atc-wrap${variant === "compact" ? " atc-wrap--compact" : ""}`}>
        <span
          className="atc-trigger"
          style={{ opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }}
          title="Ödəniş operatoru tərəfindən hələ təsdiqlənməyib"
        >
          <LockIcon />
          Ödəniş gözlənilir
        </span>
      </span>
    );
  }

  return (
    <span className={`atc-wrap${variant === "compact" ? " atc-wrap--compact" : ""}`}>
      <a
        className="atc-trigger"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
      >
        <VideoIcon />
        {t("meetingLink.join")}
      </a>
    </span>
  );
}

function VideoIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ flexShrink: 0 }}
    >
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ flexShrink: 0 }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
