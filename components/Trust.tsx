"use client";

import type { Testimonial } from "@/lib/api";


function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="13" height="13" fill="#F59E0B" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 300,
        background: "#fff",
        borderRadius: "1.25rem",
        padding: "20px",
        boxShadow: "0 2px 16px rgba(26,37,53,0.07)",
        border: "1px solid #EEF4FB",
        marginRight: 16,
      }}
    >
      <Stars count={t.rating} />
      <p className="text-[#1A2535] text-sm leading-relaxed mt-3 mb-4">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3" style={{ borderTop: "1px solid #EEF4FB", paddingTop: 14 }}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: t.gradient }}
        >
          {t.initials}
        </div>
        <div>
          <p className="font-semibold text-[#1A2535] text-sm">{t.authorName}</p>
          <p className="text-xs text-[#52718F]">{t.authorRole}</p>
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({ items, reverse }: { items: Testimonial[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div style={{ overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)" }}>
      <div
        style={{
          display: "flex",
          width: "max-content",
          animation: `marquee${reverse ? "Rev" : ""} ${items.length * 5}s linear infinite`,
        }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
      >
        {doubled.map((t, i) => (
          <TestimonialCard key={i} t={t} />
        ))}
      </div>
    </div>
  );
}

export default function Trust({ testimonials }: { testimonials: Testimonial[] }) {
  const half = Math.ceil(testimonials.length / 2);
  const row1 = testimonials.slice(0, half);
  const row2 = testimonials.slice(half);

  return (
    <section style={{ background: "#F4F7FB", padding: "6rem 0", overflow: "hidden" }}>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marqueeRev {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      <div className="container">
        <div className="text-center mb-10">
          <p className="section-label justify-center">Müştəri rəyləri</p>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{  color: "#1A2535" }}
          >
            Onlar bizə güvəndilər
          </h2>
          <p className="text-[#52718F] max-w-sm mx-auto text-sm leading-relaxed">
            Hər müştərimizin hekayəsi bizim üçün xüsusidir.
          </p>
        </div>
      </div>

      {testimonials.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 48 }}>
          <MarqueeRow items={row1.length ? row1 : testimonials} />
          {row2.length > 0 && <MarqueeRow items={row2} reverse />}
        </div>
      )}

    </section>
  );
}
