import type React from "react";

/**
 * Panel modul başlığı — bütün panellərdə (pasiyent / psixoloq / operator) vahid
 * layout: solda böyük modul adı + altında açıqlama, sağda əməliyyatlar (axtarış,
 * düymələr və s.). Nümunə: pasiyent "Psixoloqlar" səhifəsi.
 *
 *   <PageHeader title="Psixoloqlar" subtitle="Sizə uyğun psixoloqu tapın…"
 *     actions={<button>…</button>} />
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)", lineHeight: 1.15 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 15, color: "var(--oxford-60)", fontWeight: 500, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
