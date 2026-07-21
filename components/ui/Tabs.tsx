import type { ReactNode } from "react";

export type TabItem<T extends string = string> = {
  key: T;
  label: ReactNode;
  /** Sətir sayı — rozet deyil, sadə neytral rəqəmdir. */
  count?: number;
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={["fx-tabs", className].filter(Boolean).join(" ")} role="tablist">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={["fx-tab", active ? "fx-tab--active" : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(it.key)}
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span className={["fx-pill--count", active ? "fx-pill--count-active" : ""].filter(Boolean).join(" ")}>
                {it.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Gün / Həftə / Ay tipli dar keçid. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly { key: T; label: ReactNode }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={["fx-segmented", className].filter(Boolean).join(" ")}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={it.key === value}
          className={it.key === value ? "fx-seg--active" : ""}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Filtr keçidi ("Yalnız mənim"). */
export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={["fx-toggle-chip", active ? "fx-toggle-chip--active" : ""].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
