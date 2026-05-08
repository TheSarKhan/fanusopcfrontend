"use client";

import Link from "next/link";
import ProfileShell from "@/components/ProfileShell";

const LINKS = [
  { href: "/admin/users",          icon: "👥", title: "İstifadəçilər", subtitle: "Pasiyent, psixoloq, operator" },
  { href: "/admin/psychologists",  icon: "🧠", title: "Psixoloqlar",   subtitle: "Profil və ərizələr" },
  { href: "/admin/blog",           icon: "📝", title: "Məqalələr",     subtitle: "Blog kontentinin idarəsi" },
  { href: "/admin/reviews",        icon: "⭐", title: "Rəylər",        subtitle: "Moderasiya növbəsi" },
  { href: "/admin/settings",       icon: "⚙",  title: "Parametrlər",  subtitle: "Sistem konfiqurasiyası" },
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
