"use client";

import type { Testimonial } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const CARD_TITLES = [
  "Təhlükəsiz mühit",
  "Həyatım dəyişdi",
  "Doğru seçim",
  "Həmişə yanımda",
  "Həqiqi dinləyici",
  "Münasibətimiz gücləndi",
  "Ailə körpüsü",
  "Burnout-dan çıxış",
];

const STATS = [
  { num: "50+",   label: "Sertifikatlı psixoloq" },
  { num: "4.9/5", label: "Ortalama reytinq",      star: true },
  { num: "100%",  label: "Məxfilik" },
];

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

function Card({ item, title }: { item: Testimonial; title: string }) {
  return (
    <div className="tst-card">
      <p className="tst-card__title">{title}</p>
      <p className="tst-card__text">{item.quote}</p>
      <p className="tst-card__author">{shortName(item.authorName)}</p>
    </div>
  );
}

function MarqueeRow({ items }: { items: Testimonial[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="tst-marq">
      <div
        className="tst-marq__track"
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <Card key={i} item={item} title={CARD_TITLES[i % CARD_TITLES.length]} />
        ))}
      </div>
    </div>
  );
}

export default function Testimonials({ testimonials }: { testimonials?: Testimonial[] }) {
  const { t } = useT();
  const items = (testimonials && testimonials.length > 0) ? testimonials : FALLBACK;

  return (
    <section className="tst-section" id="testimonials">
      {/* Heading */}
      <div className="fanus-container tst-top">
        <h2 className="tst-heading">{t("test.title")}</h2>
        <p className="tst-sub">{t("test.sub")}</p>
      </div>

      {/* Trust bar */}
      <div className="tst-trust">
        {STATS.map((s, i) => (
          <div key={s.num} className="tst-trust__item">
            {i > 0 && <span className="tst-trust__sep" aria-hidden />}
            <span className="tst-trust__num">
              {s.star && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1051B7" style={{ marginRight: 5, verticalAlign: "middle", marginTop: -2 }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              {s.num}
            </span>
            <span className="tst-trust__label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Marquee */}
      <MarqueeRow items={items} />

      <style>{`
        @keyframes tstMarq {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        .tst-section {
          padding: 96px 0 100px;
          background: #fff;
          overflow: hidden;
        }

        /* ── Heading ── */
        .tst-top { text-align: center; margin-bottom: 32px; }
        .tst-heading {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(26px, 3vw, 40px);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--fanus-ink);
          margin: 0 0 10px;
        }
        .tst-sub {
          font-size: 15px;
          color: var(--fanus-ink-3);
          margin: 0;
        }

        /* ── Trust bar ── */
        .tst-trust {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 52px;
        }
        .tst-trust__item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tst-trust__sep {
          display: block;
          width: 1px;
          height: 36px;
          background: var(--fanus-line);
          margin: 0 28px;
          flex-shrink: 0;
        }
        .tst-trust__num {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(22px, 2.2vw, 30px);
          font-weight: 700;
          color: #1051B7;
          display: flex;
          align-items: center;
          line-height: 1;
        }
        .tst-trust__label {
          font-size: 13px;
          color: var(--fanus-ink-3);
          font-weight: 500;
          white-space: nowrap;
        }

        /* ── Marquee ── */
        .tst-marq {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%);
        }
        .tst-marq__track {
          display: flex;
          width: max-content;
          animation: tstMarq ${items.length * 5}s linear infinite;
        }

        /* ── Card ── */
        .tst-card {
          flex-shrink: 0;
          width: 320px;
          background: #fff;
          border: 1px solid #E2E8F4;
          border-radius: 16px;
          padding: 24px;
          margin-right: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: box-shadow .2s, border-color .2s;
        }
        .tst-marq__track:hover .tst-card:hover {
          box-shadow: 0 12px 32px rgba(16,81,183,.1);
          border-color: #C0D0F0;
        }
        .tst-card__title {
          font-size: 15px;
          font-weight: 600;
          color: var(--fanus-ink);
          margin: 0;
        }
        .tst-card__text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--fanus-ink-2);
          margin: 0;
          flex: 1;
        }
        .tst-card__author {
          font-size: 14px;
          font-weight: 600;
          color: var(--fanus-ink);
          margin: 0;
        }

        /* ── Responsive ── */
        @media (max-width: 700px) {
          .tst-section { padding: 64px 0 72px; }
          .tst-trust { flex-wrap: wrap; gap: 20px; }
          .tst-trust__item { flex-direction: column; align-items: center; gap: 4px; }
          .tst-trust__sep { display: none; }
          .tst-card { width: 280px; }
        }
      `}</style>
    </section>
  );
}
