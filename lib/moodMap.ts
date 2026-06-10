/**
 * GAP-08: mood → specialization-category bridge.
 *
 * `Cat` mirrors the public psychologists page filter ids; `deriveCategory`
 * is the single source of truth for mapping free-text specializations onto
 * those categories (previously private to PsychologistsPage).
 */

export type Cat = "all" | "anxiety" | "trauma" | "family" | "depression" | "youth" | "addiction";

export type MoodId = "anxious" | "sad" | "tired" | "angry" | "mixed" | "lonely" | "hopeful" | "happy";

/** Which specialization category fits each mood. "all" = no filter. */
export const MOOD_TO_CAT: Record<MoodId, Cat> = {
  anxious: "anxiety",
  sad:     "depression",
  tired:   "depression",   // burnout lives under depression specialists
  angry:   "addiction",    // impulse-control expertise
  mixed:   "anxiety",
  lonely:  "family",       // relationship-focused therapists
  hopeful: "all",
  happy:   "all",
};

/** Categorize a psychologist by their free-text specializations. */
export function deriveCategory(specs: string[]): Cat {
  const s = specs.join(" ").toLowerCase();
  if (s.match(/narahat|panik|okd|stress|anksi/)) return "anxiety";
  if (s.match(/travm|tssp|yas|emdr/))            return "trauma";
  if (s.match(/münasib|ailə|cütlük|boşanma/))    return "family";
  if (s.match(/depres|burnout/))                 return "depression";
  if (s.match(/yeniyetm|valideyn|uşaq/))         return "youth";
  if (s.match(/asılıl|impuls/))                  return "addiction";
  return "all";
}
