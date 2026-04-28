"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/api";
import { getStoredUser, getMainSiteUrl } from "@/lib/auth";
import PanelAuthGuard from "@/components/PanelAuthGuard";

const NAV = [
  { href: "/patient", label: "Dashboard", icon: "🏠" },
  { href: "/patient/profile", label: "Profilim", icon: "👤" },
  { href: "/patient/appointments", label: "Randevularım", icon: "📅" },
];

function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = getStoredUser();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = `${getMainSiteUrl()}?_logout=1`;
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#F3F6FB" }}>
      <aside
        className="w-60 flex-shrink-0 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #002147 0%, #1E3A5F 100%)",
          minHeight: "100vh",
        }}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: "linear-gradient(135deg, #5A4FC8, #3B6FA5)" }}
            >
              F
            </div>
            <div>
              <div className="text-white font-bold text-sm">Fanus</div>
              <div className="text-white/50 text-xs">Pasiyent Paneli</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/patient" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  color: active ? "#fff" : "rgba(255,255,255,0.6)",
                  background: active ? "rgba(255,255,255,0.15)" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          {user && (
            <div className="text-white/70 text-xs mb-3 truncate">
              {user.firstName} {user.lastName}
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <span>🚪</span>
            {loggingOut ? "Çıxılır..." : "Çıxış"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelAuthGuard requiredRole="PATIENT">
      <PatientShell>{children}</PatientShell>
    </PanelAuthGuard>
  );
}
