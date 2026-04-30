"use client";

import type { CSSProperties } from "react";

type Props = { size?: number; className?: string; style?: CSSProperties };

const wrap = (size = 16, className = "ic", style?: CSSProperties): React.SVGProps<SVGSVGElement> => ({
  className,
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  style,
});

export const IconHome = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M3 12 12 4l9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

export const IconContent = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 9h7M8 13h8M8 17h5" />
  </svg>
);

export const IconUser = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1-4 4.5-6 7-6s6 2 7 6" />
  </svg>
);

export const IconUsers = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c.5-3 3-5 6-5s5.5 2 6 5" />
    <circle cx="17" cy="9" r="2.5" />
  </svg>
);

export const IconCalendar = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <rect x="4" y="5" width="16" height="15" rx="1.5" />
    <path d="M4 9h16M9 3v4M15 3v4" />
  </svg>
);

export const IconMegaphone = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M3 10v4l11 5V5z" />
    <path d="M14 8a3 3 0 0 1 0 8" />
  </svg>
);

export const IconChart = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 15l3-4 3 3 5-7" />
  </svg>
);

export const IconSettings = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

export const IconSearch = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconBell = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

export const IconClock = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 2" />
  </svg>
);

export const IconPlus = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconArrowRight = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M3 12h18" />
    <path d="m13 5 7 7-7 7" />
  </svg>
);

export const IconDownload = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const IconCheck = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M5 12l4 4L19 6" />
  </svg>
);

export const IconAlert = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M12 9v4M12 17h.01M5 19h14a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0L3.3 16A2 2 0 0 0 5 19z" />
  </svg>
);

export const IconX = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </svg>
);

export const IconChevron = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconLogout = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const IconMail = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M4 5h16v11H7l-3 3z" />
  </svg>
);

export const IconEye = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <path d="M3 12c3-7 15-7 18 0-3 7-15 7-18 0z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const IconHelp = ({ size, className, style }: Props) => (
  <svg {...wrap(size, className, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);
