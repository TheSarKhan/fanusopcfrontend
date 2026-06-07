"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  operatorApi,
  type OperatorSearchHit,
  type OperatorSearchResponse,
} from "@/lib/api";

const RECENT_KEY = "fanus.op.recentSearches";
const MAX_RECENTS = 6;

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch { return []; }
}

function pushRecent(q: string) {
  if (typeof window === "undefined") return;
  const t = q.trim();
  if (!t) return;
  const existing = readRecents().filter(x => x.toLowerCase() !== t.toLowerCase());
  const next = [t, ...existing].slice(0, MAX_RECENTS);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

const TYPE_META: Record<OperatorSearchHit["type"], { label: string; tone: string }> = {
  PATIENT:       { label: "Pasiyent",   tone: "brand" },
  PSYCHOLOGIST:  { label: "Psixoloq",   tone: "good" },
  APPOINTMENT:   { label: "Randevu",    tone: "warn" },
};

export default function OperatorCommandPalette({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OperatorSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state on open + load recents.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults(null);
    setActiveIdx(0);
    setRecents(readRecents());
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const t = q.trim();
    if (t.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = window.setTimeout(() => {
      operatorApi.search(t, 6)
        .then(r => { setResults(r); setActiveIdx(0); })
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(id);
  }, [q, open]);

  const flat = useMemo(() => {
    if (!results) return [] as OperatorSearchHit[];
    return [...results.patients, ...results.psychologists, ...results.appointments];
  }, [results]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (flat.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx(i => (i + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(i => (i - 1 + flat.length) % flat.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const hit = flat[activeIdx];
        if (hit) navigate(hit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, activeIdx, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (hit: OperatorSearchHit) => {
    pushRecent(q);
    onClose();
    router.push(hit.href);
  };

  if (!open) return null;

  const showRecents = q.trim().length < 2;

  return (
    <div className="opcp-overlay" onClick={onClose}>
      <div className="opcp" onClick={e => e.stopPropagation()}>
        <div className="opcp__head">
          <svg className="opcp__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Pasiyent, psixoloq, randevu axtar…"
            className="opcp__input"
            autoComplete="off"
          />
          <kbd className="opcp__esc">Esc</kbd>
        </div>

        <div className="opcp__body">
          {loading && q.trim().length >= 2 && (
            <div className="opcp__loading">Axtarılır…</div>
          )}

          {showRecents && (
            <>
              {recents.length > 0 ? (
                <Group title="Son axtarışlar">
                  <div className="opcp__recents">
                    {recents.map(r => (
                      <button key={r} className="opcp__recent" onClick={() => setQ(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                </Group>
              ) : (
                <div className="opcp__hint">
                  Başlamaq üçün ən azı 2 simvol yazın. Pasiyent adı / telefon / email / randevu ID-si işləyir.
                </div>
              )}
              <KeyboardHints />
            </>
          )}

          {!showRecents && results && !loading && (
            <>
              {flat.length === 0 ? (
                <div className="opcp__empty">
                  <div className="opcp__empty-title">Heç nə tapılmadı</div>
                  <div className="opcp__empty-body">«{q.trim()}» üçün uyğun nəticə yoxdur.</div>
                </div>
              ) : (
                <>
                  {results.patients.length > 0 && (
                    <Group title="Pasiyentlər" count={results.patients.length}>
                      {results.patients.map(h => (
                        <HitRow key={`p-${h.id}`} h={h}
                          active={flat.indexOf(h) === activeIdx}
                          onClick={() => navigate(h)} />
                      ))}
                    </Group>
                  )}
                  {results.psychologists.length > 0 && (
                    <Group title="Psixoloqlar" count={results.psychologists.length}>
                      {results.psychologists.map(h => (
                        <HitRow key={`y-${h.id}`} h={h}
                          active={flat.indexOf(h) === activeIdx}
                          onClick={() => navigate(h)} />
                      ))}
                    </Group>
                  )}
                  {results.appointments.length > 0 && (
                    <Group title="Randevular" count={results.appointments.length}>
                      {results.appointments.map(h => (
                        <HitRow key={`a-${h.id}`} h={h}
                          active={flat.indexOf(h) === activeIdx}
                          onClick={() => navigate(h)} />
                      ))}
                    </Group>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="opcp__group">
      <div className="opcp__group-title">
        {title}
        {count != null && <span>{count}</span>}
      </div>
      {children}
    </div>
  );
}

function HitRow({
  h, active, onClick,
}: {
  h: OperatorSearchHit;
  active: boolean;
  onClick: () => void;
}) {
  const meta = TYPE_META[h.type];
  return (
    <button
      className={`opcp__row${active ? " is-active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => { /* hover-to-focus is done via active prop from parent */ }}>
      <span className="opcp__type" data-tone={meta.tone}>{meta.label}</span>
      <span className="opcp__text">
        <span className="opcp__title">{h.title}</span>
        {h.subtitle && <span className="opcp__subtitle">{h.subtitle}</span>}
      </span>
      <span className="opcp__arrow">↵</span>
    </button>
  );
}

function KeyboardHints() {
  return (
    <div className="opcp__hints">
      <span><kbd>↑</kbd><kbd>↓</kbd> seç</span>
      <span><kbd>↵</kbd> aç</span>
      <span><kbd>Esc</kbd> bağla</span>
    </div>
  );
}
