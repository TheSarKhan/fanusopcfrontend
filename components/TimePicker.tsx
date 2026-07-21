"use client";

/**
 * Fanus custom time picker — 24 saatlıq, platforma boyu vahid.
 *
 * Native <input type="time"> brauzer/OS lokalına görə 12/24 dəyişir (18 → 6 PM
 * problemi). Bu komponent həmişə 24 saatlıq rejimdə işləyir: "18" yazanda 18
 * qalır. Dəyər formatı native input ilə eynidir ki, drop-in əvəz olsun:
 *   • value  →  "HH:MM"  (məs. "09:00", "18:30"), boş = seçilməyib.
 *
 * Vizual referans: DatePicker ilə eyni tema (gold / light).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* ─── Tip ─────────────────────────────────────────────────────────────────── */

export interface TimePickerProps {
  /** "HH:MM" (24 saatlıq). Boş = seçilməyib. */
  value: string;
  onChange: (value: string) => void;
  /** Dəqiqə addımı (popup siyahısı üçün). Default 5. */
  minuteStep?: number;
  /** Ən erkən seçilə bilən vaxt "HH:MM" — daha erkən saatlar sönük və klikləməz.
   *  Məs. bu gün üçün müraciət formasında keçmiş saatları bağlamaq üçün. */
  min?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Sahənin içində təmizlə (×) düyməsi göstər. */
  clearable?: boolean;
  /** Klaviatura ilə əl yazısına icazə (default true). false → yalnız siyahı. */
  allowType?: boolean;
  /** "gold" (tünd/qızılı) və ya "light" (brend mavi, default). */
  theme?: "gold" | "light";
  size?: "sm" | "md";
  id?: string;
  name?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Popup z-index. Modal içində modal z-index-dən yüksək seçin. Default 9999. */
  popupZIndex?: number;
}

/* ─── Köməkçi funksiyalar ─────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface TimeParts { hh: number; mm: number; }

/** "HH:MM" → parçalar. */
function parseValue(value: string): TimeParts | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  if (hh > 23 || mm > 59) return null;
  return { hh, mm };
}

function toValue(p: TimeParts): string {
  return `${pad2(p.hh)}:${pad2(p.mm)}`;
}

function formatDisplay(value: string): string {
  const p = parseValue(value);
  return p ? toValue(p) : "";
}

/**
 * İstifadəçi yazısından 24 saatlıq dəyər çıxarır.
 * Qaydalar: 1–2 rəqəm = saat (məs "18" → 18:00); 3–4 rəqəm = HHMM (məs "1830"
 * → 18:30); ":" də qəbul olunur. Saat 0–23, dəqiqə 0–59 hədddə kəsilir.
 */
function parseDisplay(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const colon = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const hh = clamp(+colon[1], 0, 23);
    const mm = clamp(+colon[2], 0, 59);
    return toValue({ hh, mm });
  }
  const digits = t.replace(/\D/g, "");
  if (!digits) return null;
  let hh: number, mm: number;
  if (digits.length <= 2) { hh = +digits; mm = 0; }
  else { hh = +digits.slice(0, 2); mm = +digits.slice(2, 4); }
  return toValue({ hh: clamp(hh, 0, 23), mm: clamp(mm, 0, 59) });
}

/* ─── Tema palitrası (DatePicker ilə eyni) ────────────────────────────────── */

interface Palette {
  panelBg: string; panelBorder: string; shadow: string;
  fieldBg: string; fieldBorder: string; fieldBorderFocus: string;
  text: string; textDim: string; textFaint: string;
  accent: string; accentGrad: string; onAccent: string;
  itemHover: string;
}

