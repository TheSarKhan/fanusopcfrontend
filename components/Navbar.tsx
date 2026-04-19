"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useBooking } from "@/context/BookingContext";

const navLinks = [
  { label: "Haqqımızda", href: "#about" },
  { label: "Psixoloqlar", href: "#psychologists" },
  { label: "Bloq", href: "#blog" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { open } = useBooking();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-[#D5E3F0]"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-18">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #3B6FA5, #1E4070)" }}
          >
            F
          </span>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A2535" }}
          >
            Fanus
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.9rem] font-medium text-[#6B85A0] hover:text-[#1A2535] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="#psychologists" className="btn-outline py-2.5 px-5 text-sm">
            Psixoloq seç
          </a>
          <button onClick={() => open()} className="btn-primary py-2.5 px-5 text-sm">
            Randevu al
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-[#3B6FA5] hover:bg-[#E4EEF8] transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menyunu aç/bağla"
        >
          {menuOpen ? (
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-[#D5E3F0] px-5 py-6 flex flex-col gap-5 animate-fadeIn">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-base font-medium text-[#1A2535] hover:text-[#3B6FA5] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-3">
            <a href="#psychologists" className="btn-outline text-center" onClick={() => setMenuOpen(false)}>
              Psixoloq seç
            </a>
            <button onClick={() => { open(); setMenuOpen(false); }} className="btn-primary text-center justify-center">
              Randevu al
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
