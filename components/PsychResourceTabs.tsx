"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Shared sub-navigation for the psychologist "Resurslar" module.
   Three sibling routes presented as one tabbed module:
   Bilik bazası (resources) · Materiallar (materials) · Testlər (tests). */

const TABS = [
  { href: "/psycholog/resources", label: "Bilik bazası" },
  { href: "/psycholog/materials", label: "Materiallar" },
  { href: "/psycholog/tests",     label: "Testlər" },
] as const;

export default function PsychResourceTabs() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="Resurslar"
      style={{
        display: "flex",
        gap: 4,
        background: "#fff",
        border: "1px solid var(--brand-100)",
        borderRadius: 12,
        padding: 4,
        width: "fit-content",
        maxWidth: "100%",
        overflowX: "auto",
      }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              background: active ? "var(--brand)" : "transparent",
              color: active ? "#fff" : "var(--oxford-60)",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
