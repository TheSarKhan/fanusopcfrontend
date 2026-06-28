"use client";

/**
 * Fanus custom date / datetime picker.
 *
 * Platforma boyu istifadə üçün vahid seçici (native <input type="date" |
 * "datetime-local"> əvəzi). Göstərmə standartı: **gg.aa.iiii** (və withTime
 * ilə gg.aa.iiii ss:dd). Dəyər formatı native input ilə eynidir ki, drop-in
 * əvəz olsun:
 *   • date     →  "yyyy-mm-dd"
 *   • datetime →  "yyyy-mm-ddTHH:mm"
 *
 * Vizual referans: tünd panel + qızılı aksent (şəkildəki kimi). `theme="light"`
 * ilə açıq/brend mavi formalarda da istifadə oluna bilər.
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

/* ─── Lokal adlar (Azərbaycan, bazar ertəsi ilə başlayan həftə) ───────────── */

const AZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
// Bazar ertəsindən başlayır — şəkildəki başlıqla eyni.
const AZ_WEEKDAYS = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];

/* ─── Tip ─────────────────────────────────────────────────────────────────── */

export interface DatePickerProps {
  /** "yyyy-mm-dd" (date) və ya "yyyy-mm-ddTHH:mm" (withTime). Boş = seçilməyib. */
  value: string;
  onChange: (value: string) => void;
  /** Vaxt sətrini də göstər (datetime-local rejimi). */
  withTime?: boolean;
  /** Alt/üst hədd — value ilə eyni formatda. */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Sahənin içində təmizlə (×) düyməsi göstər. */
  clearable?: boolean;
  /** Klaviatura ilə əl yazısına icazə (default true). false → yalnız təqvim. */
  allowType?: boolean;
  /** "gold" (default, şəkildəki tünd/qızılı) və ya "light" (brend mavi). */
  theme?: "gold" | "light";
  size?: "sm" | "md";
  id?: string;
  name?: string;
  ariaLabel?: string;
  className?: string;
  /** Tetik sahəsinə əlavə stil. */
  style?: React.CSSProperties;
  /** Popup (təqvim) z-index. Modal içindəki istifadə üçün modal z-index-dən yüksək seçin. */
  popupZIndex?: number;
}

/* ─── Köməkçi funksiyalar ─────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Parts { y: number; mo: number; d: number; hh: number; mm: number; }

/** Canonical dəyəri (yyyy-mm-dd[THH:mm]) parçalara ayırır. */
function parseValue(value: string): Parts | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], hh: m[4] ? +m[4] : 0, mm: m[5] ? +m[5] : 0 };
}

function toValue(p: Parts, withTime: boolean): string {
  const date = `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`;
  return withTime ? `${date}T${pad2(p.hh)}:${pad2(p.mm)}` : date;
}

/** Göstərmə: gg.aa.iiii [ss:dd] */
function formatDisplay(value: string, withTime: boolean): string {
  const p = parseValue(value);
  if (!p) return "";
  const date = `${pad2(p.d)}.${pad2(p.mo)}.${p.y}`;
  return withTime ? `${date} ${pad2(p.hh)}:${pad2(p.mm)}` : date;
}

/** İstifadəçi yazısından (gg.aa.iiii [ss:dd]) canonical dəyər çıxarır. */
function parseDisplay(text: string, withTime: boolean): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(
    /^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?$/
  );
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const hh = m[4] ? +m[4] : 0, mm = m[5] ? +m[5] : 0;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  if (hh > 23 || mm > 59) return null;
  return toValue({ y, mo, d, hh, mm }, withTime);
}

function daysInMonth(y: number, mo: number): number {
  return new Date(y, mo, 0).getDate();
}
/** Ayın 1-inin həftə günü, bazar ertəsi = 0. */
function firstWeekdayMon(y: number, mo: number): number {
  return (new Date(y, mo - 1, 1).getDay() + 6) % 7;
}
/** Müqayisə üçün sayısal açar (gün dəqiqliyi). */
function dayKey(y: number, mo: number, d: number): number {
  return y * 10000 + mo * 100 + d;
}

/* ─── Tema palitrası ──────────────────────────────────────────────────────── */

