/**
 * Hazır qapaq şəkilləri — psixologiya/rifah temalı, webdən götürülmüş VEKTOR
 * (SVG) illüstrasyonlar. Mənbə: unDraw (undraw.co) — açıq lisenziya (MIT/CC0,
 * atribusiya tələb olunmur). Fayllar `public/covers/` altında saxlanılır və öz
 * domenimizdən statik verilir (hotlink/rate-limit riski yoxdur).
 *
 * Seçiləndə coverImageUrl = ana saytın mütləq URL-i + /covers/<fayl> kimi saxlanır
 * ki, həm panel, həm public bloq (fərqli subdomen ola bilər) düzgün göstərsin.
 */

export interface CoverPreset {
  id: string;
  label: string;
  file: string; // public/covers/ altındakı fayl adı
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: "meditation",  label: "Meditasiya",      file: "Meditation_o89g.svg" },
  { id: "mindfulness", label: "Zehin sükunəti",  file: "mindfulness_scgo.svg" },
  { id: "conversation",label: "Söhbət",          file: "conversation_h12g.svg" },
  { id: "relaxing",    label: "Evdə rahatlıq",   file: "relaxing_at_home_9tyc.svg" },
  { id: "reading",     label: "Oxu",             file: "reading_list_4boi.svg" },
  { id: "sleep",       label: "Yuxu",            file: "sleep_analysis_o5f9.svg" },
  { id: "happy",       label: "Xoş anlar",       file: "young_and_happy_hfpe.svg" },
  { id: "feeling",     label: "Duyğular",        file: "feeling_blue_4b7q.svg" },
];

/** Statik önizləmə/qapaq yolu (panel origin-ə nisbətən). */
export function coverPresetPath(file: string): string {
  return `/covers/${file}`;
}
