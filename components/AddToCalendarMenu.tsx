"use client";

import { useEffect, useRef, useState } from "react";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar";
import type { AppointmentDetail } from "@/lib/api";

interface Props {
  appointment: AppointmentDetail;
  /** Optional override of the user-visible title. */
  title?: string;
  /** Caption on the trigger button — defaults to "📅 Təqvimə əlavə et". */
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  // No start/end — can't add to calendar.
  if (!appointment.startAt || !appointment.endAt) return null;

  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  const summary = title ?? `Fanus seansı${appointment.psychologistName ? ` — ${appointment.psychologistName}` : ""}`;
  const fmt = appointment.sessionFormat === "ONLINE" ? "Onlayn"
    : appointment.sessionFormat === "IN_PERSON" ? "Əyani" : null;
  const description = [
    appointment.psychologistName ? `Psixoloq: ${appointment.psychologistName}` : null,
    fmt ? `Format: ${fmt}` : null,
    appointment.note ? `Qeyd: ${appointment.note}` : null,
    "https://fanusopc.com/patient/appointments",
  ].filter(Boolean).join("\n");

  const ev = {
    uid: String(appointment.id),
    title: summary,
    description,
    location: fmt === "Onlayn" ? "Online (Fanus)" : undefined,
    start, end,
    url: "https://fanusopc.com/patient/appointments",
  };

  return (
    <div ref={ref} className={`atc-wrap${variant === "compact" ? " atc-wrap--compact" : ""}`}>
      <button type="button" className="atc-trigger" onClick={() => setOpen(o => !o)}>
        {triggerLabel ?? "📅 Təqvimə əlavə et"} <span className="atc-caret">▾</span>
      </button>
      {open && (
        <div className="atc-menu" role="menu">
          <button type="button" className="atc-item" onClick={() => { downloadIcs(ev); setOpen(false); }}>
            <span className="atc-item-ico">⬇</span>
            <span>
              <strong>iCal / Apple Calendar</strong>
              <small>.ics faylı yüklənir</small>
            </span>
          </button>
          <a className="atc-item" href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer"
             onClick={() => setOpen(false)}>
            <span className="atc-item-ico">G</span>
            <span>
              <strong>Google Calendar</strong>
              <small>yeni tab-da açır</small>
            </span>
          </a>
          <a className="atc-item" href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer"
             onClick={() => setOpen(false)}>
            <span className="atc-item-ico">O</span>
            <span>
              <strong>Outlook</strong>
              <small>yeni tab-da açır</small>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
