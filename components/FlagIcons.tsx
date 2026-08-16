/* Real bayraq şəkilləri — public/flags/ qovluğundakı SVG fayllar.
 * Emoji bayraq bəzi platformalarda (Windows) düzgün göstərilmir; inline SVG
 * ikonları isə detallı bayraqlarda (məs. İran) zəif görünür. Ona görə hər yerdə
 * eyni real bayraq şəkilləri işlədilir (LanguageSwitcher, psixoloq kartı, profil). */

import type { CSSProperties } from "react";

type FlagProps = { width?: number; height?: number };

const flagStyle = (width: number, height: number): CSSProperties => ({
  width,
  height,
  borderRadius: 2,
  display: "block",
  flexShrink: 0,
  objectFit: "cover",
});

export function FlagImage({ code, width = 20, height = 14 }: { code: string; width?: number; height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code}.svg`}
      alt=""
      width={width}
      height={height}
      style={flagStyle(width, height)}
      aria-hidden
    />
  );
}

/** Dil adını ISO bayraq koduna çevirir (LANGUAGE_OPTIONS + custom dillər). */
export function langToFlagCode(lang: string): string | null {
  const l = lang.toLowerCase();
  if (l.startsWith("az")) return "az";
  if (l.includes("rus")) return "ru";
  if (l.includes("ngilis") || l.includes("english")) return "gb";
  if (l.includes("türk") || l.includes("turk")) return "tr";
  if (l.includes("alman") || l.includes("german")) return "de";
  if (l.includes("frans") || l.includes("french")) return "fr";
  if (l.includes("fars") || l.includes("persian") || l.includes("farsi") || l.includes("farsca")) return "ir";
  return null;
}

/** Dil adını qısa 2-hərfli koda çevirir (kartda pill yer tutmasın deyə). */
export function langCode(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("az")) return "AZ";
  if (l.includes("rus")) return "RU";
  if (l.includes("ngilis") || l.includes("english")) return "EN";
  if (l.includes("türk") || l.includes("turk")) return "TR";
  if (l.includes("alman") || l.includes("german")) return "DE";
  if (l.includes("frans") || l.includes("french")) return "FR";
  if (l.includes("fars") || l.includes("persian") || l.includes("farsi") || l.includes("farsca")) return "FA";
  return lang.trim().slice(0, 2).toUpperCase();
}

/** Psixoloq kartı və profil səhifəsində dil adına görə bayraq. */
export function FlagIcon({ lang, width = 18, height = 12 }: { lang: string; width?: number; height?: number }) {
  const code = langToFlagCode(lang);
  if (!code) return null;
  return <FlagImage code={code} width={width} height={height} />;
}

export function FlagAZ({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="az" width={width} height={height} />;
}

export function FlagRU({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="ru" width={width} height={height} />;
}

export function FlagEN({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="gb" width={width} height={height} />;
}

export function FlagUS({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="us" width={width} height={height} />;
}

export function FlagTR({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="tr" width={width} height={height} />;
}

export function FlagDE({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="de" width={width} height={height} />;
}

export function FlagFR({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="fr" width={width} height={height} />;
}

export function FlagIR({ width = 20, height = 14 }: FlagProps = {}) {
  return <FlagImage code="ir" width={width} height={height} />;
}
