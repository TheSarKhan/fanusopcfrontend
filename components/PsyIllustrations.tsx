"use client";

import type { CSSProperties, HTMLAttributes } from "react";

/**
 * Fanus Psixoloq Paneli üçün Xüsusi Soft Botanik & Abstrakt İllüstrasiyalar
 * Sakitləşdirici, zərif, müasir boho/terrakota xətt sənəti və pastel formalar.
 */

export interface IllustrationProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Əsas Səhifə Başlığı üçün Soft Botanik İllüstrasiya
 * Skrinşotdakı "Sabahınız xeyir, Elyaz" başlığının yanındakı zərif terrakota/şaftalı
 * və yarpaq xətlərindən ibarət kompozisiya.
 */
export function GreetingBotanicalDeco({
  width = 110,
  height = 80,
  className = "",
  style,
  ...rest
}: IllustrationProps) {
  return (
    <div
      className={`psy-deco-greeting ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width,
        height,
        flexShrink: 0,
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    >
      <svg
        viewBox="0 0 140 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        {/* Soft terracotta / cream organic blobs */}
        <path
          d="M38 18C52 6 78 10 88 24C98 38 104 58 92 72C80 86 54 94 36 84C18 74 12 50 16 34C20 18 24 30 38 18Z"
          fill="#F5E8DF"
          fillOpacity="0.85"
        />
        <path
          d="M68 32C82 22 102 26 112 38C122 50 126 68 114 80C102 92 82 96 68 88C54 80 50 62 54 48C58 34 54 42 68 32Z"
          fill="#EFE2D6"
          fillOpacity="0.7"
        />
        <circle cx="95" cy="22" r="14" fill="#F8EFEA" />
        <circle cx="106" cy="18" r="9" fill="#EAD9CD" fillOpacity="0.75" />

        {/* Minimalist abstract arc contour lines */}
        <path
          d="M20 78C35 88 65 92 95 78C115 68 128 50 132 36"
          stroke="#C8B3A4"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
        <path
          d="M28 85C48 94 80 96 110 82"
          stroke="#D8C5B8"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Delicate botanical sprig & leaf line art */}
        <g stroke="#7A685D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {/* Main stem */}
          <path d="M42 88C45 70 54 46 72 26C80 18 88 12 96 8" />

          {/* Leaf 1 (top right) */}
          <path d="M96 8C92 14 90 20 92 24C94 28 100 28 104 22C106 18 102 12 96 8Z" fill="#FAF4F0" />
          <path d="M94 14C96 18 98 22 98 24" strokeWidth="1.1" />

          {/* Leaf 2 (left upper) */}
          <path d="M78 20C70 20 64 24 64 30C64 36 72 38 78 34C82 32 82 24 78 20Z" fill="#F5ECE5" />
          <path d="M74 24C72 28 70 32 70 34" strokeWidth="1.1" />

          {/* Leaf 3 (right middle) */}
          <path d="M76 38C84 36 90 40 92 46C94 52 88 56 82 54C78 52 74 44 76 38Z" fill="#FAF4F0" />
          <path d="M80 42C84 46 86 50 86 52" strokeWidth="1.1" />

          {/* Leaf 4 (left middle) */}
          <path d="M60 48C52 48 46 54 48 60C50 66 58 68 64 62C68 58 66 52 60 48Z" fill="#F3E7DE" />
          <path d="M56 52C54 56 54 60 56 62" strokeWidth="1.1" />

          {/* Leaf 5 (right lower) */}
          <path d="M58 66C66 66 72 72 72 78C72 84 66 86 60 84C56 82 54 74 58 66Z" fill="#FAF4F0" />

          {/* Secondary delicate sprig */}
          <path d="M48 76C44 66 38 58 28 52" stroke="#968377" strokeWidth="1.3" />
          <path d="M28 52C26 55 26 59 29 61C32 63 35 61 36 57C36 54 32 51 28 52Z" fill="#EFE5DC" stroke="#968377" strokeWidth="1.2" />
          <path d="M34 60C31 64 31 68 34 70C37 72 40 70 41 66C41 63 38 60 34 60Z" fill="#FAF4F0" stroke="#968377" strokeWidth="1.2" />
        </g>

        {/* Delicate accent dots */}
        <circle cx="82" cy="14" r="1.5" fill="#7A685D" />
        <circle cx="108" cy="34" r="1.5" fill="#A89487" />
        <circle cx="26" cy="44" r="1.2" fill="#BCAAA0" />
      </svg>
    </div>
  );
}

/**
 * Psixoloq Paneli Modulları üçün Zərif Soft Botanik İllüstrasiyalar
 */
export type BotanicalSectionType =
  | "calendar"
  | "appointments"
  | "availability"
  | "clients"
  | "packages"
  | "homework"
  | "tests"
  | "reviews"
  | "articles"
  | "community"
  | "resources"
  | "profile"
  | "general";

export function SectionBotanicalDeco({
  type = "general",
  width = 68,
  height = 56,
  className = "",
  style,
  ...rest
}: IllustrationProps & { type?: BotanicalSectionType }) {
  switch (type) {
    case "calendar":
      return (
        <div className={`psy-deco-section ${className}`} style={{ width, height, flexShrink: 0, ...style }} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M20 18C32 8 54 10 64 22C74 34 76 52 66 62C56 72 36 74 24 64C12 54 8 38 14 26C16 22 18 20 20 18Z" fill="#F4EAE2" />
            <circle cx="56" cy="20" r="12" fill="#E8F1EC" />
            <path d="M12 58C28 66 52 66 68 54" stroke="#D1BEB2" strokeWidth="1" strokeDasharray="2 3" />
            {/* Botanical vine */}
            <g stroke="#6E5D52" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 62C28 48 36 32 50 18C56 12 62 8 68 6" />
              <path d="M68 6C65 10 64 14 66 17C68 20 72 20 74 16C75 13 72 9 68 6Z" fill="#FAF6F2" />
              <path d="M54 14C48 14 44 18 44 22C44 26 50 28 54 25C57 23 57 17 54 14Z" fill="#E8F1EC" />
              <path d="M52 26C58 24 62 28 64 32C66 36 62 38 58 37C55 35 52 30 52 26Z" fill="#FAF6F2" />
              <path d="M42 34C36 34 32 38 34 42C36 46 42 47 46 43C49 40 47 36 42 34Z" fill="#F5ECE5" />
            </g>
            <circle cx="38" cy="18" r="1.5" fill="#6E5D52" />
          </svg>
        </div>
      );

    case "appointments":
      return (
        <div className={`psy-deco-section ${className}`} style={{ width, height, flexShrink: 0, ...style }} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M24 16C38 6 60 12 68 26C76 40 74 58 60 66C46 74 26 70 16 58C6 46 10 26 24 16Z" fill="#EBF3FA" />
            <circle cx="22" cy="24" r="14" fill="#F7EDE6" />
            <path d="M16 62C30 70 54 68 68 56" stroke="#BED3E6" strokeWidth="1" strokeDasharray="2 3" />
            <g stroke="#566B7C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M28 64C32 50 42 34 56 22C62 16 68 12 72 8" />
              <path d="M72 8C68 12 68 16 70 19C72 22 76 21 78 17C79 14 76 10 72 8Z" fill="#F4F8FB" />
              <path d="M58 18C52 18 48 22 48 26C48 30 54 32 58 29C61 27 61 21 58 18Z" fill="#F7EDE6" />
              <path d="M56 30C62 28 66 32 68 36C70 40 66 42 62 41C59 39 56 34 56 30Z" fill="#F4F8FB" />
              <path d="M46 38C40 38 36 42 38 46C40 50 46 51 50 47C53 44 51 40 46 38Z" fill="#E2EDF5" />
            </g>
          </svg>
        </div>
      );

    case "clients":
      return (
        <div className={`psy-deco-section ${className}`} style={{ width, height, flexShrink: 0, ...style }} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M22 14C36 6 58 10 66 24C74 38 72 58 60 66C48 74 28 72 18 60C8 48 8 28 22 14Z" fill="#F4EEF8" />
            <circle cx="58" cy="22" r="13" fill="#F7ECE5" />
            <g stroke="#6A5A78" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M26 62C29 48 38 34 52 20C58 14 64 10 70 6" />
              <path d="M70 6C66 10 66 14 68 17C70 20 74 19 76 15C77 12 74 8 70 6Z" fill="#FAF6FC" />
              <path d="M56 16C50 16 46 20 46 24C46 28 52 30 56 27C59 25 59 19 56 16Z" fill="#F7ECE5" />
              <path d="M54 28C60 26 64 30 66 34C68 38 64 40 60 39C57 37 54 32 54 28Z" fill="#FAF6FC" />
              <path d="M44 36C38 36 34 40 36 44C38 48 44 49 48 45C51 42 49 38 44 36Z" fill="#EDE4F3" />
            </g>
          </svg>
        </div>
      );

    case "packages":
    case "availability":
    case "homework":
    case "tests":
    case "reviews":
    case "articles":
    case "community":
    case "resources":
    case "profile":
    default:
      return (
        <div className={`psy-deco-section ${className}`} style={{ width, height, flexShrink: 0, ...style }} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M20 16C34 6 56 10 66 22C76 34 76 54 64 64C52 74 32 74 20 62C8 50 6 32 20 16Z" fill="#F6EDE5" />
            <circle cx="56" cy="18" r="11" fill="#E8F1EC" />
            <path d="M12 56C28 66 52 66 68 52" stroke="#D8C7BC" strokeWidth="1" strokeDasharray="2 3" />
            <g stroke="#736155" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 62C27 48 35 34 48 20C54 14 60 10 66 6" />
              <path d="M66 6C63 10 62 14 64 17C66 20 70 19 72 15C73 12 70 8 66 6Z" fill="#FAF5F0" />
              <path d="M52 16C46 16 42 20 42 24C42 28 48 30 52 27C55 25 55 19 52 16Z" fill="#E8F1EC" />
              <path d="M50 28C56 26 60 30 62 34C64 38 60 40 56 39C53 37 50 32 50 28Z" fill="#FAF5F0" />
              <path d="M40 36C34 36 30 40 32 44C34 48 40 49 44 45C47 42 45 38 40 36Z" fill="#F4E8DF" />
            </g>
          </svg>
        </div>
      );
  }
}

/**
 * Növbəti Görüş Kartı üçün Arxa Fon Vurğusu
 */
export function NextMeetingAccent({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`psy-next-meet-accent ${className}`}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 140,
        height: 120,
        pointerEvents: "none",
        userSelect: "none",
        overflow: "hidden",
        zIndex: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <circle cx="110" cy="20" r="54" fill="#F8EFEA" fillOpacity="0.75" />
        <circle cx="130" cy="35" r="32" fill="#EBF3FE" fillOpacity="0.6" />
        <path
          d="M80 0C85 24 95 48 115 62C125 70 135 74 145 76"
          stroke="#D8C7BC"
          strokeWidth="1.2"
          strokeDasharray="3 4"
        />
        <g stroke="#8D7B70" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.65">
          <path d="M96 8C100 24 110 40 126 52" />
          <path d="M110 20C114 18 118 20 120 24C120 27 116 29 112 28C110 26 108 22 110 20Z" fill="#FAF6F2" />
          <path d="M120 34C124 32 128 34 130 38C130 41 126 43 122 42C120 40 118 36 120 34Z" fill="#FAF6F2" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Boş Vəziyyətlər (Empty States) üçün Zərif Soft Botanik İllüstrasiya
 */
export function EmptyStateBotanical({
  size = 110,
  className = "",
  style,
  tone = "default",
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  tone?: "default" | "calendar" | "clients" | "tasks";
}) {
  const bg1 = tone === "calendar" ? "#EBF3FE" : tone === "clients" ? "#F4EEF8" : tone === "tasks" ? "#EAF5EE" : "#F6ECE4";
  const bg2 = tone === "calendar" ? "#F7EDE6" : tone === "clients" ? "#EBF3FE" : tone === "tasks" ? "#F8EFEA" : "#EFE2D6";
  const strokeColor = tone === "calendar" ? "#5A728A" : tone === "clients" ? "#6C5B7C" : tone === "tasks" ? "#4A6E59" : "#7A685D";

  return (
    <div
      className={`psy-empty-botanical ${className}`}
      style={{
        width: size,
        height: size * 0.85,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 12px",
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        {/* Soft pastel watercolor blobs */}
        <path
          d="M34 18C48 8 72 12 80 24C88 36 92 54 82 68C72 82 50 88 34 78C18 68 12 48 16 34C20 20 22 28 34 18Z"
          fill={bg1}
          fillOpacity="0.9"
        />
        <circle cx="82" cy="30" r="22" fill={bg2} fillOpacity="0.75" />
        <circle cx="36" cy="70" r="14" fill="#FAF5F0" />

        {/* Ambient dotted arc */}
        <path
          d="M18 72C34 82 62 86 88 74C102 66 112 50 114 38"
          stroke="#D5C5B9"
          strokeWidth="1.1"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />

        {/* Botanical sprigs & zen stones line art */}
        <g stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Central stem */}
          <path d="M44 82C46 64 54 44 68 28C74 20 80 14 86 10" />
          <path d="M86 10C82 14 82 19 84 22C86 25 90 24 93 20C94 17 91 13 86 10Z" fill="#FAF6F2" />
          <path d="M72 22C66 22 62 26 62 30C62 34 68 36 72 33C75 31 75 25 72 22Z" fill="#F4EBE2" />
          <path d="M70 38C76 36 80 40 82 44C84 48 80 50 76 49C73 47 70 42 70 38Z" fill="#FAF6F2" />
          <path d="M58 46C52 46 48 50 50 54C52 58 58 59 62 55C65 52 63 48 58 46Z" fill="#F2E6DC" />
          <path d="M56 60C62 60 66 64 66 68C66 72 62 74 58 72C55 70 54 64 56 60Z" fill="#FAF6F2" />

          {/* Secondary sprig */}
          <path d="M46 72C42 62 36 56 28 50" strokeWidth="1.2" />
          <path d="M28 50C26 53 26 56 29 58C32 60 34 58 35 55C35 52 32 49 28 50Z" fill="#FAF6F2" strokeWidth="1.1" />
          <path d="M34 58C31 61 31 64 33 66C36 68 38 66 39 63C39 60 37 58 34 58Z" fill="#FAF6F2" strokeWidth="1.1" />
        </g>
        <circle cx="74" cy="16" r="1.3" fill={strokeColor} />
      </svg>
    </div>
  );
}

/**
 * Statistika İkon Qutusu (Soft Pastel Rəngli Kvadratlar)
 * Skrinşotdakı:
 * - Bu ay: soft mavi (#EBF3FE / #1051B7)
 * - Bu həftə: soft yaşıl (#EAF5EE / #2E6B54)
 * - Yaxınlaşan: soft kəhrəba/şaftalı (#FEF3EB / #C97D2E)
 * - Aktiv pasiyent: soft bənövşəyi (#F3EEFA / #7C4DBF)
 */
export type StatTone = "blue" | "green" | "amber" | "purple" | "rose";

const STAT_THEMES: Record<StatTone, { bg: string; fg: string; border?: string }> = {
  blue:   { bg: "#EBF3FE", fg: "#1051B7", border: "rgba(16,81,183,0.12)" },
  green:  { bg: "#EAF5EE", fg: "#2E6B54", border: "rgba(46,107,84,0.14)" },
  amber:  { bg: "#FEF3EB", fg: "#C97D2E", border: "rgba(201,125,46,0.16)" },
  purple: { bg: "#F3EEFA", fg: "#7C4DBF", border: "rgba(124,77,191,0.14)" },
  rose:   { bg: "#FDF0F0", fg: "#C53030", border: "rgba(197,48,48,0.14)" },
};

export function StatIconBox({
  tone = "blue",
  children,
  size = 44,
  className = "",
  style,
}: {
  tone?: StatTone;
  children: React.ReactNode;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = STAT_THEMES[tone] ?? STAT_THEMES.blue;
  return (
    <div
      className={`psy-stat-icon-box ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: theme.bg,
        color: theme.fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: theme.border ? `1px solid ${theme.border}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
