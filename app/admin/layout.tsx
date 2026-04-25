"use client";

import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "⬛" },
  { href: "/admin/psychologists", label: "Psixoloqlar", icon: "👤" },
  { href: "/admin/stats", label: "Statistika", icon: "📊" },
  { href: "/admin/announcements", label: "Elanlar", icon: "📢" },
  { href: "/admin/blog", label: "Bloq", icon: "📝" },
  { href: "/admin/faqs", label: "FAQ", icon: "❓" },
  { href: "/admin/testimonials", label: "Rəylər", icon: "⭐" },
  { href: "/admin/appointments", label: "Randevular", icon: "📅" },
  { href: "/admin/config", label: "Konfiqurasiya", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return <>{children}</>;

  const handleLogout = () => {
    logout();
    document.cookie = "adminToken=; path=/; max-age=0";
    router.push("/admin/login");
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F0F4FA" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: "linear-gradient(180deg, #0F1C2E 0%, #1E3A5F 60%, #2A57B0 100%)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "1.5rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              F
            </div>
            <div>
              <p className="font-bold text-white text-sm">Fanus Admin</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>İdarəetmə paneli</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.55)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span>🚪</span> Çıxış
          </button>
          <a
            href="/"
            target="_blank"
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              color: "rgba(255,255,255,0.55)",
              background: "transparent",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginTop: "0.25rem",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span>🌐</span> Sayta bax
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
