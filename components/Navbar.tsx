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
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={scrolled ? {
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 rgba(213,227,240,0.8)",
      } : {
        background: "transparent",
      }}
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/images/hero-main.png"
            alt="Fanus"
            className="h-9 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.9rem] font-medium transition-colors duration-200"
              style={{ color: scrolled ? "#6B85A0" : "rgba(255,255,255,0.85)" }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {scrolled ? (
            <>
              <a href="#psychologists" className="btn-outline py-2.5 px-5 text-sm">
                Psixoloq seç
              </a>
              <button onClick={() => open()} className="btn-primary py-2.5 px-5 text-sm">
                Randevu al
              </button>
            </>
          ) : (
            <>
              <a
                href="#psychologists"
                className="py-2.5 px-5 text-sm font-semibold rounded-full transition-all duration-200"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                }}
              >
                Psixoloq seç
              </a>
              <button
                onClick={() => open()}
                className="py-2.5 px-5 text-sm font-bold rounded-full transition-all duration-200"
                style={{ background: "#ffffff", color: "#2A57B0" }}
              >
                Randevu al
              </button>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden flex rounded-lg transition-colors items-center justify-center"
          style={{ color: scrolled ? "#3B6FA5" : "rgba(255,255,255,0.9)", padding: "10px", minWidth: 44, minHeight: 44 }}
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
