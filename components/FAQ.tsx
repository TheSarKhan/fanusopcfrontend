"use client";

import { useState } from "react";
import type { Faq } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const FALLBACK: Faq[] = [
  { id: 1, question: "Onlayn seans nə qədər təsirlidir?", answer: "Tədqiqatlar göstərir ki, peşəkar psixoloqla aparılan onlayn seanslar effektivlik baxımından klinik müayinələrlə müqayisə oluna bilir. Üstəlik öz mühitinizdə daha açıq danışmaq mümkün olur, yol və gözləmə vaxtı sıfırdır.", displayOrder: 1, active: true },
  { id: 2, question: "Məlumatlarım təhlükəsizdirmi?", answer: "Bəli. Seans qeydləri saxlanmır. Şəxsi məlumatlarınız üçüncü tərəflərlə paylaşılmır. İstədiyiniz vaxt anonim profil yarada və ya hesabınızı silə bilərsiniz.", displayOrder: 2, active: true },
  { id: 3, question: "Bir seans nə qədər çəkir və nə qədər başa gəlir?", answer: "Standart seans 50 dəqiqədir. Qiymət psixoloqdan asılı olaraq dəyişir — hər mütəxəssisin profilində açıq göstərilib. Seçdiyiniz psixoloqla ilk 15 dəqiqəlik tanışlıq görüşü pulsuzdur.", displayOrder: 3, active: true },
  { id: 4, question: "Mənə uyğun psixoloqu necə seçirsiniz?", answer: "Qısa müraciətinizi operator komandamız oxuyur — alqoritm yox, insan. Ehtiyacınıza, dilinizə və büdcənizə uyğun mütəxəssisi qısa müddətdə təklif edirik. İlk tanışlıq görüşündən sonra istəyirsinizsə başqa psixoloqa keçə bilərsiniz.", displayOrder: 4, active: true },
  { id: 5, question: "Seansı ləğv edə və ya təxirə sala bilərəmmi?", answer: "Bəli. Seansdan ən az 12 saat əvvəl ödənişsiz dəyişdirə bilərsiniz. Daha gec ləğvlərdə ödənişin müəyyən hissəsi tutulur — dəqiq qaydalar müraciət təsdiqi anında göstərilir.", displayOrder: 5, active: true },
  { id: 6, question: "Hansı problemlərlə müraciət edə bilərəm?", answer: "Narahatlıq, depressiya, münasibət problemləri, travma, burnout, yuxu pozğunluğu, valideynlik stress-i, asılılıqlar. Əmin deyilsinizsə — qısa müraciət göndərin, operator komandamız sizə uyğun mütəxəssisi yönləndirəcək.", displayOrder: 6, active: true },
  { id: 7, question: "Hansı dildə seans keçirilir?", answer: "Hər psixoloqun profilində çalışdığı dillər (Azərbaycan, rus, ingilis) göstərilib. Müraciətinizdə üstünlük verdiyiniz dili qeyd edirsiniz.", displayOrder: 7, active: true },
  { id: 8, question: "Texniki problem olarsa nə edim?", answer: "Video zəng linki seansdan əvvəl e-poçt və SMS ilə gəlir. Bağlantı kəsilərsə bizə yazın — operator dərhal psixoloqla əlaqə saxlayır və ya seansı yenidən planlaşdırır. Heç nə endirmək lazım deyil — link brauzerdə açılır.", displayOrder: 8, active: true },
];

export default function FAQ({ faqs }: { faqs?: Faq[] }) {
  const { t } = useT();
  const data = (faqs && faqs.length > 0) ? faqs : FALLBACK;
  const [open, setOpen] = useState(0);

  return (
    <section className="fanus-faq" id="faq">
      <div className="fanus-container fanus-faq__container">
        <div className="fanus-faq__left">
          <h2>{t("faq.title")}</h2>
          <p className="fanus-faq__lead">{t("faq.lead")}</p>
          <a href="#contact" className="fanus-btn fanus-btn-light" style={{ marginTop: 20 }}>
            <MsgIcon /> {t("faq.contactCta")}
          </a>
        </div>

        <div className="fanus-faq__list">
          {data.map((it, i) => (
            <div key={it.id} className={`fanus-faq-item ${open === i ? "is-open" : ""}`}>
              <button className="fanus-faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{it.question}</span>
                <span className="fanus-faq-toggle">
                  {open === i ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M5 12h14" /></svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  )}
                </span>
              </button>
              <div className="fanus-faq-a-wrap">
                <p className="fanus-faq-a">{it.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .fanus-faq { padding: 100px 0; position: relative; overflow: hidden; }
        .fanus-faq > .fanus-container { position: relative; z-index: 1; }
        .fanus-faq__container { display: grid; grid-template-columns: 1fr 1.4fr; gap: 56px; align-items: flex-start; }
        .fanus-faq__left { position: sticky; top: 100px; }
        .fanus-faq__left h2 {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(30px, 3.6vw, 48px); font-weight: 700;
          letter-spacing: -0.025em; line-height: 1.1; color: var(--fanus-ink);
        }
        .fanus-faq__lead { margin-top: 16px; font-size: 17px; color: var(--fanus-ink-3); }
        .fanus-faq__list { display: flex; flex-direction: column; gap: 12px; }
        .fanus-faq-item {
          background: white; border: 1px solid var(--fanus-line);
          border-radius: 16px; overflow: hidden;
          transition: all .3s;
        }
        .fanus-faq-item.is-open {
          border-color: var(--fanus-primary-300);
          box-shadow: 0 12px 30px rgba(16,81,183,.08);
        }
        .fanus-faq-q {
          width: 100%; padding: 20px 22px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; text-align: left;
          font-size: 16px; font-weight: 600;
          color: var(--fanus-ink); transition: color .2s;
          background: transparent; border: none; cursor: pointer; font-family: inherit;
        }
        .fanus-faq-item.is-open .fanus-faq-q { color: var(--fanus-primary); }
        .fanus-faq-toggle {
          flex-shrink: 0;
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--fanus-primary-50); color: var(--fanus-primary);
          display: inline-flex; align-items: center; justify-content: center;
          transition: all .25s;
        }
        .fanus-faq-item.is-open .fanus-faq-toggle {
          background: var(--fanus-primary); color: white; transform: rotate(180deg);
        }
        .fanus-faq-a-wrap {
          display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .35s ease;
        }
        .fanus-faq-item.is-open .fanus-faq-a-wrap { grid-template-rows: 1fr; }
        .fanus-faq-a {
          overflow: hidden; padding: 0 22px;
          font-size: 15px; color: var(--fanus-ink-3); line-height: 1.65; margin: 0;
        }
        .fanus-faq-item.is-open .fanus-faq-a { padding: 0 22px 22px; }
        @media (max-width: 860px) {
          .fanus-faq__container { grid-template-columns: 1fr; gap: 36px; }
          .fanus-faq__left { position: static; }
        }
      `}</style>
    </section>
  );
}

function MsgIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5z" /></svg>;
}
