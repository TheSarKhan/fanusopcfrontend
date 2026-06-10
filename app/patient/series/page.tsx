"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { patientApi, type BookingSeries } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

type TFunction = ReturnType<typeof useT>["t"];

function fmtDate(s: string | null | undefined, locale: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString(
      locale === "az" ? "az-AZ" : locale === "ru" ? "ru-RU" : "en-GB",
      { day: "2-digit", month: "short", year: "numeric" }
    );
  } catch { return s; }
}

function initials(name?: string | null): string {
  if (!name) return "P";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "P";
}

type SeriesState = "active" | "cancel-pending" | "cancelled";

function stateOf(s: BookingSeries): SeriesState {
  if (s.cancelledAt) return "cancelled";
  if (s.cancelRequestedAt) return "cancel-pending";
  return "active";
}

const STATE_META: Record<SeriesState, { label: string; bg: string; fg: string; border: string }> = {
  "active":         { label: "Aktiv",          bg: "#D1FAE5", fg: "#065F46", border: "#10B981" },
  "cancel-pending": { label: "Ləğv gözlənir",  bg: "#FEF3C7", fg: "#92400E", border: "#F59E0B" },
  "cancelled":      { label: "Ləğv edilib",    bg: "#FEE2E2", fg: "#991B1B", border: "#EF4444" },
};

