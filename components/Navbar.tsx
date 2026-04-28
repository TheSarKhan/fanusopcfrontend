"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useBooking } from "@/context/BookingContext";

const navLinks = [
  { label: "Haqqımızda", href: "/about" },
  { label: "Xidmətlər", href: "/xidmetler" },
  { label: "Psixoloqlar", href: "/psychologists" },
  { label: "Bloq", href: "/blog" },
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

  const textColor = scrolled ? "#52718F" : "rgba(255,255,255,0.85)";

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={scrolled ? {
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 rgba(213,227,240,0.8)",
      } : { background: "transparent" }}
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src={scrolled ? "/images/logos/logo-blue.png" : "/images/logos/logo-white.png"}
            alt="Fanus"
            className="h-9 w-auto object-contain transition-opacity duration-300"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.9rem] font-medium transition-colors duration-200"
              style={{ color: textColor }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="py-2.5 px-5 text-sm font-semibold rounded-full transition-all duration-200"
            style={scrolled
              ? { color: "#3B6FA5", border: "1.5px solid #C0D2E6" }
              : { color: "rgba(255,255,255,0.9)", border: "1.5px solid rgba(255,255,255,0.4)" }
            }
          >
            Daxil ol
          </Link>
          <Link
            href="/register"
            className="py-2.5 px-5 text-sm font-bold rounded-full transition-all duration-200"
            style={scrolled
              ? { background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff" }
              : { background: "#ffffff", color: "#2A57B0" }
            }
          >
            Qeydiyyat
          </Link>
          <button
            onClick={() => open()}
            className="py-2.5 px-5 text-sm font-bold rounded-full transition-all duration-200"
            style={scrolled
              ? { background: "#F3F6FB", color: "#002147", border: "1.5px solid #C0D2E6" }
              : { color: "rgba(255,255,255,0.8)", border: "1.5px solid rgba(255,255,255,0.3)" }
            }
          >
            Randevu al
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden flex rounded-lg transition-colors items-center justify-center"
          style={{ color: scrolled ? "#002147" : "rgba(255,255,255,0.9)", padding: "10px", minWidth: 44, minHeight: 44 }}
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
        <div className="md:hidden bg-white border-t border-[#C0D2E6] px-5 py-6 flex flex-col gap-5 animate-fadeIn">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-base font-medium text-[#1A2535] hover:text-[#002147] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-3">
            <Link
              href="/login"
              className="btn-outline text-center"
              onClick={() => setMenuOpen(false)}
            >
              Daxil ol
            </Link>
            <Link
              href="/register"
              className="btn-primary text-center"
              onClick={() => setMenuOpen(false)}
            >
              Qeydiyyat
            </Link>
            <button
              onClick={() => { open(); setMenuOpen(false); }}
              className="btn-outline text-center"
            >
              Randevu al
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
