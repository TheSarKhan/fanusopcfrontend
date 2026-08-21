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
  deco,
  illustration,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Başlığın solunda və ya yanında göstərilən soft botanik/abstrakt illüstrasiya */
  deco?: React.ReactNode;
  illustration?: React.ReactNode;
}) {
  const visualDeco = deco ?? illustration;
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
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: visualDeco ? 16 : 0 }}>
        {visualDeco ? <div style={{ flexShrink: 0 }}>{visualDeco}</div> : null}
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
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
