import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Cədvəl sarğısı — dar ekranda cədvəl ÖZÜ sürüşür, səhifə gövdəsi yox.
 */
export function TableWrap({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["fx-table-wrap", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={["fx-table", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </table>
  );
}

/** Başlıq xanası. Mətn cümlə formasındadır — UPPERCASE deyil. */
export function Th({
  numeric,
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={className}
      style={numeric ? { textAlign: "right", ...rest.style } : rest.style}
      {...rest}
    >
      {children}
    </th>
  );
}

/** Data xanası. `numeric` tabular rəqəm + sağa yaslama verir. */
export function Td({
  numeric,
  className,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td className={[numeric ? "fx-td-num" : "", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </td>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  // Cari səhifənin ətrafında maksimum 5 nömrə göstərilir.
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <nav className={["fx-pagination", className].filter(Boolean).join(" ")} aria-label="Səhifələmə">
      <button
        type="button"
        className="fx-page-btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Əvvəlki səhifə"
      >
        <svg className="fx-icon fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={["fx-page-btn", p === page ? "fx-page-btn--active" : ""].filter(Boolean).join(" ")}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="fx-page-btn"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="Növbəti səhifə"
      >
        <svg className="fx-icon fx-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </nav>
  );
}

/** Cədvəl yüklənərkən — "Yüklənir…" mətni yox, skeleton sətirlər. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <TableWrap>
      <Table>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c} style={{ padding: "12px 16px" }}>
                  <div className="fx-skeleton" style={{ height: 13, width: c === 0 ? "60%" : "40%" }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
