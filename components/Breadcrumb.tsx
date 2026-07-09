import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Sadə, sayt boyu ortaq breadcrumb: "Fanus / Xidmətlər" tərzində. Son element cari səhifədir (link deyil).
 * `bare`: sətri öz `.fanus-container`-i olmadan render edir — özünün fərqli en/padding sistemi olan
 * səhifələr (məs. inline-style ilə qurulmuş profil səhifələri) onu artıq mövcud konteynerin içinə qoysun.
 */
export default function Breadcrumb({ items, bare = false }: { items: BreadcrumbItem[]; bare?: boolean }) {
  const trail = (
    <>
      <Link href="/">Fanus</Link>
      {items.map((item, i) => (
        <span className="fanus-crumb__item" key={i}>
          <span className="fanus-crumb__sep" aria-hidden>/</span>
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span className="fanus-crumb__current">{item.label}</span>}
        </span>
      ))}
    </>
  );

  return (
    <nav className={`fanus-crumb${bare ? " fanus-crumb--bare" : ""}`} aria-label="breadcrumb">
      {bare ? (
        <div className="fanus-crumb__inner">{trail}</div>
      ) : (
        <div className="fanus-container fanus-crumb__inner">{trail}</div>
      )}

      <style>{`
        .fanus-crumb { padding: 20px 0 0; }
        .fanus-crumb--bare { padding: 0; }
        .fanus-crumb__inner {
          display: flex; align-items: center; flex-wrap: wrap;
          font-size: 13.5px; color: var(--fanus-ink-3);
        }
        .fanus-crumb__inner > a { color: var(--fanus-ink-3); transition: color .15s; }
        .fanus-crumb__inner > a:hover { color: var(--fanus-primary); }
        .fanus-crumb__item { display: inline-flex; align-items: center; }
        .fanus-crumb__sep { margin: 0 8px; opacity: .6; }
        .fanus-crumb__item a { color: var(--fanus-ink-3); transition: color .15s; }
        .fanus-crumb__item a:hover { color: var(--fanus-primary); }
        .fanus-crumb__current { color: var(--fanus-ink); font-weight: 600; }
      `}</style>
    </nav>
  );
}
