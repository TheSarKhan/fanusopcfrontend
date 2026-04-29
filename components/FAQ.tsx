"use client";

import { useState } from "react";
import type { Faq } from "@/lib/api";
import { useBooking } from "@/context/BookingContext";

function FAQItem({ item }: { item: Faq }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderBottom: "1px solid #EDF2F7",
        transition: "all 0.2s",
      }}
    >
      <button
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 0",
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          gap: "1rem",
        }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span style={{
          fontSize: "0.9625rem",
          fontWeight: 600,
          color: open ? "#002147" : "#1A2535",
          lineHeight: 1.5,
        }}>
          {item.question}
        </span>
        <div style={{
          width: 28, height: 28,
          borderRadius: "50%",
          background: open ? "#002147" : "#EDF2F7",
          color: open ? "#fff" : "#52718F",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.2s",
        }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0)", transition: "transform 0.2s" }}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ paddingBottom: "1.25rem" }}>
          <p style={{
            fontSize: "0.9rem",
            color: "#52718F",
            lineHeight: 1.75,
            margin: 0,
          }}>
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQ({ faqs }: { faqs: Faq[] }) {
  const { open } = useBooking();

  return (
    <section style={{ background: "#ffffff", padding: "6rem 0" }}>
      <div className="container">
        <div className="grid lg:grid-cols-5 gap-16 items-start">

          {/* Left */}
          <div className="lg:col-span-2">
            <p style={{
              fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#6B7280", marginBottom: "0.75rem",
            }}>
              SSS
            </p>
            <h2 style={{
              
              fontSize: "clamp(1.75rem, 3vw, 2.4rem)",
              fontWeight: 700, color: "#1A2535",
              lineHeight: 1.3, marginBottom: "1rem",
            }}>
              Tez-tez soruşulan suallar
            </h2>
            <p style={{ color: "#52718F", lineHeight: 1.75, fontSize: "0.95rem", marginBottom: "2rem" }}>
              Psixoloji yardım haqqında ümumi suallara cavab tapmaq istəyirsiniz?
            </p>

            {/* Contact card */}
            <div style={{
              background: "#F4F7FB",
              borderRadius: 14,
              padding: "1.5rem",
              border: "1px solid #EDF2F7",
            }}>
              <div style={{
                width: 40, height: 40,
                borderRadius: 10,
                background: "#002147",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "0.875rem",
              }}>
                <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontWeight: 700, color: "#1A2535", marginBottom: "0.375rem", fontSize: "0.9375rem" }}>
                Başqa sualınız var?
              </p>
              <p style={{ fontSize: "0.875rem", color: "#52718F", marginBottom: "1rem", lineHeight: 1.65 }}>
                Cavab tapa bilmədinizsə, bizimle əlaqə saxlayın.
              </p>
              <button
                onClick={() => open(undefined, "contact")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#002147", color: "#fff",
                  fontWeight: 600, fontSize: "0.875rem",
                  padding: "9px 20px", borderRadius: 8,
                  cursor: "pointer", transition: "opacity 0.2s",
                }}
              >
                Yazın bizə →
              </button>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-3">
            {faqs.map((item) => (
              <FAQItem key={item.id} item={item} />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
