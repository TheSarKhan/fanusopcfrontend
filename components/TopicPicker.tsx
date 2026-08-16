"use client";

import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Mövzu teqi seçimi (V133) — «Bu gün özünüzü necə hiss edirsiniz?» tövsiyəsinin əsası.
 *
 * Kodlar backend-dəki `MoodTopic` enum-u ilə eynidir; adlar lüğətdən gəlir, ona görə
 * dörd dildə avtomatik göstərilir. Teq seçilməyən psixoloq/məqalə heç bir əhval üçün
 * tövsiyə olunmur — bu qəsdəndir: uyğunsuz nəticə göstərməkdənsə heç nə göstərmirik.
 */
export const TOPIC_CODES = [
  "ANXIETY", "DEPRESSION", "TRAUMA", "OCD", "PERSONALITY_DISORDERS",
  "PSYCHOTIC_DISORDERS", "EATING_DISORDERS", "ADDICTION", "ADHD", "BURNOUT",
  "ANGER", "GRIEF", "RELATIONSHIPS", "COUPLE_MARRIAGE", "FAMILY",
  "INFIDELITY_TRUST", "SEPARATION_DIVORCE", "PARENTING", "CHILD_ISSUES", "YOUTH",
  "SELF_ESTEEM", "LONELINESS", "SEXUAL_ISSUES", "SLEEP", "PSYCHOSOMATIC",
  "WORK_CAREER", "LIFE_ADAPTATION", "SELF_GROWTH", "IDENTITY_EXISTENTIAL", "CRISIS_SELF_HARM",
] as const;

/**
 * Bazaya yazılan azərbaycanca adlar.
 *
 * `specializations` sahəsi bütün istifadəçilərə göstərilən DB məzmunudur, ona görə
 * interfeys dilindən asılı OLMAMALIDIR — rus dilində qeydiyyatdan keçən psixoloqun
 * kartında ixtisas rusca yazılmamalıdır. Göstərmə üçün tərcümə lüğətdən gəlir.
 */
export const TOPIC_AZ_LABELS: Record<string, string> = {
  ANXIETY: "Narahatlıq və panika",
  DEPRESSION: "Depressiya və əhval pozuntuları",
  TRAUMA: "Travma və PTSP",
  OCD: "OKP və obsesiv düşüncələr",
  PERSONALITY_DISORDERS: "Şəxsiyyət pozuntuları",
  PSYCHOTIC_DISORDERS: "Psixotik pozuntular",
  EATING_DISORDERS: "Qidalanma pozuntuları",
  ADDICTION: "Asılılıqlar",
  ADHD: "DEHB və neyroinkişaf pozuntuları",
  BURNOUT: "Stress və tükənmişlik",
  ANGER: "Qəzəb və emosiyaların idarəsi",
  GRIEF: "İtki və yas",
  RELATIONSHIPS: "Münasibətlər",
  COUPLE_MARRIAGE: "Cütlük və evlilik problemləri",
  FAMILY: "Ailə problemləri",
  INFIDELITY_TRUST: "Xəyanət və güvən problemləri",
  SEPARATION_DIVORCE: "Ayrılıq və boşanma",
  PARENTING: "Valideynlik",
  CHILD_ISSUES: "Uşaq problemləri",
  YOUTH: "Yeniyetmə problemləri",
  SELF_ESTEEM: "Özünəinam və özünədəyər",
  LONELINESS: "Tənhalıq və sosial çətinliklər",
  SEXUAL_ISSUES: "Seksual problemlər",
  SLEEP: "Yuxu problemləri",
  PSYCHOSOMATIC: "Psixosomatik və sağlamlıq narahatlığı",
  WORK_CAREER: "İş və karyera problemləri",
  LIFE_ADAPTATION: "Həyat dəyişiklikləri və adaptasiya",
  SELF_GROWTH: "Şəxsi inkişaf və özünü tanıma",
  IDENTITY_EXISTENTIAL: "Kimlik və ekzistensial problemlər",
  CRISIS_SELF_HARM: "Böhran və özünə zərər riski",
};

/** SELF_ESTEEM → selfEsteem */
export function topicKey(code: string) {
  return code.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export default function TopicPicker({
  value,
  onChange,
  label,
  hint,
  max,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
  /** Verilibsə, ən çoxu bu qədər mövzu seçilə bilər — limitə çatanda seçilməmiş çiplər deaktiv olur. */
  max?: number;
}) {
  const { t } = useT();
  const selected = new Set(value);
  const atMax = !!max && selected.size >= max;

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
    } else {
      if (atMax) return;
      next.add(code);
    }
    // Sıra sabit qalsın deyə TOPIC_CODES sırası ilə qaytarılır.
    onChange(TOPIC_CODES.filter(c => next.has(c)));
  };

  return (
    <div className="tp">
      {label && <div className="tp__label">{label}</div>}
      {hint && <div className="tp__hint">{hint}</div>}
      <div className="tp__grid">
        {TOPIC_CODES.map(code => {
          const on = selected.has(code);
          const disabled = !on && atMax;
          return (
            <button
              key={code}
              type="button"
              className={`tp__chip${on ? " is-on" : ""}`}
              onClick={() => toggle(code)}
              aria-pressed={on}
              disabled={disabled}
            >
              {t(`topic.${topicKey(code)}` as MessageKey)}
            </button>
          );
        })}
      </div>

      <style>{`
        .tp { display: flex; flex-direction: column; gap: 6px; }
        .tp__label { font-size: 13px; font-weight: 700; color: #1A2535; }
        .tp__hint { font-size: 12px; color: #52718F; line-height: 1.5; }
        .tp__grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .tp__chip {
          font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px;
          border: 2px solid #E4EDF6; background: #fff; color: #52718F;
          cursor: pointer; transition: all .15s;
        }
        .tp__chip:hover { border-color: #C0D2E6; }
        .tp__chip.is-on { border-color: #002147; background: #E0EBF7; color: #002147; }
        .tp__chip:disabled { cursor: not-allowed; opacity: .45; }
        .tp__chip:disabled:hover { border-color: #E4EDF6; }
      `}</style>
    </div>
  );
}
