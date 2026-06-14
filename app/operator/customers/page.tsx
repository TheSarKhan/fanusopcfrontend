"use client";

// Modul H — müştəri axtarış landing-i. operatorApi.search ilə pasiyent hitlərini
// göstərir, hər biri /operator/customers/{patientId} profilinə keçir.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { operatorApi, type OperatorSearchHit } from "@/lib/api";

export default function OperatorCustomersPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OperatorSearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  // Debounced axtarış — yalnız pasiyent hitləri lazımdır.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = window.setTimeout(() => {
      operatorApi.search(term, 12)
        .then(r => setHits(r.patients))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(id);
  }, [q]);

  const term = q.trim();

  return (
    <div className="op-analytics">
      <header className="op-analytics__head">
        <div>
          <h1>Müştərilər</h1>
          <p>Pasiyentin 360° profilini açmaq üçün ad, telefon və ya email ilə axtarın</p>
        </div>
      </header>

      {/* Axtarış qutusu */}
      <div className="op-card">
        <div className="op-card__body" style={{ paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oxford-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Pasiyent adı / telefon / email…"
              autoComplete="off"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "var(--oxford)", background: "transparent" }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            {term.length < 2 ? (
              <div className="op-empty">Başlamaq üçün ən azı 2 simvol yazın.</div>
            ) : loading ? (
              <div className="op-empty">Axtarılır…</div>
            ) : !hits || hits.length === 0 ? (
              <div className="op-empty">«{term}» üçün uyğun müştəri tapılmadı.</div>
            ) : (
              <div className="op-list">
                {hits.map(h => (
                  <Link key={h.id} href={`/operator/customers/${h.id}`} className="op-row" style={{ textDecoration: "none" }}>
                    <div className="op-row__avatar" data-tone="brand">{initials(h.title)}</div>
                    <div className="op-row__main">
                      <div className="op-row__name">{h.title}</div>
                      {h.subtitle && <div className="op-row__meta"><span>{h.subtitle}</span></div>}
                    </div>
                    <span style={{ color: "var(--oxford-40)", fontSize: 16, flexShrink: 0 }}>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}
