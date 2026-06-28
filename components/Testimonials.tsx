"use client";

import type { Testimonial } from "@/lib/api";
import Deco from "@/components/Deco";
import { useT } from "@/lib/i18n/LocaleProvider";

const FALLBACK: Testimonial[] = [
  { id: 1, quote: "Fanusda ilk seansdan sonra çiynimdə nə qədər ağırlıq daşıdığımı anladım. İndi nəfəs almaq daha asandır.", authorName: "Aynurə K.", authorRole: "Bakı · Narahatlıq", initials: "AK", gradient: "linear-gradient(135deg,#5089E0,#1051B7)", rating: 5, active: true },
  { id: 2, quote: "Onlayn olduğu üçün başlamağa cəsarət etdim. Psixoloqumla 6 ay keçib və mən artıq əvvəlki insan deyiləm.", authorName: "Rauf M.", authorRole: "Sumqayıt · Depressiya", initials: "RM", gradient: "linear-gradient(135deg,#0B3F90,#2A6BD0)", rating: 5, active: true },
  { id: 3, quote: "Anketdən sonra 3 psixoloq təklif edildi. İlk söhbətdən hiss etdim ki, bu doğru insandır. Bu detal vacibdir.", authorName: "Səbinə H.", authorRole: "Gəncə · Münasibətlər", initials: "SH", gradient: "linear-gradient(135deg,#F5B946,#C97D2E)", rating: 5, active: true },
  { id: 4, quote: "Gecə yarısı panik atak vaxtı yaza bildiyim biri var idi. Bu hiss qiymətsizdir.", authorName: "Elvin T.", authorRole: "Bakı · Panik", initials: "ET", gradient: "linear-gradient(135deg,#88AEEC,#1051B7)", rating: 5, active: true },
  { id: 5, quote: "İlk dəfə özümü hökmsüz dinləyən birini tapdım. Mən susanda da o yanımda idi.", authorName: "Nigar A.", authorRole: "Bakı · Travma", initials: "NA", gradient: "linear-gradient(135deg,#1051B7,#082F6D)", rating: 5, active: true },
  { id: 6, quote: "Cütlük seansları nikahımızı xilas etdi desəm yalan olmaz. Bir-birimizi yenidən tanımağı öyrəndik.", authorName: "Tural & Ayşə", authorRole: "Bakı · Ailə", initials: "TA", gradient: "linear-gradient(135deg,#5089E0,#0B3F90)", rating: 5, active: true },
  { id: 7, quote: "Yeniyetmə oğlumla əlaqəm tamamilə dəyişdi. Psixoloq hər ikimizə eşidilməyi öyrətdi.", authorName: "Lalə V.", authorRole: "Mingəçevir · Valideynlik", initials: "LV", gradient: "linear-gradient(135deg,#2A6BD0,#1A3B7A)", rating: 5, active: true },
  { id: 8, quote: "İş yerində burnout-dan çıxış yolu tapmışdım. İndi sərhəd qoymağı bilirəm.", authorName: "Cavid R.", authorRole: "Bakı · Burnout", initials: "CR", gradient: "linear-gradient(135deg,#3D70C8,#0B3F90)", rating: 5, active: true },
];

