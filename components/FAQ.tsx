"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Seanslar necə keçirilir?",
    a: "Seanslar həm onlayn (video görüntülü zəng vasitəsilə), həm də üz-üzə formatlarda keçirilir. Hər seans orta 50-60 dəqiqə çəkir. Psixoloq ilə birlikdə sizin vəziyyətinizə uyğun seans tezliyi müəyyənləşdirilir.",
  },
  {
    q: "Gizlilik qorunur mu?",
    a: "Bəli, tam olaraq. Bütün məlumatlarınız GDPR standartlarına uyğun şəkildə qorunur. Psixoloqlarımız etik qaydalara bağlıdır və heç bir məlumatınız üçüncü şəxslərlə paylaşılmır. Yalnız qanunun tələb etdiyi istisnalar mövcuddur.",
  },
  {
    q: "Qiymətlər necədir?",
    a: "Qiymətlər psixoloqa, seans növünə (fərdi, ailə, qrup) və formata (onlayn/üz-üzə) görə fərqlənir. Hər psixoloğun profilində ətraflı qiymət məlumatı mövcuddur. İlk seans üçün xüsusi endirimlər mümkündür.",
  },
  {
    q: "İlk görüş necə olur?",
    a: "İlk görüşdə psixoloq sizinlə tanış olur, hazırki vəziyyətinizi, narahatlıqlarınızı və hədəflərinizi anlayır. Bu, qarşılıqlı tanışlıq seansdır — sizi mühakimə etmədən, sadəcə dinləyirlər. Heç bir öhdəlik götürməyə məcbur deyilsiniz.",
  },
  {
    q: "Neçə seans lazım olacaq?",
    a: "Bu fərdə görə dəyişir. Bəzilərində 3-5 seans əhəmiyyətli fərq yaradır, digərləri üçün daha uzun müddət lazım ola bilər. Psixoloğunuz ilk görüşdən sonra təxmini bir plan təqdim edəcəkdir.",
  },
  {
    q: "Onlayn seans effektivdirmi?",
    a: "Bəli, tədqiqatlar göstərir ki, onlayn psixoloji yardım üz-üzə seanslarla müqayisədə effektivlik baxımından demək olar ki, eynidir. Onlayn format əlavə olaraq rahatlıq, vaxt qənaəti və yerindən asılı olmama üstünlüklərini təqdim edir.",
  },
];

function FAQItem({ item, index }: { item: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        borderColor: open ? "#3B6FA5" : "#D5E3F0",
        background: open ? "#F4F8FC" : "#ffffff",
      }}
    >
      <button
        className="w-full flex items-center justify-between p-5 text-left gap-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-4">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
            style={{
              background: open ? "#3B6FA5" : "#E4EEF8",
              color: open ? "white" : "#3B6FA5",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-semibold text-[#1A2535] text-[0.9375rem]">{item.q}</span>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{
            background: open ? "#3B6FA5" : "#E4EEF8",
            color: open ? "white" : "#3B6FA5",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 animate-fadeIn">
          <div className="ml-12 text-[#6B85A0] leading-relaxed text-sm">
            {item.a}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="section" style={{ background: "#F4F8FC" }}>
      <div className="container">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          {/* Left */}
          <div className="lg:col-span-2">
            <p className="section-label">SSS</p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Tez-tez soruşulan suallar
            </h2>
            <p className="text-[#6B85A0] leading-relaxed mb-8">
              Psixoloji yardım haqqında ümumi suallara cavab tapmaq istəyirsiniz?
              Burada ən çox soruşulan suallara cavablar var.
            </p>
            <div
              className="rounded-2xl p-6"
              style={{ background: "#E4EEF8" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#3B6FA5] flex items-center justify-center">
                  <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="font-semibold text-[#1A2535]">Başqa sualınız var?</p>
              </div>
              <p className="text-sm text-[#6B85A0] mb-4">
                Cavab tapa bilmədinizsə, bizimle əlaqə saxlayın.
              </p>
              <a
                href="mailto:info@fanus.az"
                className="btn-primary text-sm py-2.5 px-5 inline-flex"
              >
                Yazın bizə →
              </a>
            </div>
          </div>

          {/* Right: FAQ list */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            {faqs.map((item, i) => (
              <FAQItem key={item.q} item={item} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
