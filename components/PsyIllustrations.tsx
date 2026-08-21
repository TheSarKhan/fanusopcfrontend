"use client";

import type { CSSProperties, HTMLAttributes } from "react";

/**
 * Fanus Psixoloq Paneli üçün Xüsusi Soft Botanik & Abstrakt İllüstrasiyalar
 * Hər bir modul üçün tamamilə FƏRQLİ, xüsusi tematik kompozisiyalar.
 */

export interface IllustrationProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * 1. Əsas Dashboard Başlığı (Greeting):
 * "Sabahınız xeyir, Elyaz" başlığının yanındakı terrakota/şaftalı və zərif yarpaq budaqları.
 */
export function GreetingBotanicalDeco({
  width = 100,
  height = 72,
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

        <g stroke="#7A685D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42 88C45 70 54 46 72 26C80 18 88 12 96 8" />
          <path d="M96 8C92 14 90 20 92 24C94 28 100 28 104 22C106 18 102 12 96 8Z" fill="#FAF4F0" />
          <path d="M94 14C96 18 98 22 98 24" strokeWidth="1.1" />
          <path d="M78 20C70 20 64 24 64 30C64 36 72 38 78 34C82 32 82 24 78 20Z" fill="#F5ECE5" />
          <path d="M74 24C72 28 70 32 70 34" strokeWidth="1.1" />
          <path d="M76 38C84 36 90 40 92 46C94 52 88 56 82 54C78 52 74 44 76 38Z" fill="#FAF4F0" />
          <path d="M80 42C84 46 86 50 86 52" strokeWidth="1.1" />
          <path d="M60 48C52 48 46 54 48 60C50 66 58 68 64 62C68 58 66 52 60 48Z" fill="#F3E7DE" />
          <path d="M56 52C54 56 54 60 56 62" strokeWidth="1.1" />
          <path d="M58 66C66 66 72 72 72 78C72 84 66 86 60 84C56 82 54 74 58 66Z" fill="#FAF4F0" />

          <path d="M48 76C44 66 38 58 28 52" stroke="#968377" strokeWidth="1.3" />
          <path d="M28 52C26 55 26 59 29 61C32 63 35 61 36 57C36 54 32 51 28 52Z" fill="#EFE5DC" stroke="#968377" strokeWidth="1.2" />
          <path d="M34 60C31 64 31 68 34 70C37 72 40 70 41 66C41 63 38 60 34 60Z" fill="#FAF4F0" stroke="#968377" strokeWidth="1.2" />
        </g>
        <circle cx="82" cy="14" r="1.5" fill="#7A685D" />
        <circle cx="108" cy="34" r="1.5" fill="#A89487" />
        <circle cx="26" cy="44" r="1.2" fill="#BCAAA0" />
      </svg>
    </div>
  );
}

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

/**
 * 2. Hər bir Modul üçün Xüsusi, Unikal İllüstrasiya Komponenti
 */
