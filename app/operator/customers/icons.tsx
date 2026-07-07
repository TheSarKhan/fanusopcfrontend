import type { ReactNode, SVGProps } from "react";

// Fanus UI Kit ikonları (icons.svg-dən inline) — Müştərilər modulu üçün lokal.
type Spec = { sw?: number; fill?: boolean; body: ReactNode };

const ICONS: Record<string, Spec> = {
  search:        { body: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></> },
  plus:          { sw: 2, body: <><path d="M12 5v14" /><path d="M5 12h14" /></> },
  phone:         { body: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /> },
  message:       { body: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /> },
  mail:          { body: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" /></> },
  eye:           { body: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
  check:         { sw: 2.2, body: <path d="M20 6L9 17l-5-5" /> },
  "check-square": { sw: 1.6, body: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></> },
  x:             { sw: 2, body: <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></> },
  calendar:      { body: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></> },
  "calendar-plus": { body: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></> },
  "chevron-right": { sw: 2, body: <path d="M9 18l6-6-6-6" /> },
  "chevron-left":  { sw: 2, body: <path d="M15 18l-6-6 6-6" /> },
  users:         { body: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
  user:          { body: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
  alert:         { body: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></> },
  refresh:       { body: <><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></> },
  refund:        { body: <><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></> },
  card:          { body: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></> },
  cash:          { body: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> },
  transfer:      { body: <><path d="M17 3l4 4-4 4" /><path d="M21 7H9" /><path d="M7 21l-4-4 4-4" /><path d="M3 17h12" /></> },
  package:       { body: <><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></> },
  star:          { fill: true, sw: 0, body: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
  block:         { body: <><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" /></> },
  "map-pin":     { body: <><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></> },
  edit:          { body: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></> },
  clock:         { body: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></> },
  info:          { body: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></> },
  external:      { body: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></> },
  "file-text":   { body: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></> },
  trash:         { body: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></> },
  download:      { body: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></> },
  "bar-chart":   { body: <><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></> },
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "fx-icon", ...rest }: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  const c = ICONS[name];
  return (
    <svg className={className} viewBox="0 0 24 24" fill={c.fill ? "currentColor" : "none"}
      stroke={c.fill ? "none" : "currentColor"} strokeWidth={c.sw ?? 1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {c.body}
    </svg>
  );
}
