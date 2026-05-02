"use client";

import Link from "next/link";
import Image from "next/image";
import { useBooking } from "@/context/BookingContext";

const socials = [
  {
    label: "Instagram",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const { open } = useBooking();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <Link href="/" style={{ display: "inline-block" }}>
              <Image
                src="/images/logos/logo-white.png"
                alt="Fanus"
                width={110}
                height={36}
                style={{ objectFit: "contain" }}
              />
            </Link>
            <p>Azərbaycan dilində danışan, mədəniyyətimizi anlayan onlayn psixologiya platforması.</p>
            <div className="footer-social">
              {socials.map((s) => (
                <a key={s.label} href="#" aria-label={s.label}>{s.icon}</a>
              ))}
            </div>
          </div>

          {/* Platforma */}
          <div className="footer-col">
            <h4>Platforma</h4>
            <Link href="/xidmetler">Necə işləyir</Link>
            <Link href="/psychologists">Psixoloqlar</Link>
            <Link href="/xidmetler">Xidmətlər</Link>
            <Link href="/register?role=psychologist">Psixoloq kimi qoşul</Link>
          </div>

          {/* Resurslar */}
          <div className="footer-col">
            <h4>Resurslar</h4>
            <Link href="/blog">Məqalələr</Link>
            <Link href="/about">Haqqımızda</Link>
            <Link href="/register">Qeydiyyat</Link>
            <Link href="/login">Daxil ol</Link>
          </div>

          {/* Əlaqə */}
          <div className="footer-col">
            <h4>Əlaqə</h4>
            <a href="mailto:salam@fanus.az">salam@fanus.az</a>
            <a href="tel:+994122000000">+994 12 200 00 00</a>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 8 }}>
              Nizami küçəsi 28<br />Bakı, Azərbaycan
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <div>© 2026 Fanus. Bütün hüquqlar qorunur.</div>
          <div className="footer-legal">
            <Link href="/privacy">Məxfilik siyasəti</Link>
            <Link href="/terms">İstifadə şərtləri</Link>
          </div>
          <div className="footer-emergency">
            <svg width="13" height="13" fill="none" stroke="var(--amber)" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            Krizdə?&nbsp;<a href="tel:113"><strong>113</strong></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
