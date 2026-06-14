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
const HIDDEN_STATUSES = new Set(["CANCELLED", "REJECTED", "NO_SHOW", "COMPLETED"]);

export default function JoinSessionButton({ appointment, variant = "default" }: Props) {
  const { t } = useT();

  const link = appointment.meetingLink;
  if (!link) return null;
  if (HIDDEN_STATUSES.has(appointment.status)) return null;

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
