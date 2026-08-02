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
  "ANXIETY", "DEPRESSION", "BURNOUT", "TRAUMA", "GRIEF",
  "RELATIONSHIPS", "FAMILY", "PARENTING", "YOUTH", "LONELINESS",
  "ANGER", "ADDICTION", "SELF_ESTEEM", "SLEEP", "SELF_GROWTH",
] as const;

/** SELF_ESTEEM → selfEsteem */
export function topicKey(code: string) {
  return code.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export default function TopicPicker({
  value,
  onChange,
  label,
  hint,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const { t } = useT();
  const selected = new Set(value);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code); else next.add(code);
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
          return (
            <button
              key={code}
              type="button"
              className={`tp__chip${on ? " is-on" : ""}`}
              onClick={() => toggle(code)}
              aria-pressed={on}
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
      `}</style>
    </div>
  );
}
