/**
 * Calendar export helpers.
 *
 * - `generateIcs` returns a single-event RFC 5545 (.ics) blob the user can save.
 * - `googleCalendarUrl` deep-links into Google Calendar's pre-fill new-event form.
 * - `outlookCalendarUrl` deep-links into Outlook.com Live Calendar.
 *
 * All times are emitted as floating local time (no Z, no TZ component) so they
 * land on the user's clock the same way they show in our UI. If we ever store
 * timezones explicitly, switch to TZID-anchored DTSTART.
 */

interface CalendarEvent {
  uid: string;            // stable identifier (use appointment id)
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  url?: string;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** Compact local datetime: 20260512T143000 */
function fmtLocalIcs(d: Date): string {
  return (
    d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    "T" +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}
console.log("Salam");
/** UTC datetime with Z — used for DTSTAMP only. */
function fmtUtcIcs(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function generateIcs(ev: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fanus//Psychology Platform//AZ",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:fanus-appt-${ev.uid}@fanusopc.com`,
    `DTSTAMP:${fmtUtcIcs(new Date())}`,
    `DTSTART:${fmtLocalIcs(ev.start)}`,
    `DTEND:${fmtLocalIcs(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
  if (ev.location)    lines.push(`LOCATION:${escapeIcs(ev.location)}`);
  if (ev.url)         lines.push(`URL:${escapeIcs(ev.url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  // RFC 5545 wants CRLF line endings.
  return lines.join("\r\n");
}

/** Trigger a download of the .ics file in the browser. */
export function downloadIcs(ev: CalendarEvent, filename = "fanus-randevu.ics") {
  const blob = new Blob([generateIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** Google Calendar pre-fill URL. Times here are sent as UTC. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const dates = `${fmtUtcIcs(ev.start)}/${fmtUtcIcs(ev.end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates,
  });
  if (ev.description) params.set("details", ev.description);
  if (ev.location)    params.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook.com Live calendar pre-fill URL. */
export function outlookCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    rru: "addevent",
    subject: ev.title,
    startdt: ev.start.toISOString(),
    enddt: ev.end.toISOString(),
  });
  if (ev.description) params.set("body", ev.description);
  if (ev.location)    params.set("location", ev.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
