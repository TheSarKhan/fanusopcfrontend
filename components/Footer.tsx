"use client";

import { useBooking } from "@/context/BookingContext";

const footerLinks = {
  Xidmətlər: [
    { label: "Fərdi Terapiya",     href: "#" },
    { label: "Ailə Terapiyası",    href: "#" },
    { label: "Qrup Seansları",     href: "#" },
    { label: "Onlayn Seanslar",    href: "#" },
    { label: "Uşaq Psixologiyası", href: "#" },
  ],
  Şirkət: [
    { label: "Haqqımızda",  href: "#about"        },
    { label: "Psixoloqlar", href: "#psychologists" },
    { label: "Karyera",     href: "#"             },
    { label: "Əlaqə",       href: "#"             },
  ],
  Resurslar: [
    { label: "Bloq",      href: "#blog" },
    { label: "FAQ",       href: "#faq"  },
    { label: "Elanlar",   href: "#"     },
    { label: "Tədbirlər", href: "#"     },
  ],
};

const socials = [
  {
    label: "Instagram",
    href: "#",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "#",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "#",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
];

export default function Footer() {
  const { open } = useBooking();

  return (
    <footer>
      {/* Gradient wave transition from FinalCTA */}
      <div style={{ lineHeight: 0, background: "linear-gradient(135deg, #1E3A6E 0%, #2A57B0 50%, #5A4FC8 100%)" }}>
        <svg viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 60 }}>
          <path d="M0 0 Q360 60 720 30 Q1080 0 1440 40 L1440 60 L0 60 Z" fill="#F0F5FB" />
        </svg>
      </div>

      {/* Footer body */}
      <div style={{ background: "linear-gradient(180deg, #F0F5FB 0%, #EAF1FA 100%)" }}>
        <div className="container" style={{ paddingTop: "3rem", paddingBottom: "0" }}>
          <div className="grid md:grid-cols-4 gap-10 mb-12">

            {/* Brand column */}
            <div className="md:col-span-1">
              <img
                src="/images/hero-main.png"
                alt="Fanus"
                style={{ height: 36, objectFit: "contain", marginBottom: 16 }}
              />
              <p style={{ fontSize: "0.85rem", lineHeight: 1.75, color: "#6B85A0", marginBottom: 20 }}>
                Psixoloji sağlamlığınız üçün güvənli məkan. 2019-cu ildən bu günə.
              </p>

              {/* Social icons */}
              <div style={{ display: "flex", gap: 8 }}>
                {socials.map((s) => (
                  <a key={s.label} href={s.href} aria-label={s.label} style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#fff",
                    border: "1px solid #D5E3F0",
                    color: "#6B85A0",
                    transition: "all 0.2s",
                    textDecoration: "none",
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "#3B6FA5";
                      el.style.borderColor = "#3B6FA5";
                      el.style.color = "#fff";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "#fff";
                      el.style.borderColor = "#D5E3F0";
                      el.style.color = "#6B85A0";
                    }}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <h4 style={{
                  color: "#1A2535", fontWeight: 700,
                  fontSize: "0.8rem", letterSpacing: "0.08em",
                  textTransform: "uppercase", marginBottom: 16,
                }}>
                  {heading}
                </h4>
                <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
                  {links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} style={{
                        color: "#6B85A0", fontSize: "0.88rem",
                        textDecoration: "none", transition: "color 0.15s",
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#3B6FA5"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6B85A0"}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact + CTA bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
            background: "#fff",
            border: "1px solid #D5E3F0",
            borderRadius: "1.25rem",
            padding: "16px 24px",
            marginBottom: 24,
            boxShadow: "0 2px 12px rgba(26,37,53,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <a href="tel:+994501234567" style={{
                display: "flex", alignItems: "center", gap: 7,
                color: "#6B85A0", fontSize: "0.85rem", textDecoration: "none",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#3B6FA5"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6B85A0"}
              >
                <svg width="14" height="14" fill="none" stroke="#3B6FA5" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
                </svg>
                +994 50 123 45 67
              </a>
              <a href="mailto:info@fanus.az" style={{
                display: "flex", alignItems: "center", gap: 7,
                color: "#6B85A0", fontSize: "0.85rem", textDecoration: "none",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#3B6FA5"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6B85A0"}
              >
                <svg width="14" height="14" fill="none" stroke="#3B6FA5" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                info@fanus.az
              </a>
            </div>
            <button onClick={() => open()} className="btn-primary py-2.5 px-6 text-sm flex-shrink-0">
              Randevu al →
            </button>
          </div>

          {/* Bottom bar */}
          <div style={{
            display: "flex", flexWrap: "wrap",
            alignItems: "center", justifyContent: "space-between",
            gap: 12, paddingTop: 18, paddingBottom: 24,
            borderTop: "1px solid #D5E3F0",
          }}>
            <p style={{ fontSize: "0.78rem", color: "#9BAFC0" }}>
              © 2025 Fanus Psixoloji Mərkəzi. Bütün hüquqlar qorunur.
            </p>
            <div style={{ display: "flex", gap: 20 }}>
              {["Gizlilik Siyasəti", "İstifadə Şərtləri"].map(l => (
                <a key={l} href="#" style={{
                  fontSize: "0.78rem", color: "#9BAFC0",
                  textDecoration: "none", transition: "color 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#3B6FA5"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9BAFC0"}
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