interface Palette {
  panelBg: string; panelBorder: string; shadow: string;
  fieldBg: string; fieldBorder: string; fieldBorderFocus: string;
  text: string; textDim: string; textFaint: string;
  accent: string; accentGrad: string; onAccent: string;
  dayHover: string; todayRing: string;
}

function palette(theme: "gold" | "light"): Palette {
  if (theme === "light") {
    return {
      panelBg: "#ffffff", panelBorder: "#E4ECFA",
      shadow: "0 18px 50px rgba(8, 22, 49, 0.18)",
      fieldBg: "#ffffff", fieldBorder: "#E4ECFA", fieldBorderFocus: "#1051B7",
      text: "#0A1A33", textDim: "#5C6B85", textFaint: "#9DB0CC",
      accent: "#1051B7", accentGrad: "linear-gradient(180deg, #2A6BD0 0%, #1051B7 100%)",
      onAccent: "#ffffff",
      dayHover: "#F2F6FD", todayRing: "#C3D6F6",
    };
  }
  // gold — şəkildəki tünd/qızılı referans
  return {
    panelBg: "#1c1b19", panelBorder: "#34322d",
    shadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
    fieldBg: "#161512", fieldBorder: "#36332d", fieldBorderFocus: "#c9a24b",
    text: "#ece8df", textDim: "#9a9487", textFaint: "#6f6a5f",
    accent: "#c9a24b", accentGrad: "linear-gradient(180deg, #d6b257 0%, #b1862c 100%)",
    onAccent: "#1a1710",
    dayHover: "#2a2823", todayRing: "#5a5343",
  };
}

/* ─── Komponent ───────────────────────────────────────────────────────────── */