/** Tam adı "Ad S." formatına salır. Cütlük ("Tural & Ayşə") və tək ad olduğu kimi qalır. */
function shortName(full?: string): string {
  if (!full) return "";
  if (full.includes("&")) return full;
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  const first = parts[0];
  const last = parts[parts.length - 1].replace(/\.$/, "");
  if (!last) return first;
  return `${first} ${last.charAt(0).toLocaleUpperCase("az")}.`;
}

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="13" height="13" fill="#F5B946" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function Card({ t }: { t: Testimonial }) {
  return (
    <div className="fanus-tcard">
      <Stars count={t.rating || 5} />
      <p className="fanus-tcard__quote">&ldquo;{t.quote}&rdquo;</p>
      <div className="fanus-tcard__foot">
        <div className="fanus-tcard__avatar" style={{ background: t.gradient }}>{t.initials}</div>
        <div>
          <p className="fanus-tcard__name">{shortName(t.authorName)}</p>
          <p className="fanus-tcard__role">{t.authorRole}</p>
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({ items, reverse }: { items: Testimonial[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="fanus-marq">
      <div
        className="fanus-marq__track"
        style={{ animation: `${reverse ? "fanusMarqRev" : "fanusMarq"} ${items.length * 6}s linear infinite` }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((t, i) => <Card key={i} t={t} />)}
      </div>
    </div>
  );
}

export default function Testimonials({ testimonials }: { testimonials?: Testimonial[] }) {
  const { t } = useT();
  const items = (testimonials && testimonials.length > 0) ? testimonials : FALLBACK;
  const half = Math.ceil(items.length / 2);
  const row1 = items.slice(0, half);
  const row2 = items.slice(half);

  return (
    <section className="fanus-tst" id="testimonials">
      <Deco type="blob-2" style={{ top: 40, left: "-3%", width: 320, opacity: .55 }} anim="drift" />
      <Deco type="cards" style={{ bottom: 30, right: "4%", width: 220, opacity: .6 }} />
      <div className="fanus-container">
        <div className="fanus-tst__head">
          <h2>{t("test.title")}</h2>
          <p>{t("test.sub")}</p>
        </div>
      </div>

      <div className="fanus-tst__rows">
        <MarqueeRow items={row1.length ? row1 : items} />
        {row2.length > 0 && <MarqueeRow items={row2} reverse />}
      </div>

      <style>{`
        @keyframes fanusMarq {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes fanusMarqRev {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        .fanus-tst {
          padding: 100px 0;
          background: linear-gradient(180deg, var(--fanus-primary-50) 0%, #FFFFFF 100%);
          position: relative; overflow: hidden;
        }
        .fanus-tst > .fanus-container { position: relative; z-index: 1; }
        .fanus-tst__head { text-align: center; max-width: 760px; margin: 0 auto 56px; }
        .fanus-tst__head .fanus-eyebrow { justify-content: center; }
        .fanus-tst__head h2 {
          color: var(--fanus-ink);
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; margin: 0;
        }
        .fanus-tst__head p { color: var(--fanus-ink-3); margin: 12px 0 0; }
        .fanus-tst__rows { display: flex; flex-direction: column; gap: 18px; }

        .fanus-marq {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
        }
        .fanus-marq__track { display: flex; width: max-content; }

        .fanus-tcard {
          flex-shrink: 0;
          width: 320px;
          background: #fff;
          border-radius: 20px;
          padding: 22px;
          margin-right: 16px;
          border: 1px solid var(--fanus-line);
          box-shadow: var(--fanus-shadow-sm);
          transition: box-shadow .25s ease, transform .25s ease, border-color .25s ease;
        }
        .fanus-tcard:hover {
          box-shadow: 0 22px 46px rgba(16,81,183,.12);
          transform: translateY(-3px);
          border-color: var(--fanus-primary-300);
        }
        .fanus-tcard__quote {
          color: var(--fanus-ink); font-size: 14.5px; line-height: 1.55;
          margin: 12px 0 18px;
        }
        .fanus-tcard__foot {
          display: flex; align-items: center; gap: 12px;
          padding-top: 14px; border-top: 1px solid var(--fanus-line);
        }
        .fanus-tcard__avatar {
          width: 36px; height: 36px; border-radius: 50%;
          color: white; font-weight: 700; font-size: 12px;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .fanus-tcard__name { font-weight: 600; color: var(--fanus-ink); font-size: 14px; margin: 0; }
        .fanus-tcard__role { color: var(--fanus-ink-3); font-size: 12px; margin: 2px 0 0; }
      `}</style>
    </section>
  );
}