export function SectionBotanicalDeco({
  type = "general",
  width = 64,
  height = 52,
  className = "",
  style,
  ...rest
}: IllustrationProps & { type?: BotanicalSectionType }) {
  const wrapStyle: CSSProperties = {
    width,
    height,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    userSelect: "none",
    ...style,
  };

  switch (type) {
    // ─── Cədvəl (Təqvim şəbəkəsi və sarmaşıq yarpaqları) ─────────────────────
    case "calendar":
      return (
        <div className={`psy-deco-section psy-deco--calendar ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <rect x="22" y="16" width="46" height="42" rx="10" fill="#F4EAE2" fillOpacity="0.9" />
            <circle cx="58" cy="20" r="12" fill="#E2ECE6" />
            {/* Calendar grid lines */}
            <path d="M28 32H62M28 42H62M38 24V52M52 24V52" stroke="#D3C2B6" strokeWidth="1" strokeLinecap="round" strokeDasharray="1 3" />
            {/* Hanging ivy branch */}
            <g stroke="#6E5D52" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18C20 22 28 34 32 50C34 58 38 64 42 66" />
              <path d="M14 18C16 14 20 14 22 18C23 21 20 24 16 23C14 22 13 20 14 18Z" fill="#FAF6F2" />
              <path d="M22 26C20 30 22 34 26 35C29 35 31 31 29 28C27 26 23 25 22 26Z" fill="#E2ECE6" />
              <path d="M30 40C34 40 37 44 36 47C35 50 31 51 28 48C26 46 28 41 30 40Z" fill="#FAF6F2" />
              <path d="M34 54C32 58 35 61 38 62C41 62 43 59 41 56C39 54 35 53 34 54Z" fill="#F5ECE5" />
            </g>
            <circle cx="52" cy="32" r="2.5" fill="#2563EB" fillOpacity="0.7" />
          </svg>
        </div>
      );

    // ─── Randevular (Video / Seans əlaqəsi və zərif lotus) ───────────────────
    case "appointments":
      return (
        <div className={`psy-deco-section psy-deco--appointments ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M24 16C38 6 60 12 68 26C76 40 74 58 60 66C46 74 26 70 16 58C6 46 10 26 24 16Z" fill="#EBF3FA" />
            <circle cx="24" cy="26" r="14" fill="#F7EDE6" />
            {/* Video silhouette & lotus flower */}
            <path d="M44 26H58C61 26 63 28 63 31V45C63 48 61 50 58 50H44C41 50 39 48 39 45V31C39 28 41 26 44 26Z" stroke="#BED3E6" strokeWidth="1.2" />
            <g stroke="#566B7C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 62C24 48 34 36 46 26C52 20 60 16 66 12" />
              <path d="M66 12C62 16 62 20 64 23C66 26 70 25 72 21C73 18 70 14 66 12Z" fill="#F4F8FB" />
              <path d="M48 24C42 24 38 28 38 32C38 36 44 38 48 35C51 33 51 27 48 24Z" fill="#F7EDE6" />
              <path d="M46 36C52 34 56 38 58 42C60 46 56 48 52 47C49 45 46 40 46 36Z" fill="#F4F8FB" />
            </g>
          </svg>
        </div>
      );

    // ─── İş vaxtları (Günəş qövsü, saat konturu və çələng) ───────────────────
    case "availability":
      return (
        <div className={`psy-deco-section psy-deco--availability ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <circle cx="40" cy="35" r="26" fill="#FEF4E8" />
            <path d="M40 12C52 12 62 22 62 35C62 48 52 58 40 58" stroke="#F6D8B8" strokeWidth="1.2" strokeDasharray="2 3" />
            {/* Clock hands & glowing sun petals */}
            <g stroke="#9A6B3E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="40" cy="35" r="16" fill="#FFFDF9" />
              <path d="M40 25V35L47 38" />
              {/* Olive leaf wreath on left */}
              <path d="M26 48C20 42 18 32 20 24C22 18 26 14 30 10" />
              <path d="M30 10C26 13 24 17 26 20C28 22 31 21 33 17C34 14 32 11 30 10Z" fill="#FAF5ED" />
              <path d="M22 22C17 24 17 29 20 31C23 32 26 29 25 26C24 24 23 22 22 22Z" fill="#F6ECE0" />
              <path d="M21 34C18 37 19 42 23 43C26 43 28 39 26 36C25 35 23 34 21 34Z" fill="#FAF5ED" />
            </g>
          </svg>
        </div>
      );

    // ─── Pasiyentlər (Sakit zehin silueti və çiçəklənən fidan) ────────────────
    case "clients":
      return (
        <div className={`psy-deco-section psy-deco--clients ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M22 14C36 6 58 10 66 24C74 38 72 58 60 66C48 74 28 72 18 60C8 48 8 28 22 14Z" fill="#F4EEF8" />
            <circle cx="58" cy="22" r="13" fill="#F7ECE5" />
            {/* Gentle human head profile with blooming sprout */}
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

    // ─── Paketlər & Qiymət (Lentli hədiyyə / paket və zeytun budağı) ──────────
    case "packages":
      return (
        <div className={`psy-deco-section psy-deco--packages ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M18 20C30 8 52 10 62 20C72 30 74 50 64 60C54 70 34 72 22 62C10 52 6 32 18 20Z" fill="#F7EFE4" />
            <circle cx="56" cy="24" r="14" fill="#E8F2EC" />
            {/* Gift box & tag contour with botanical stem */}
            <rect x="30" y="30" width="30" height="26" rx="6" fill="#FFFDF8" stroke="#D8C8B8" strokeWidth="1.2" />
            <path d="M30 38H60M45 30V56" stroke="#D8C8B8" strokeWidth="1.2" />
            <g stroke="#7C6348" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              {/* Ribbon loops */}
              <path d="M45 30C40 24 35 24 37 28C39 31 43 30 45 30ZM45 30C50 24 55 24 53 28C51 31 47 30 45 30Z" fill="#FAF4ED" />
              {/* Branch across bottom */}
              <path d="M16 54C24 50 32 46 40 44" />
              <path d="M18 48C20 44 24 45 25 48C26 51 23 53 20 52C18 51 17 49 18 48Z" fill="#E8F2EC" />
              <path d="M28 44C30 40 34 41 35 44C36 47 33 49 30 48C28 47 27 45 28 44Z" fill="#FAF4ED" />
            </g>
          </svg>
        </div>
      );

    // ─── Tapşırıqlar (Qeyd dəftəri, qələm və zərif çiçək) ─────────────────────
    case "homework":
      return (
        <div className={`psy-deco-section psy-deco--homework ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <rect x="24" y="14" width="44" height="46" rx="8" fill="#EEF7F2" />
            <circle cx="28" cy="24" r="12" fill="#FDF3E7" />
            {/* Checklist lines */}
            <path d="M38 28H58M38 38H58M38 48H52" stroke="#BEDDD0" strokeWidth="1.3" strokeLinecap="round" />
            <g stroke="#3E7055" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M32 28L34 30L37 26" stroke="#2563EB" />
              <path d="M32 38L34 40L37 36" stroke="#2563EB" />
              {/* Flower / pencil stem */}
              <path d="M52 64C56 50 62 36 68 22" />
              <path d="M68 22C66 18 69 15 72 16C75 17 76 21 73 24C71 26 67 25 68 22Z" fill="#FAF8F5" />
              <path d="M60 34C56 34 54 38 56 41C58 43 62 42 63 39C64 36 62 34 60 34Z" fill="#E2F2E9" />
              <path d="M58 48C54 48 52 52 54 55C56 57 60 56 61 53C62 50 60 48 58 48Z" fill="#FAF8F5" />
            </g>
          </svg>
        </div>
      );

    // ─── Psixoloji Testlər (Zehin aydınlığı, beyin və çiçəklər) ───────────────
    case "tests":
      return (
        <div className={`psy-deco-section psy-deco--tests ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M22 16C36 8 58 10 66 22C74 34 76 52 66 62C56 72 36 74 24 64C12 54 8 38 14 26C16 22 18 20 22 16Z" fill="#F0EEFA" />
            <circle cx="56" cy="20" r="13" fill="#FDEEE9" />
            {/* Mind / brain hemisphere contour that sprouts leaves */}
            <g stroke="#5B4A82" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M38 52C32 52 28 46 28 40C28 36 30 33 33 31C32 27 35 22 40 22C43 22 46 24 48 26C51 23 57 24 59 28C63 29 65 34 64 38C67 42 65 48 60 50C58 52 54 52 52 52" />
              {/* Sprouting thoughts */}
              <path d="M48 26C50 18 56 12 62 8" />
              <path d="M62 8C59 11 59 15 62 17C64 19 67 18 68 15C69 12 66 9 62 8Z" fill="#FAF5FD" />
              <path d="M40 22C38 16 34 12 28 10" stroke="#8E78B8" />
              <path d="M28 10C27 13 29 16 32 17C35 18 37 15 36 12C35 10 31 9 28 10Z" fill="#FDEEE9" stroke="#8E78B8" />
            </g>
          </svg>
        </div>
      );

    // ─── Rəylər (Zərif ulduzlar, ürək və yarpaq çələngi) ─────────────────────
    case "reviews":
      return (
        <div className={`psy-deco-section psy-deco--reviews ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <circle cx="40" cy="35" r="26" fill="#FFF8E7" />
            <circle cx="56" cy="22" r="12" fill="#F5EFE6" />
            {/* Stars & wreath */}
            <g stroke="#9E762E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              {/* Central star */}
              <path d="M40 18L42.5 24.5L49 25L44 29.5L45.5 36L40 32.5L34.5 36L36 29.5L31 25L37.5 24.5L40 18Z" fill="#FEF3C7" />
              {/* Side small stars */}
              <path d="M24 28L25.5 32L29.5 32.5L26.5 35L27.5 39L24 37L20.5 39L21.5 35L18.5 32.5L22.5 32L24 28Z" fill="#FFFDF8" strokeWidth="1" />
              <path d="M56 28L57.5 32L61.5 32.5L58.5 35L59.5 39L56 37L52.5 39L53.5 35L50.5 32.5L54.5 32L56 28Z" fill="#FFFDF8" strokeWidth="1" />
              {/* Laurel branch arc below */}
              <path d="M20 46C26 54 36 56 44 56C52 56 60 52 64 44" />
              <path d="M28 50C26 53 28 56 31 56C33 56 35 53 34 50C33 48 30 48 28 50Z" fill="#FFF9ED" />
              <path d="M52 52C50 55 52 58 55 57C57 57 59 54 57 51C56 49 53 50 52 52Z" fill="#FFF9ED" />
            </g>
          </svg>
        </div>
      );

    // ─── Məqalələr (Kitab, mürəkkəb lələyi və evkalipt budağı) ────────────────
    case "articles":
      return (
        <div className={`psy-deco-section psy-deco--articles ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M20 18C32 10 54 10 64 20C74 30 76 50 66 60C56 70 36 72 24 62C12 52 8 36 18 22C18 20 19 19 20 18Z" fill="#F4EFE6" />
            <circle cx="26" cy="24" r="14" fill="#EBF2EB" />
            {/* Open book pages */}
            <path d="M24 46C32 42 40 44 40 44C40 44 48 42 56 46V30C48 26 40 28 40 28C40 28 32 26 24 30V46Z" fill="#FFFDF9" stroke="#CFBEAC" strokeWidth="1.2" />
            <line x1="40" y1="28" x2="40" y2="44" stroke="#CFBEAC" strokeWidth="1.2" />
            {/* Feather quill & leaf stem */}
            <g stroke="#626E54" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M34 52C42 40 52 24 66 10" />
              <path d="M66 10C62 14 60 20 63 23C66 26 71 24 73 20C74 16 70 11 66 10Z" fill="#F7FAF5" />
              <path d="M48 26C42 28 40 33 43 36C46 38 50 36 51 32C51 29 49 27 48 26Z" fill="#EBF2EB" />
            </g>
          </svg>
        </div>
      );

    // ─── İcma (Dialoq köpükləri və inteqrasiya olunmuş yarpaqlar) ─────────────
    case "community":
      return (
        <div className={`psy-deco-section psy-deco--community ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <circle cx="34" cy="32" r="22" fill="#E6F4F1" />
            <circle cx="56" cy="38" r="18" fill="#FBEFEA" />
            {/* Speech bubbles & connecting vine */}
            <path d="M24 24H44C47 24 49 26 49 29V39C49 42 47 44 44 44H34L26 49V44H24C21 44 19 42 19 39V29C19 26 21 24 24 24Z" fill="#FFFDFB" stroke="#B8DDD5" strokeWidth="1.2" />
            <g stroke="#3D746A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M32 58C38 48 46 38 58 26C62 22 68 18 72 16" />
              <path d="M72 16C68 19 67 23 70 26C72 28 76 27 77 24C78 20 75 17 72 16Z" fill="#F4FAF8" />
              <path d="M52 30C46 32 44 37 47 40C50 42 54 40 55 36C55 33 53 31 52 30Z" fill="#E6F4F1" />
              <path d="M44 42C40 44 39 48 42 51C45 53 48 51 49 48C49 45 46 43 44 42Z" fill="#FBEFEA" />
            </g>
          </svg>
        </div>
      );

    // ─── Resurslar (Sənəd qovluğu və təbiət xətləri) ──────────────────────────
    case "resources":
      return (
        <div className={`psy-deco-section psy-deco--resources ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <rect x="20" y="18" width="48" height="42" rx="8" fill="#EAF0F8" />
            <circle cx="58" cy="20" r="13" fill="#F8EDE4" />
            {/* Folder tab & bookmark */}
            <path d="M20 26V22C20 20 22 18 24 18H36L40 22H60C62 22 64 24 64 26V48C64 50 62 52 60 52H24C22 52 20 50 20 48V26Z" fill="#FFFDFB" stroke="#BACFE8" strokeWidth="1.2" />
            <g stroke="#48688E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              {/* Sprouting bookmarker branch */}
              <path d="M38 52C42 40 48 26 56 12" />
              <path d="M56 12C53 15 53 19 56 22C58 24 62 23 63 20C64 16 60 13 56 12Z" fill="#FAF7F4" />
              <path d="M46 26C41 27 39 31 42 34C45 36 48 34 49 31C50 28 48 26 46 26Z" fill="#F8EDE4" />
              <path d="M44 38C40 40 39 44 41 46C44 48 47 46 48 43C48 41 46 39 44 38Z" fill="#EAF0F8" />
            </g>
          </svg>
        </div>
      );

    // ─── Profil & Tənzimləmələr (Zen balans daşları və çiçək) ─────────────────
    case "profile":
      return (
        <div className={`psy-deco-section psy-deco--profile ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <circle cx="40" cy="35" r="26" fill="#F5EFE8" />
            <circle cx="56" cy="22" r="11" fill="#EAEFEA" />
            {/* Zen stones balanced stack */}
            <ellipse cx="40" cy="54" rx="16" ry="6" fill="#FFFDFB" stroke="#D3C5B8" strokeWidth="1.2" />
            <ellipse cx="40" cy="45" rx="12" ry="5" fill="#FFFDFB" stroke="#D3C5B8" strokeWidth="1.2" />
            <ellipse cx="40" cy="37" rx="8" ry="4" fill="#FFFDFB" stroke="#D3C5B8" strokeWidth="1.2" />
            <g stroke="#6E5E52" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              {/* Sprout emerging from top stone */}
              <path d="M40 35C40 26 44 18 50 10" />
              <path d="M50 10C47 13 47 17 50 19C52 21 55 20 56 17C57 14 54 11 50 10Z" fill="#FAF6F2" />
              <path d="M42 22C38 23 37 27 39 29C42 31 45 29 45 26C45 24 44 23 42 22Z" fill="#EAEFEA" />
            </g>
          </svg>
        </div>
      );

    // ─── General / Standart Fallback ─────────────────────────────────────────
    default:
      return (
        <div className={`psy-deco-section ${className}`} style={wrapStyle} {...rest}>
          <svg viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <path d="M20 16C34 6 56 10 66 22C76 34 76 54 64 64C52 74 32 74 20 62C8 50 6 32 20 16Z" fill="#F6EDE5" />
            <circle cx="56" cy="18" r="11" fill="#E8F1EC" />
            <g stroke="#736155" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 62C27 48 35 34 48 20C54 14 60 10 66 6" />
              <path d="M66 6C63 10 62 14 64 17C66 20 70 19 72 15C73 12 70 8 66 6Z" fill="#FAF5F0" />
              <path d="M52 16C46 16 42 20 42 24C42 28 48 30 52 27C55 25 55 19 52 16Z" fill="#E8F1EC" />
              <path d="M50 28C56 26 60 30 62 34C64 38 60 40 56 39C53 37 50 32 50 28Z" fill="#FAF5F0" />
            </g>
          </svg>
        </div>
      );
  }
}

/**
 * 3. Boş Vəziyyətlər (Empty States) üçün Soft Botanik İllüstrasiya
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
        <path
          d="M34 18C48 8 72 12 80 24C88 36 92 54 82 68C72 82 50 88 34 78C18 68 12 48 16 34C20 20 22 28 34 18Z"
          fill={bg1}
          fillOpacity="0.9"
        />
        <circle cx="82" cy="30" r="22" fill={bg2} fillOpacity="0.75" />
        <circle cx="36" cy="70" r="14" fill="#FAF5F0" />

        <path
          d="M18 72C34 82 62 86 88 74C102 66 112 50 114 38"
          stroke="#D5C5B9"
          strokeWidth="1.1"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />

        <g stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M44 82C46 64 54 44 68 28C74 20 80 14 86 10" />
          <path d="M86 10C82 14 82 19 84 22C86 25 90 24 93 20C94 17 91 13 86 10Z" fill="#FAF6F2" />
          <path d="M72 22C66 22 62 26 62 30C62 34 68 36 72 33C75 31 75 25 72 22Z" fill="#F4EBE2" />
          <path d="M70 38C76 36 80 40 82 44C84 48 80 50 76 49C73 47 70 42 70 38Z" fill="#FAF6F2" />
          <path d="M58 46C52 46 48 50 50 54C52 58 58 59 62 55C65 52 63 48 58 46Z" fill="#F2E6DC" />
          <path d="M56 60C62 60 66 64 66 68C66 72 62 74 58 72C55 70 54 64 56 60Z" fill="#FAF6F2" />

          <path d="M46 72C42 62 36 56 28 50" strokeWidth="1.2" />
          <path d="M28 50C26 53 26 56 29 58C32 60 34 58 35 55C35 52 32 49 28 50Z" fill="#FAF6F2" strokeWidth="1.1" />
          <path d="M34 58C31 61 31 64 33 66C36 68 38 66 39 63C39 60 37 58 34 58Z" fill="#FAF6F2" strokeWidth="1.1" />
        </g>
        <circle cx="74" cy="16" r="1.3" fill={strokeColor} />
      </svg>
    </div>
  );
}
