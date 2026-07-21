"use client";

import { googleCalendarUrl } from "@/lib/calendar";
import type { AppointmentDetail } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import { appUrl } from "@/lib/appUrl";

interface Props {
  appointment: AppointmentDetail;
  /** Optional override of the user-visible title. */
  title?: string;
  /** Caption on the trigger button — defaults to "Google Calendar-a əlavə et". */
  triggerLabel?: string;
  /** Inline / compact / button style. Compact uses small padding. */
  variant?: "default" | "compact";
}

export default function AddToCalendarMenu({
  appointment,
  title,
  triggerLabel,
  variant = "default",
}: Props) {
  const { t } = useT();

  if (!appointment.startAt || !appointment.endAt) return null;

  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  const summary = title ?? `Fanus seansı${appointment.psychologistName ? ` — ${appointment.psychologistName}` : ""}`;
  const apptsUrl = appUrl("/patient/appointments");
  const description = [
    appointment.psychologistName ? `Psixoloq: ${appointment.psychologistName}` : null,
    appointment.note ? `Qeyd: ${appointment.note}` : null,
    apptsUrl,
  ].filter(Boolean).join("\n");

  const ev = {
    uid: String(appointment.id),
    title: summary,
    description,
    location: "Online (Fanus)",
    start, end,
    url: apptsUrl,
  };

  return (
    <span className={`atc-wrap${variant === "compact" ? " atc-wrap--compact" : ""}`}>
      <a
        className="atc-trigger"
        href={googleCalendarUrl(ev)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <CalIcon />
        {triggerLabel ?? t("calendar.addGoogle")}
      </a>
    </span>
  );
}

/** Sadə xətli təqvim ikonu — digər sətir düymələri ilə eyni dildə.
 *  Brend loqosu kiçik ölçüdə əzik göründüyü üçün işlənmir. */
function CalIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "block" }}
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
