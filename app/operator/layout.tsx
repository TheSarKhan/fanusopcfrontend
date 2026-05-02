"use client";

import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";
import { getMainSiteUrl } from "@/lib/auth";
import PanelAuthGuard from "@/components/PanelAuthGuard";

const NAV_ITEMS = [
  { href: "/operator", label: "Dashboard", icon: "🏠" },
  { href: "/operator/appointments", label: "Randevular", icon: "📅" },
];

function OperatorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    window.location.href = `${getMainSiteUrl()}/login?_logout=1`;
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F0F4FA" }}>
      <aside
        style={{
          width: 240,
          background: "linear-gradient(180deg, #0F1C2E 0%, #1E3A5F 100%)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "1.5rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              F
            </div>
            <div>
              <p className="font-bold text-white text-sm">Fanus Operator</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Operator Paneli</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/operator" && pathname.startsWith(item.href));
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
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

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
            }}
          >
            <span>🚪</span> Çıxış
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthGuard requiredRole="OPERATOR">
      <OperatorShell>{children}</OperatorShell>
    </PanelAuthGuard>
  );
}