export default function DatePicker({
  value,
  onChange,
  withTime = false,
  min,
  max,
  placeholder,
  disabled = false,
  clearable = false,
  allowType = true,
  theme = "gold",
  size = "md",
  id,
  name,
  ariaLabel,
  className,
  style,
  popupZIndex = 9999,
}: DatePickerProps) {
  const autoId = useId();
  const fieldId = id ?? `dp-${autoId}`;
  const safeId = autoId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dayClass = `fanus-dp-day-${safeId}`;
  const popupId = `fanus-dp-pop-${safeId}`;
  const pal = useMemo(() => palette(theme), [theme]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState(() => formatDisplay(value, withTime));
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = useMemo(() => parseValue(value), [value]);
  const minP = useMemo(() => (min ? parseValue(min) : null), [min]);
  const maxP = useMemo(() => (max ? parseValue(max) : null), [max]);

  // Baxılan ay (view) — seçilmiş, yoxsa bugün.
  const [view, setView] = useState(() => {
    const p = selected ?? parseValue(min ?? "") ?? null;
    const base = p ?? nowParts();
    return { y: base.y, mo: base.mo };
  });

  useEffect(() => setMounted(true), []);

  // Xarici dəyər dəyişəndə (sahə fokuslu deyilsə) mətni sinxronla.
  useEffect(() => {
    if (!focused) setText(formatDisplay(value, withTime));
  }, [value, withTime, focused]);

  // Açılanda baxılan ayı seçilmiş dəyərə gətir.
  useEffect(() => {
    if (!open) return;
    const p = selected ?? minP ?? nowParts();
    setView({ y: p.y, mo: p.mo });
  }, [open, selected, minP]);

  /* — Mövqe hesablanması (portal, position:fixed) — */
  const reposition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 290);
    const estH = withTime ? 414 : 348;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = r.left;
    let top = r.bottom + 6;
    if (top + estH > vh - 8 && r.top - estH - 6 > 8) top = r.top - estH - 6;
    left = clamp(left, 8, Math.max(8, vw - width - 8));
    setPos({ top, left, width });
  }, [withTime]);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

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

  /* — Seçim köməkçiləri — */
  const commit = useCallback(
    (p: Parts) => onChange(toValue(p, withTime)),
    [onChange, withTime]
  );

  const isDayDisabled = useCallback(
    (y: number, mo: number, d: number) => {
      const k = dayKey(y, mo, d);
      if (minP && k < dayKey(minP.y, minP.mo, minP.d)) return true;
      if (maxP && k > dayKey(maxP.y, maxP.mo, maxP.d)) return true;
      return false;
    },
    [minP, maxP]
  );

  const pickDay = (d: number) => {
    if (isDayDisabled(view.y, view.mo, d)) return;
    const base = selected ?? nowParts();
    const next: Parts = {
      y: view.y, mo: view.mo, d,
      hh: withTime ? base.hh : 0,
      mm: withTime ? base.mm : 0,
    };
    commit(next);
    setText(formatDisplay(toValue(next, withTime), withTime));
    if (!withTime) setOpen(false); // date rejimi: dərhal bağla
  };

  const setTime = (hh: number, mm: number) => {
    const base = selected ?? { ...nowParts() };
    commit({ y: base.y, mo: base.mo, d: base.d, hh, mm });
  };

  const stepMonth = (delta: number) => {
    setView(v => {
      const idx = v.mo - 1 + delta;
      const y = v.y + Math.floor(idx / 12);
      const mo = ((idx % 12) + 12) % 12 + 1;
      return { y, mo };
    });
  };

  const clear = () => { onChange(""); setText(""); };

  /* — Sahə (tetik) hadisələri — */
  const onInputChange = (raw: string) => {
    setText(raw);
    const parsed = parseDisplay(raw, withTime);
    if (parsed) {
      const p = parseValue(parsed)!;
      setView({ y: p.y, mo: p.mo });
      onChange(parsed);
    }
  };
  const onInputBlur = () => {
    setFocused(false);
    const parsed = parseDisplay(text, withTime);
    if (parsed) { onChange(parsed); setText(formatDisplay(parsed, withTime)); }
    else setText(formatDisplay(value, withTime)); // etibarsız → geri qaytar
  };

  /* — Ölçü — */
  const padY = size === "sm" ? 8 : 11;
  const padX = size === "sm" ? 10 : 13;
  const fontSize = size === "sm" ? 13 : 14;

  const display = formatDisplay(value, withTime);
  const ph = placeholder ?? (withTime ? "gg.aa.iiii ss:dd" : "gg.aa.iiii");

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
          // ikona/sahə klikində təqvimi aç, fokusu sahəyə ver.
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
          <IconCalendar />
        </span>
      </div>

      {open && mounted && pos && createPortal(
        <div
          ref={popupRef}
          id={popupId}
          role="dialog"
          aria-label="Tarix seçici"
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: pos.width,
            zIndex: popupZIndex,
            background: pal.panelBg,
            border: `1px solid ${pal.panelBorder}`,
            borderRadius: 14,
            boxShadow: pal.shadow,
            padding: 14,
            boxSizing: "border-box",
            animation: "fanus-dp-pop .14s ease-out",
          }}
        >
          {/* Başlıq: ay naviqasiyası */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" title="Əvvəlki ay"
              onClick={() => stepMonth(-1)} style={navBtn(pal)}>
              <IconChevronLeft />
            </button>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: pal.text, letterSpacing: 0.2 }}>
              {AZ_MONTHS[view.mo - 1]} {view.y}
            </div>
            <button type="button" title="Növbəti ay"
              onClick={() => stepMonth(1)} style={navBtn(pal)}>
              <IconChevronRight />
            </button>
          </div>

          {/* Həftə günləri */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {AZ_WEEKDAYS.map((w, i) => (
              <div key={w} style={{
                textAlign: "center", fontSize: 11, fontWeight: 600,
                color: i === 6 ? pal.accent : pal.textDim,
                padding: "4px 0",
              }}>{w}</div>
            ))}
          </div>

          {/* Günlər */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: firstWeekdayMon(view.y, view.mo) }).map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth(view.y, view.mo) }).map((_, i) => {
              const d = i + 1;
              const isSel = !!selected && selected.y === view.y && selected.mo === view.mo && selected.d === d;
              const isToday = isSameDayAsToday(view.y, view.mo, d);
              const disabledDay = isDayDisabled(view.y, view.mo, d);
              const weekendSun = (firstWeekdayMon(view.y, view.mo) + i) % 7 === 6;
              return (
                <button key={d} type="button"
                  disabled={disabledDay}
                  onClick={() => pickDay(d)}
                  className={dayClass}
                  style={{
                    aspectRatio: "1 / 1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "none", borderRadius: 9,
                    background: isSel ? undefined : "transparent",
                    backgroundImage: isSel ? pal.accentGrad : "none",
                    color: disabledDay ? pal.textFaint
                      : isSel ? pal.onAccent
                      : weekendSun ? pal.accent : pal.text,
                    opacity: disabledDay ? 0.35 : 1,
                    fontSize: 13, fontWeight: isSel ? 700 : 500,
                    cursor: disabledDay ? "not-allowed" : "pointer",
                    boxShadow: isToday && !isSel ? `inset 0 0 0 1.5px ${pal.todayRing}` : "none",
                    transition: "background .12s, color .12s",
                  }}
                >{d}</button>
              );
            })}
          </div>

          {/* Vaxt sətri + Hazır (yalnız withTime) */}
          {withTime && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginTop: 12, paddingTop: 12,
              borderTop: `1px solid ${pal.panelBorder}`,
            }}>
              <span style={{ color: pal.textDim, display: "inline-flex" }}><IconClock /></span>
              <TimeBox pal={pal} value={selected?.hh ?? 0} max={23}
                onCommit={(hh) => setTime(hh, selected?.mm ?? 0)} ariaLabel="Saat" />
              <span style={{ color: pal.textDim, fontWeight: 700 }}>:</span>
              <TimeBox pal={pal} value={selected?.mm ?? 0} max={59}
                onCommit={(mm) => setTime(selected?.hh ?? 0, mm)} ariaLabel="Dəqiqə" />
              <div style={{ flex: 1 }} />
              <button type="button"
                onClick={() => { setOpen(false); inputRef.current?.blur(); }}
                style={{
                  padding: "8px 18px", borderRadius: 9, border: "none",
                  backgroundImage: pal.accentGrad, color: pal.onAccent,
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                Hazır
              </button>
            </div>
          )}

          <style>{`
            @keyframes fanus-dp-pop {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .${dayClass}:not(:disabled):hover { background: ${pal.dayHover} !important; }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── Vaxt qutusu ─────────────────────────────────────────────────────────── */

function TimeBox({ pal, value, max, onCommit, ariaLabel }: {
  pal: Palette; value: number; max: number; onCommit: (n: number) => void; ariaLabel: string;
}) {
  const [text, setText] = useState(pad2(value));
  const focusedRef = useRef(false);
  useEffect(() => { if (!focusedRef.current) setText(pad2(value)); }, [value]);

  const commit = (raw: string) => {
    const n = clamp(parseInt(raw || "0", 10) || 0, 0, max);
    onCommit(n);
    setText(pad2(n));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={text}
      onFocus={(e) => { focusedRef.current = true; e.currentTarget.select(); }}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
        setText(v);
        if (v.length === 2) {
          const n = clamp(parseInt(v, 10) || 0, 0, max);
          onCommit(n);
        }
      }}
      onBlur={(e) => { focusedRef.current = false; commit(e.target.value); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const cur = clamp(parseInt(text || "0", 10) || 0, 0, max);
          const next = clamp(cur + (e.key === "ArrowUp" ? 1 : -1), 0, max);
          setText(pad2(next)); onCommit(next);
        }
      }}
      style={{
        width: 44, textAlign: "center",
        background: pal.fieldBg, border: `1.5px solid ${pal.panelBorder}`,
        borderRadius: 8, padding: "7px 4px",
        color: pal.text, fontSize: 14, fontWeight: 600,
        outline: "none",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
      }}
      onFocusCapture={(e) => (e.currentTarget.style.borderColor = pal.accent)}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = pal.panelBorder)}
    />
  );
}

/* ─── Kiçik köməkçilər ────────────────────────────────────────────────────── */

function nowParts(): Parts {
  const d = new Date();
  return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
}
function isSameDayAsToday(y: number, mo: number, d: number): boolean {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() + 1 === mo && t.getDate() === d;
}

/** #rrggbb + alpha → rgba(). */
function withAlpha(hex: string, a: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function navBtn(pal: Palette): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "none", color: pal.textDim,
    cursor: "pointer",
  };
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
function IconCalendar() {
  return (<svg width="16" height="16" {...sw}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>);
}
function IconClock() {
  return (<svg width="16" height="16" {...sw}>
    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
  </svg>);
}
function IconChevronLeft() {
  return (<svg width="18" height="18" {...sw}><polyline points="15 18 9 12 15 6" /></svg>);
}
function IconChevronRight() {
  return (<svg width="18" height="18" {...sw}><polyline points="9 18 15 12 9 6" /></svg>);
}
function IconX() {
  return (<svg width="14" height="14" {...sw}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
}
