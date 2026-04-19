"use client";

import { useBooking } from "@/context/BookingContext";

const footerLinks = {
  Xidmətlər: [
    { label: "Fərdi Terapiya", href: "#" },
    { label: "Ailə Terapiyası", href: "#" },
    { label: "Qrup Seansları", href: "#" },
    { label: "Onlayn Seanslar", href: "#" },
    { label: "Uşaq Psixologiyası", href: "#" },
  ],
  Şirkət: [
    { label: "Haqqımızda", href: "#about" },
    { label: "Komandamız", href: "#psychologists" },
    { label: "Karyera", href: "#" },
    { label: "Əlaqə", href: "#" },
  ],
  Resurslar: [
    { label: "Bloq", href: "#blog" },
    { label: "FAQ", href: "#faq" },
    { label: "Elanlar", href: "#" },
    { label: "Tədbirlər", href: "#" },
  ],
};

export default function Footer() {
  const { open } = useBooking();
  return (
    <footer style={{ background: "#1A2535", color: "#6B85A0" }}>
      <div className="container py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ background: "#3B6FA5" }}
              >
                F
              </span>
              <span
                className="text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-playfair, serif)" }}
              >
                Fanus
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#6B85A0" }}>
              Psixoloji sağlamlığınız üçün güvənli bir məkan. 2019-cu ildən bu günə.
            </p>
            {/* Social icons */}
            <div className="flex gap-3">
              {[
                {
                  label: "Instagram",
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <rect x="2" y="2" width="20" height="20" rx="5" />
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  label: "Facebook",
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                    </svg>
                  ),
                },
                {
                  label: "LinkedIn",
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                  ),
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:text-white"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#6B85A0" }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-white font-semibold mb-5 text-sm tracking-wide">{heading}</h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm transition-colors hover:text-white"
                      style={{ color: "#6B85A0" }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact bar */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-10"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <a
              href="tel:+994501234567"
              className="flex items-center gap-2 text-sm hover:text-white transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="#3B6FA5" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
              </svg>
              +994 50 123 45 67
            </a>
            <a
              href="mailto:info@fanus.az"
              className="flex items-center gap-2 text-sm hover:text-white transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="#3B6FA5" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              info@fanus.az
            </a>
          </div>
          <button onClick={() => open()} className="btn-primary py-2.5 px-6 text-sm flex-shrink-0">
            Randevu al
          </button>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p>© 2025 Fanus Psixoloji Mərkəzi. Bütün hüquqlar qorunur.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Gizlilik Siyasəti</a>
            <a href="#" className="hover:text-white transition-colors">İstifadə Şərtləri</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