export default function PatientSeriesPage() {
  const { t, locale } = useT();
  const [items, setItems] = useState<BookingSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [renewingId, setRenewingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    patientApi.myBookingSeries()
      .then(setItems)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = useMemo(() => {
    let total = 0, active = 0, sessions = 0, skipped = 0;
    for (const s of items) {
      total++;
      if (stateOf(s) === "active") active++;
      sessions += s.createdAppointments ?? 0;
      skipped += s.skippedOccurrences ?? 0;
    }
    return { total, active, sessions, skipped };
  }, [items]);

  const onCancel = async (id: number) => {
    if (!confirm(t("series.cancelRequestConfirm"))) return;
    setCancellingId(id);
    try {
      const updated = await patientApi.cancelBookingSeries(id);
      setItems(prev => prev.map(s => s.id === id ? updated : s));
      alert(t("series.cancelRequestSent"));
    } catch (e) { alert((e as Error).message); }
    finally { setCancellingId(null); }
  };

  const onExtend = async (id: number, count: number) => {
    setExtendingId(id);
    try {
      const updated = await patientApi.extendBookingSeries(id, count);
      setItems(prev => prev.map(s => s.id === id ? updated : s));
      alert(t("series.extendDone", { n: count }));
    } catch (e) { alert((e as Error).message); }
    finally { setExtendingId(null); }
  };

  // GAP-06: one-click renewal — same terms, next N occurrences.
  const onRenew = async (id: number, count: number) => {
    setRenewingId(id);
    try {
      const updated = await patientApi.extendBookingSeries(id, count);
      setItems(prev => prev.map(s => s.id === id ? updated : s));
      alert(`Seriya ${count} seans uzadıldı. Operator yeni vaxtları təsdiqləyəcək.`);
    } catch (e) { alert((e as Error).message); }
    finally { setRenewingId(null); }
  };

  return (
    <div className="pser">
      <header className="pser__head">
        <div>
          <h1>{t("series.pageTitle")}</h1>
          <p>{t("series.pageSub")}</p>
        </div>
      </header>

      {!loading && items.length > 0 && (
        <div className="pser__stats">
          <StatTile label="Cəmi seriya" value={stats.total} tone="brand" />
          <StatTile label="Aktiv" value={stats.active} tone="good" />
          <StatTile label="Yaranmış seans" value={stats.sessions} tone="brand" />
          <StatTile label="Atlanmış" value={stats.skipped} tone={stats.skipped > 0 ? "warn" : "muted"} />
        </div>
      )}

      {err && <div className="pser__error">{err}</div>}

      {loading ? (
        <div className="pser__loading">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="pser__empty">
          <div className="pser__empty-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </div>
          <div className="pser__empty-title">{t("series.empty")}</div>
          <p className="pser__empty-body">
            Davamlı rezerv edib hər həftə eyni vaxtda eyni psixoloqla seansa qoşula bilərsiniz.
          </p>
          <Link href="/patient/psychologists" className="pser__empty-cta">
            {t("series.emptyCta")}
          </Link>
        </div>
      ) : (
        <div className="pser__grid">
          {items.map(s => (
            <SeriesCard key={s.id}
              s={s}
              t={t}
              locale={locale}
              cancelling={cancellingId === s.id}
              extending={extendingId === s.id}
              renewing={renewingId === s.id}
              onCancel={() => onCancel(s.id)}
              onExtend={() => onExtend(s.id, s.skippedOccurrences)}
              onRenew={() => onRenew(s.id, Math.min(Math.max(s.totalCount ?? 4, 1), 12))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label, value, tone,
}: {
  label: string; value: number;
  tone: "brand" | "good" | "warn" | "muted";
}) {
  return (
    <div className="pser-stat" data-tone={tone}>
      <div className="pser-stat__val">{value}</div>
      <div className="pser-stat__label">{label}</div>
    </div>
  );
}

function SeriesCard({
  s, t, locale, cancelling, extending, renewing, onCancel, onExtend, onRenew,
}: {
  s: BookingSeries;
  t: TFunction;
  locale: string;
  cancelling: boolean;
  extending: boolean;
  renewing: boolean;
  onCancel: () => void;
  onExtend: () => void;
  onRenew: () => void;
}) {
  // GAP-06: renew with the same terms — same length again, capped at 12.
  const renewCount = Math.min(Math.max(s.totalCount ?? 4, 1), 12);
  const state = stateOf(s);
  const meta = STATE_META[state];
  const total = s.totalCount ?? 0;
  const created = s.createdAppointments ?? 0;
  const progressPct = total > 0 ? Math.round((created / total) * 100) : 0;
  const freqLabel = s.frequency === "WEEKLY" ? t("series.weekly") : t("series.biweekly");

  return (
    <article className="pser-card" data-state={state}
      style={{ borderLeftColor: meta.border }}>
      <div className="pser-card__head">
        <div className="pser-card__psy">
          <div className="pser-card__avatar">{initials(s.requestedPsychologistName)}</div>
          <div className="pser-card__psy-body">
            <div className="pser-card__psy-name">
              {s.requestedPsychologistName ?? t("series.noPsy")}
            </div>
            <div className="pser-card__freq">{freqLabel}</div>
          </div>
        </div>
        <span className="pser-card__state"
          style={{ background: meta.bg, color: meta.fg }}>
          {state === "cancelled" ? t("series.cancelledBadge")
            : state === "cancel-pending" ? t("series.cancelPendingBadge")
            : t("series.activeBadge")}
        </span>
      </div>

      <div className="pser-card__progress">
        <div className="pser-card__progress-row">
          <span className="pser-card__progress-label">
            {created} / {total} seans
          </span>
          <span className="pser-card__progress-val">{progressPct}%</span>
        </div>
        <div className="pser-card__bar">
          <div className="pser-card__bar-fill"
            style={{ width: `${progressPct}%`, background: meta.border }} />
        </div>
      </div>

      {s.skippedOccurrences > 0 && (
        <div className="pser-card__skipped">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <strong>{s.skippedOccurrences} atlanmış həftə</strong>
            <span>{t("series.skippedHint")}</span>
          </div>
        </div>
      )}

      <div className="pser-card__meta">
        {t("series.createdAt", { date: fmtDate(s.createdAt, locale) })}
      </div>

      {state === "cancel-pending" && (
        <div className="pser-card__alert pser-card__alert--warn">
          {t("series.cancelPendingHint")}
        </div>
      )}

      {state === "active" && (
        <div className="pser-card__actions">
          {s.skippedOccurrences > 0 && (
            <button
              type="button"
              onClick={onExtend}
              disabled={extending}
              className="pser-card__btn pser-card__btn--primary">
              {extending
                ? t("series.extending")
                : t("series.extendCta", { n: s.skippedOccurrences })}
            </button>
          )}
          {/* GAP-06: one-click renewal — same terms, next N sessions */}
          <button
            type="button"
            onClick={onRenew}
            disabled={renewing}
            className="pser-card__btn pser-card__btn--primary">
            {renewing ? "Uzadılır…" : `Davam et (+${renewCount} seans)`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="pser-card__btn pser-card__btn--ghost-danger">
            {t("series.cancelCta")}
          </button>
        </div>
      )}
    </article>
  );
}