function palette(theme: "gold" | "light"): Palette {
  if (theme === "gold") {
    return {
      panelBg: "#1c1b19", panelBorder: "#34322d",
      shadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
      fieldBg: "#161512", fieldBorder: "#36332d", fieldBorderFocus: "#c9a24b",
      text: "#ece8df", textDim: "#9a9487", textFaint: "#6f6a5f",
      accent: "#c9a24b", accentGrad: "linear-gradient(180deg, #d6b257 0%, #b1862c 100%)",
      onAccent: "#1a1710",
      itemHover: "#2a2823",
    };
  }
  // light — brend mavi (default)
  return {
    panelBg: "#ffffff", panelBorder: "#E4ECFA",
    shadow: "0 18px 50px rgba(8, 22, 49, 0.18)",
    fieldBg: "#ffffff", fieldBorder: "#E4ECFA", fieldBorderFocus: "#1051B7",
    text: "#0A1A33", textDim: "#5C6B85", textFaint: "#9DB0CC",
    accent: "#1051B7", accentGrad: "linear-gradient(180deg, #2A6BD0 0%, #1051B7 100%)",
    onAccent: "#ffffff",
    itemHover: "#F2F6FD",
  };
}

/* ─── Komponent ───────────────────────────────────────────────────────────── */

export default function TimePicker({
  value,
  onChange,
  minuteStep = 5,
  min,
  placeholder,
  disabled = false,
  clearable = false,
  allowType = true,
  theme = "light",
  size = "md",
  id,
  name,
  ariaLabel,
  className,
  style,
  popupZIndex = 9999,
}: TimePickerProps) {
  const autoId = useId();
  const fieldId = id ?? `tp-${autoId}`;
  const safeId = autoId.replace(/[^a-zA-Z0-9_-]/g, "");
  const itemClass = `fanus-tp-item-${safeId}`;
  const popupId = `fanus-tp-pop-${safeId}`;
  const pal = useMemo(() => palette(theme), [theme]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const hourColRef = useRef<HTMLDivElement | null>(null);
  const minColRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState(() => formatDisplay(value));
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = useMemo(() => parseValue(value), [value]);
  const minP = useMemo(() => (min ? parseValue(min) : null), [min]);

  /** Verilmiş saat tamamilə hədddən aşağıdırsa (bütün dəqiqələri keçib) sönükdür. */
  const hourDisabled = useCallback(
    (hh: number) => minP != null && hh < minP.hh,
    [minP],
  );
  /** Seçilmiş saat həddin saatıdırsa, ondan əvvəlki dəqiqələr sönükdür. */
  const minuteDisabled = useCallback(
    (mm: number) => minP != null && (selected?.hh ?? minP.hh) === minP.hh && mm < minP.mm,
    [minP, selected],
  );

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const step = clamp(minuteStep || 5, 1, 60);
    const out: number[] = [];
    for (let m = 0; m < 60; m += step) out.push(m);
    return out;
  }, [minuteStep]);

  useEffect(() => setMounted(true), []);

  // Xarici dəyər dəyişəndə (sahə fokuslu deyilsə) mətni sinxronla.
  useEffect(() => {
    if (!focused) setText(formatDisplay(value));
  }, [value, focused]);

  /* — Mövqe hesablanması (portal, position:fixed) — */
  const reposition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 150);
    const estH = 232;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = r.left;
    let top = r.bottom + 6;
    if (top + estH > vh - 8 && r.top - estH - 6 > 8) top = r.top - estH - 6;
    left = clamp(left, 8, Math.max(8, vw - width - 8));
    setPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = (e: Event) => {
      // Popup-un öz sütun scroll-u repozisiyanı tetikləməməlidir — əks halda
      // mərkəzləmə yenidən işləyir və skroll seçili dəyərə geri atılır.
      const t = e.target as Node | null;
      if (t && popupRef.current?.contains(t)) return;
      reposition();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

  // Açılanda seçili saat/dəqiqəni görünüşə sürüşdür — yalnız BİR DƏFƏ
  // (sonrakı pos dəyişiklikləri istifadəçi skrollunu pozmamalıdır).
  const didCenterRef = useRef(false);
  useEffect(() => {
    if (!open) { didCenterRef.current = false; return; }
    if (!pos || didCenterRef.current) return;
    didCenterRef.current = true;
    const id = window.requestAnimationFrame(() => {
      const scrollToSel = (col: HTMLDivElement | null) => {
        if (!col) return;
        const sel = col.querySelector<HTMLElement>("[data-sel='1']");
        if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2;
      };
      scrollToSel(hourColRef.current);
      scrollToSel(minColRef.current);
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, pos]);

  /* — Bayır klik + Escape ilə bağlama — */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popupRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* — Seçim köməkçiləri —
     Popup seçim tamamlananda ÖZÜ bağlanır. Qayda: hər iki hissə (saat + dəqiqə)
     məlum olan kimi bağlanır — yəni popup açılanda dəyər artıq var idisə bir klik,
     boşdursa hər iki sütundan birər klik kifayətdir. Əks halda istifadəçi seçimi
     edib qalırdı və paneli əl ilə bağlamalı olurdu. */
  const pickedRef = useRef({ h: false, m: false });
  const hadValueRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      pickedRef.current = { h: false, m: false };
      hadValueRef.current = parseValue(value) != null;
    }
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
    // `value` qəsdən asılılıqda deyil — yalnız açılış anındakı vəziyyət lazımdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Seçim göz önündə qalsın deyə qısa gecikmə ilə bağla. */
  const finishPick = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      inputRef.current?.blur();
    }, 160);
  };

  const pickHour = (hh: number) => {
    if (hourDisabled(hh)) return;
    // Hədd saatına keçəndə dəqiqə də hədddən aşağı qalmasın.
    let mm = selected?.mm ?? 0;
    if (minP && hh === minP.hh && mm < minP.mm) mm = minP.mm;
    const next = { hh, mm };
    onChange(toValue(next));
    setText(toValue(next));
    pickedRef.current.h = true;
    if (hadValueRef.current || pickedRef.current.m) finishPick();
  };
  const pickMinute = (mm: number) => {
    if (minuteDisabled(mm)) return;
    const next = { hh: selected?.hh ?? minP?.hh ?? 0, mm };
    onChange(toValue(next));
    setText(toValue(next));
    pickedRef.current.m = true;
    if (hadValueRef.current || pickedRef.current.h) finishPick();
  };

  const clear = () => { onChange(""); setText(""); };

  /* — Sahə (tetik) hadisələri — */
  const onInputChange = (raw: string) => {
    // yalnız rəqəm və ":" saxla, max 5 simvol (HH:MM)
    const cleaned = raw.replace(/[^\d:]/g, "").slice(0, 5);
    setText(cleaned);
    const parsed = parseDisplay(cleaned);
    if (parsed) onChange(parsed);
  };
  const onInputBlur = () => {
    setFocused(false);
    const parsed = parseDisplay(text);
    if (parsed) { onChange(parsed); setText(formatDisplay(parsed)); }
    else setText(formatDisplay(value)); // etibarsız → geri qaytar
  };

  /* — Ölçü — */
  const padY = size === "sm" ? 8 : 11;
  const padX = size === "sm" ? 10 : 13;
  const fontSize = size === "sm" ? 13 : 14;

  const display = formatDisplay(value);
  const ph = placeholder ?? "ss:dd";

  return (
    <div ref={wrapRef} className={className}
      style={{ position: "relative", width: "100%", ...style }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: pal.fieldBg,
          border: `1.5px solid ${(focused || open) ? pal.fieldBorderFocus : pal.fieldBorder}`,
          borderRadius: 10,
          padding: `${padY}px ${padX}px`,
          boxShadow: (focused || open) ? `0 0 0 3px ${withAlpha(pal.fieldBorderFocus, 0.18)}` : "none",
          transition: "border-color .15s, box-shadow .15s",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "text",
          boxSizing: "border-box",
        }}
        onMouseDown={(e) => {
          if (disabled) return;
          if (e.target !== inputRef.current) {
            e.preventDefault();
            inputRef.current?.focus();
          }
          setOpen(true);
        }}
      >
        <input
          ref={inputRef}
          id={fieldId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          readOnly={!allowType}
          aria-label={ariaLabel}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popupId}
          value={text}
          placeholder={ph}
          onChange={(e) => allowType && onInputChange(e.target.value)}
          onFocus={() => { setFocused(true); if (!disabled) setOpen(true); }}
          onBlur={onInputBlur}
          style={{
            flex: 1, minWidth: 0,
            background: "transparent", border: "none", outline: "none",
            color: display || text ? pal.text : pal.textFaint,
            fontSize, fontWeight: 500, letterSpacing: 0.2,
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
            cursor: disabled ? "not-allowed" : (allowType ? "text" : "pointer"),
            padding: 0,
          }}
        />
        {clearable && (display || text) && !disabled && (
          <button type="button" tabIndex={-1} title="Təmizlə"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clear(); }}
            style={iconBtn(pal.textDim)}>
            <IconX />
          </button>
        )}
        <span style={{ color: (focused || open) ? pal.accent : pal.textDim, display: "inline-flex", flexShrink: 0 }}>
          <IconClock />
        </span>
      </div>

      {open && mounted && pos && createPortal(
        <div
          ref={popupRef}
          id={popupId}
          role="dialog"
          aria-label="Saat seçici"
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: pos.width,
            zIndex: popupZIndex,
            background: pal.panelBg,
            border: `1px solid ${pal.panelBorder}`,
            borderRadius: 14,
            boxShadow: pal.shadow,
            padding: 10,
            boxSizing: "border-box",
            animation: "fanus-tp-pop .14s ease-out",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {/* Saat sütunu */}
            <Column
              colRef={hourColRef}
              label="Saat"
              items={hours}
              selectedVal={selected?.hh}
              onPick={pickHour}
              isDisabled={hourDisabled}
              pal={pal}
              itemClass={itemClass}
            />
            <div style={{ width: 1, background: pal.panelBorder, alignSelf: "stretch" }} />
            {/* Dəqiqə sütunu */}
            <Column
              colRef={minColRef}
              label="Dəqiqə"
              items={minutes}
              selectedVal={selected?.mm}
              onPick={pickMinute}
              isDisabled={minuteDisabled}
              pal={pal}
              itemClass={itemClass}
            />
          </div>

          <style>{`
            @keyframes fanus-tp-pop {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .${itemClass}::-webkit-scrollbar { width: 6px; }
            .${itemClass}::-webkit-scrollbar-thumb { background: ${pal.panelBorder}; border-radius: 3px; }
            .${itemClass}-btn:not([data-sel='1']):hover { background: ${pal.itemHover} !important; }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── Sütun ───────────────────────────────────────────────────────────────── */

function Column({ colRef, label, items, selectedVal, onPick, isDisabled, pal, itemClass }: {
  colRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  items: number[];
  selectedVal: number | undefined;
  onPick: (n: number) => void;
  isDisabled?: (n: number) => boolean;
  pal: Palette;
  itemClass: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        textAlign: "center", fontSize: 11, fontWeight: 600,
        color: pal.textDim, padding: "2px 0 6px",
      }}>{label}</div>
      <div
        ref={colRef}
        className={itemClass}
        style={{
          maxHeight: 176, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 2,
          scrollbarWidth: "thin",
        }}
      >
        {items.map(n => {
          const isSel = selectedVal === n;
          const off = isDisabled?.(n) ?? false;
          return (
            <button
              key={n}
              type="button"
              data-sel={isSel ? "1" : "0"}
              disabled={off}
              title={off ? "Bu vaxt artıq keçib" : undefined}
              onClick={() => onPick(n)}
              className={`${itemClass}-btn`}
              style={{
                border: "none", borderRadius: 8,
                padding: "7px 0",
                background: isSel ? undefined : "transparent",
                backgroundImage: isSel ? pal.accentGrad : "none",
                color: off ? pal.textFaint : (isSel ? pal.onAccent : pal.text),
                fontSize: 13.5, fontWeight: isSel ? 700 : 500,
                cursor: off ? "not-allowed" : "pointer",
                opacity: off ? 0.5 : 1,
                textDecoration: off ? "line-through" : "none",
                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                transition: "background .12s, color .12s",
              }}
            >{pad2(n)}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Kiçik köməkçilər ────────────────────────────────────────────────────── */

/** #rrggbb + alpha → rgba(). */
function withAlpha(hex: string, a: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function iconBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 20, height: 20, borderRadius: 5,
    background: "transparent", border: "none", color, cursor: "pointer", flexShrink: 0,
  };
}

/* ─── İkonlar ─────────────────────────────────────────────────────────────── */

const sw = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};
function IconClock() {
  return (<svg width="16" height="16" {...sw}>
    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
  </svg>);
}
function IconX() {
  return (<svg width="14" height="14" {...sw}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
}
