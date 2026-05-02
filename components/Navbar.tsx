"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { label: "Haqqımızda", href: "/about" },
  { label: "Xidmətlər", href: "/xidmetler" },
  { label: "Psixoloqlar", href: "/psychologists" },
  { label: "Məqalələr", href: "/blog" },
];


export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="container nav-inner">
        {/* Logo */}
        <Link href="/" className="nav-logo">
          <Image
            src="/images/logos/logo-blue.png"
            alt="Fanus"
            width={110}
            height={36}
            style={{ objectFit: "contain" }}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="nav-actions" style={{ alignItems: "center", gap: 16 }}>
          <Link href="/login" className="nav-login">Daxil ol</Link>
          <Link href="/register" className="btn btn-sm btn-primary" style={{ borderRadius: 8 }}>
            Qeydiyyat
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          style={{
            color: scrolled ? "var(--oxford)" : "var(--oxford-80)",
            padding: "10px", minWidth: 44, minHeight: 44,
            borderRadius: 8,
          }}
          className="flex md:hidden items-center justify-center"
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
        <div style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--oxford-10)",
          padding: "1.5rem",
          display: "flex", flexDirection: "column", gap: "1.25rem",
        }} className="animate-fadeIn md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ fontSize: "1rem", fontWeight: 500, color: "var(--oxford-80)" }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div style={{ paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link
              href="/login"
              className="btn btn-ghost"
              style={{ borderRadius: 9999, textAlign: "center", justifyContent: "center" }}
              onClick={() => setMenuOpen(false)}
            >
              Daxil ol
            </Link>
            <Link
              href="/register"
              className="btn btn-primary"
              style={{ borderRadius: 9999, textAlign: "center", justifyContent: "center" }}
              onClick={() => setMenuOpen(false)}
            >
              Qeydiyyat
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
