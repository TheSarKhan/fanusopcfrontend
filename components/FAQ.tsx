"use client";

import { useState } from "react";
import type { Faq } from "@/lib/api";

function FAQItem({ item, index }: { item: Faq; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        borderColor: open ? "#002147" : "#C0D2E6",
        background: open ? "#F0F4FA" : "#ffffff",
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
              background: open ? "#002147" : "#E0EBF7",
              color: open ? "white" : "#002147",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-semibold text-[#1A2535] text-[0.9375rem]">{item.question}</span>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{
            background: open ? "#002147" : "#E0EBF7",
            color: open ? "white" : "#002147",
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
          <div className="ml-12 text-[#52718F] leading-relaxed text-sm">
            {item.answer}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FAQ({ faqs }: { faqs: Faq[] }) {
  return (
    <section id="faq" className="section" style={{ background: "#F0F4FA" }}>
      <div className="container">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-2">
            <p className="section-label">SSS</p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
            >
              Tez-tez soruşulan suallar
            </h2>
            <p className="text-[#52718F] leading-relaxed mb-8">
              Psixoloji yardım haqqında ümumi suallara cavab tapmaq istəyirsiniz?
              Burada ən çox soruşulan suallara cavablar var.
            </p>
            <div className="rounded-2xl p-6" style={{ background: "#E0EBF7" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#002147] flex items-center justify-center">
                  <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="font-semibold text-[#1A2535]">Başqa sualınız var?</p>
              </div>
              <p className="text-sm text-[#52718F] mb-4">
                Cavab tapa bilmədinizsə, bizimle əlaqə saxlayın.
              </p>
              <a href="mailto:info@fanus.az" className="btn-primary text-sm py-2.5 px-5 inline-flex">
                Yazın bizə →
              </a>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-3">
            {faqs.map((item, i) => (
              <FAQItem key={item.id} item={item} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
