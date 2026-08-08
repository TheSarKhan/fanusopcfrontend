/* Inline SVG bayraqlar — emoji bayraq bəzi platformalarda (Windows) düzgün
 * göstərilmir, ona görə hər yerdə bu inline SVG dəsti işlədilir
 * (LanguageSwitcher, psixoloq profilində "Dillər" pilləri və s.). */

type FlagProps = { width?: number; height?: number };

export function FlagAZ({ width = 20, height = 14 }: FlagProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="30" height="20" fill="#0092BC" />
      <rect y="6.67" width="30" height="6.66" fill="#EF3340" />
      <rect y="13.33" width="30" height="6.67" fill="#00B050" />
      <circle cx="14" cy="10" r="3.4" fill="white" />
      <circle cx="15.1" cy="10" r="2.7" fill="#EF3340" />
      <polygon points="19,10 18.55,10.38 18.73,10.91 18.22,10.64 17.82,11 17.91,10.45 17.45,10.12 18,10.06 18.2,9.55 18.46,10.04" fill="white" />
    </svg>
  );
}

export function FlagRU({ width = 20, height = 14 }: FlagProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.66" fill="#0039A6" />
      <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
    </svg>
  );
}

export function FlagEN({ width = 20, height = 14 }: FlagProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="12" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="7" />
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="16" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="10" />
    </svg>
  );
}

export function FlagTR({ width = 20, height = 14 }: FlagProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="11.5" cy="10" r="4.2" fill="#fff" />
      <circle cx="13" cy="10" r="3.35" fill="#E30A17" />
      <polygon points="19.6,10 16.85,10.93 18.55,8.6 18.55,11.4 16.85,9.07" fill="#fff" />
    </svg>
  );
}

export function FlagDE({ width = 20, height = 14 }: FlagProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.66" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </svg>
  );
}

export function FlagFR({ width = 20, height = 14 }: FlagProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, display: "block", flexShrink: 0 }}>
      <rect width="10" height="20" fill="#0055A4" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#EF4135" />
    </svg>
  );
}
