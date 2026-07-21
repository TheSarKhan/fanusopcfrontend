"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Banner, EmptyBlock } from "./Feedback";
import { Pagination } from "./Table";

/**
 * FANUS DATATABLE — platformadakı BÜTÜN cədvəllər üçün vahid komponent.
 *
 * Əl ilə <table> yazmaq QADAĞANDIR. Sıralama, səhifələmə, yüklənmə skeleti,
 * boş və xəta vəziyyətləri buradadır — səhifə yalnız sütunları təsvir edir.
 *
 * Bilərəkdən DAXİL EDİLMƏYİB (heç bir cədvəl işlətmir):
 *   • checkbox / toplu seçim   • sticky başlıq
 * Lazım olanda kitə əlavə edilir, səhifədə yox.
 *
 * Axtarış/filtr sahələri cədvəlin ÜSTÜNDƏ, səhifənin öz alətlər zolağında qalır —
 * onların yerləşməsi hər ekranda fərqlidir, ona görə komponentə salınmayıb.
 */

export type SortDir = "asc" | "desc";
export type SortState<K extends string = string> = { key: K; dir: SortDir };

export type Column<T> = {
  /** Sütunun açarı — sıralama və React key üçün. */
  key: string;
  /** Başlıq. Cümlə formasında yazın — UPPERCASE DEYİL. */
  header: ReactNode;
  /** Xanadakı məzmun. Avatar, <Status>, link — nə lazımdırsa. */
  cell: (row: T) => ReactNode;
  /** Rəqəm sütunu: sağa yaslanır və tabular olur. */
  numeric?: boolean;
  /** Bu sütuna görə sıralamağa icazə ver. */
  sortable?: boolean;
  /**
   * Daxili (client-side) sıralama üçün müqayisə dəyəri.
   * `onSortChange` verilibsə sıralama serverdədir və bu işlədilmir.
   */
  sortValue?: (row: T) => string | number;
  /** Kart görünüşündə etiket (yalnız `header` mətn deyilsə lazımdır). */
  label?: string;
  /** Dar ekranda (kart görünüşü) bu sütunu gizlət. */
  hideOnMobile?: boolean;
  width?: number | string;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;

  /** Yüklənir — skeleton göstərilir, "Yüklənir…" mətni YOX. */
  loading?: boolean;
  /** Yükləmə xətası — yerində qutu + təkrar cəhd (bu hal toast-a getmir). */
  error?: string | null;
  onRetry?: () => void;
  /** Sətir yoxdursa göstərilən blok. Səbəbi izah edin, quru "Məlumat yoxdur" yazmayın. */
  empty?: { title: string; body?: string; actions?: ReactNode };

  /** Sətrə klik — detal səhifəsi və ya drawer. */
  onRowClick?: (row: T) => void;
  /** Sonuncu sütundakı əməliyyat düymələri. Klik sətrə ötürülmür. */
  actions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;

  /**
   * Sıralama. `onSortChange` verilsə idarə olunan (server) rejimdir;
   * verilməsə komponent özü `sortValue` ilə client-side sıralayır.
   */
  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;
  defaultSort?: SortState;

  /** Səhifələmə (server və ya client — səhifə özü qərar verir). */
  pagination?: {
    page: number;
    pageCount: number;
    onChange: (page: number) => void;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
  };
  /** "Daha çox göstər" — səhifələmənin əvəzinə. */
  loadMore?: { onClick: () => void; remaining: number; loading?: boolean };
  /** Alt sətirdə göstərilən nəticə sayı mətni. */
  totalLabel?: ReactNode;

  /** Açılan detal sətri. Qaytarılan dəyər bütün sütunları tutan sətirdə göstərilir. */
  renderExpanded?: (row: T) => ReactNode;

  /** Dar ekran davranışı: sürüşdür (default) və ya kartlara çevir. */
  mobile?: "scroll" | "cards";
  /** Bu endən dar olanda üfüqi sürüşmə başlayır. */
  minWidth?: number;
  /** Yüklənmə skeletində göstəriləcək sətir sayı. */
  skeletonRows?: number;
};

