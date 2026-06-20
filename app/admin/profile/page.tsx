"use client";

import Link from "next/link";
import ProfileShell from "@/components/ProfileShell";

const SVG = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const LINKS = [
  {
    href: "/admin/users", title: "İstifadəçilər", subtitle: "Pasiyent, psixoloq, operator",
    icon: <svg {...SVG}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  },
  {
    href: "/admin/psychologists", title: "Psixoloqlar", subtitle: "Profil və ərizələr",
    icon: <svg {...SVG}><path d="M12 2a4.5 4.5 0 0 0-4.5 4.5c0 .8.2 1.5.6 2.2A4 4 0 0 0 6 12.5a4 4 0 0 0 1 2.6V18a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.9a4 4 0 0 0 1-2.6 4 4 0 0 0-2.1-3.8c.4-.7.6-1.4.6-2.2A4.5 4.5 0 0 0 12 2z" /></svg>,
  },
  {
    href: "/admin/blog", title: "Məqalələr", subtitle: "Blog kontentinin idarəsi",
    icon: <svg {...SVG}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  },
  {
    href: "/admin/reviews", title: "Rəylər", subtitle: "Moderasiya növbəsi",
    icon: <svg {...SVG}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  },
  {
    href: "/admin/settings", title: "Parametrlər", subtitle: "Sistem konfiqurasiyası",
    icon: <svg {...SVG}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
];

export default function AdminProfilePage() {
  return (
    <ProfileShell
      title="Profil"
      subtitle="Admin hesabınız və əlaqə məlumatları"
      sideExtras={
        <div className="uprof-card uprof-side-card">
          <div className="uprof-side-card-head">
            <h3>Sürətli giriş</h3>
          </div>
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className="uprof-side-link"
              style={i > 0 ? { borderTop: "1px solid var(--brand-100)" } : undefined}
            >
              <div className="uprof-side-link-icon">{l.icon}</div>
              <div className="uprof-side-link-text">
                <strong>{l.title}</strong>
                <small>{l.subtitle}</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
          ))}
        </div>
      }
    />
  );
}