function Caret({ dir }: { dir: SortDir | null }) {
  return (
    <svg className="fx-dt__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "asc" ? <path d="m6 15 6-6 6 6" /> : dir === "desc" ? <path d="m6 9 6 6 6-6" /> : <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />}
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Kart görünüşündəki etiket — `label`, yoxsa mətn `header`. */
function labelOf<T>(col: Column<T>): string {
  if (col.label != null) return col.label;
  return typeof col.header === "string" ? col.header : "";
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  empty,
  onRowClick,
  actions,
  actionsHeader,
  sort,
  onSortChange,
  defaultSort,
  pagination,
  loadMore,
  totalLabel,
  renderExpanded,
  mobile = "scroll",
  minWidth,
  skeletonRows = 5,
}: DataTableProps<T>) {
  // Sıralama serverdədirsə (onSortChange verilib) daxili vəziyyət işlədilmir.
  const controlled = typeof onSortChange === "function";
  const [innerSort, setInnerSort] = useState<SortState | null>(defaultSort ?? null);
  const activeSort = controlled ? (sort ?? null) : innerSort;

  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const toggleExpanded = (key: string | number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSort = (key: string) => {
    const dir: SortDir = activeSort?.key === key && activeSort.dir === "asc" ? "desc" : "asc";
    if (controlled) onSortChange!({ key, dir });
    else setInnerSort({ key, dir });
  };

  // Client-side sıralama — yalnız idarə olunmayan rejimdə.
  const sorted = useMemo(() => {
    if (controlled || !activeSort) return rows;
    const col = columns.find(c => c.key === activeSort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const factor = activeSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "az") * factor;
    });
  }, [rows, columns, activeSort, controlled]);

  const colSpan = columns.length + (actions ? 1 : 0) + (renderExpanded ? 1 : 0);

  // ── Xəta: səhifə yüklənmədiyi üçün toast deyil, yerində qutu ──
  if (error) {
    return (
      <Banner tone="error" title="Məlumat yüklənmədi">
        {error}
        {onRetry && (
          <div style={{ marginTop: 10 }}>
            <Button variant="ghost" size="sm" onClick={onRetry}>Yenidən cəhd et</Button>
          </div>
        )}
      </Banner>
    );
  }

  // ── Yüklənmə: skeleton, "Yüklənir…" mətni yox ──
  if (loading) {
    return (
      <div className="fx-dt-wrap">
        <table className="fx-dt" style={minWidth ? { minWidth } : undefined}>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: colSpan || 4 }).map((__, c) => (
                  <td key={c}>
                    <div className="fx-skeleton" style={{ height: 13, width: c === 0 ? "60%" : "40%" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Boş ──
  if (sorted.length === 0) {
    return (
      <EmptyBlock
        title={empty?.title ?? "Nəticə tapılmadı"}
        body={empty?.body ?? "Seçilmiş filtrlərə uyğun qeyd yoxdur. Filtrləri dəyişib yenidən yoxlayın."}
        actions={empty?.actions}
      />
    );
  }

  return (
    <>
      <div className="fx-dt-wrap">
        <table
          className={["fx-dt", mobile === "cards" ? "fx-dt--cards" : ""].filter(Boolean).join(" ")}
          style={minWidth ? { minWidth } : undefined}
        >
          <thead>
            <tr>
              {renderExpanded && <th style={{ width: 40 }} aria-label="Detalları aç" />}
              {columns.map(col => {
                const isSorted = activeSort?.key === col.key;
                const canSort = col.sortable && (controlled || !!col.sortValue);
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={[col.numeric ? "fx-dt__num" : "", col.hideOnMobile ? "fx-dt__hide-mobile" : ""].filter(Boolean).join(" ")}
                    aria-sort={canSort ? (isSorted ? (activeSort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                  >
                    {canSort ? (
                      <button type="button" className="fx-dt__sort" onClick={() => handleSort(col.key)}>
                        {col.header}
                        <Caret dir={isSorted ? activeSort!.dir : null} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {actions && <th className="fx-dt__actions-cell">{actionsHeader ?? <span className="fx-dt__hide-mobile">&nbsp;</span>}</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const key = rowKey(row);
              const isOpen = expanded.has(key);
              return (
                <Fragment key={key}>
                  <tr
                    className={onRowClick ? "fx-dt__row--link" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {renderExpanded && (
                      <td data-label="">
                        <button
                          type="button"
                          className="fx-dt__expander"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Detalları bağla" : "Detalları aç"}
                          onClick={e => { e.stopPropagation(); toggleExpanded(key); }}
                        >
                          <ChevronRight />
                        </button>
                      </td>
                    )}
                    {columns.map(col => (
                      <td
                        key={col.key}
                        data-label={labelOf(col)}
                        className={[col.numeric ? "fx-dt__num" : "", col.hideOnMobile ? "fx-dt__hide-mobile" : ""].filter(Boolean).join(" ")}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                    {actions && (
                      // Əməliyyat düymələri sətir klikini tetikləməməlidir.
                      <td className="fx-dt__actions-cell" data-label="" onClick={e => e.stopPropagation()}>
                        <div className="fx-dt__actions">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                  {renderExpanded && isOpen && (
                    <tr className="fx-dt__expanded">
                      <td colSpan={colSpan} data-label="">{renderExpanded(row)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {(totalLabel || pagination || loadMore) && (
        <div className="fx-dt__foot">
          <span className="fx-dt__count">{totalLabel}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {pagination?.onPageSizeChange && (
              <label className="fx-dt__count" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Səhifədə
                <select
                  className="fx-select fx-select--inline"
                  value={pagination.pageSize}
                  onChange={e => pagination.onPageSizeChange!(Number(e.target.value))}
                >
                  {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            {pagination && (
              <Pagination page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.onChange} />
            )}
            {loadMore && loadMore.remaining > 0 && (
              <Button variant="ghost" size="sm" onClick={loadMore.onClick} disabled={loadMore.loading}>
                {loadMore.loading ? "Yüklənir…" : `Daha çox göstər (+${loadMore.remaining})`}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
