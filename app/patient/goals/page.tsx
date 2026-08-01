"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { patientApi, type PatientGoalStatus, type PatientGoalView } from "@/lib/api";
import { FEATURE_GOALS } from "@/lib/features";
import PageHeader from "@/components/PageHeader";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { azFormatDate } from "@/lib/datetime";

const STATUS_META: Record<PatientGoalStatus, { labelKey: MessageKey; bg: string; fg: string; border: string }> = {
  OPEN:        { labelKey: "patGoals.statusOpen",       bg: "var(--brand-50)", fg: "var(--brand-700)", border: "var(--brand-100)" },
  IN_PROGRESS: { labelKey: "patGoals.statusInProgress", bg: "#FEF3C7",         fg: "#92400E",         border: "#FDE68A" },
  ACHIEVED:    { labelKey: "patGoals.statusAchieved",   bg: "#D1FAE5",         fg: "#065F46",         border: "#A7F3D0" },
  ABANDONED:   { labelKey: "patGoals.statusAbandoned",  bg: "#F3F4F6",         fg: "#374151",         border: "#E5E7EB" },
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const PAGE_SIZE = 30;

export default function PatientGoalsPage() {
  // Goals MVP-dən gizlədilib — flag açıq deyilsə birbaşa URL ilə də açılmasın.
  if (!FEATURE_GOALS) notFound();

  const { t } = useT();
  const [goals, setGoals] = useState<PatientGoalView[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    patientApi.goalsPaged({ page: 0, size: PAGE_SIZE })
      .then(res => {
        setGoals(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = () => {
    setLoadingMore(true);
    patientApi.goalsPaged({ page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setGoals(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = goals.length < totalElements;

  const grouped = useMemo(() => {
    const active = goals.filter(g => g.status === "OPEN" || g.status === "IN_PROGRESS");
    const done = goals.filter(g => g.status === "ACHIEVED");
    const abandoned = goals.filter(g => g.status === "ABANDONED");
    return { active, done, abandoned };
  }, [goals]);

  return (
    <div className="pgoals">
      <PageHeader title={t("patGoals.title")} subtitle={t("patGoals.sub")} />

      {loading ? (
        <div className="pgoals__loading">{t("common.loading")}</div>
      ) : err ? (
        <div className="pgoals__error">{err}</div>
      ) : goals.length === 0 ? (
        <div className="pgoals__empty">
          <div className="pgoals__empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div className="pgoals__empty-title">{t("patGoals.emptyTitle")}</div>
          <p className="pgoals__empty-body">
            {t("patGoals.emptyBody")}
          </p>
          <Link href="/patient/appointments" className="pgoals__empty-cta">{t("patTests.emptyCta")}</Link>
        </div>
      ) : (
        <>
          {grouped.active.length > 0 && (
            <Section title={t("patGoals.secActive")} count={grouped.active.length}>
              {grouped.active.map(g => (
                <GoalCard key={g.id} g={g} editable onUpdated={(u) => setGoals(prev => prev.map(x => x.id === u.id ? u : x))} />
              ))}
            </Section>
          )}
          {grouped.done.length > 0 && (
            <Section title={t("patGoals.secAchieved")} count={grouped.done.length}>
              {grouped.done.map(g => <GoalCard key={g.id} g={g} />)}
            </Section>
          )}
          {grouped.abandoned.length > 0 && (
            <Section title={t("patGoals.secAbandoned")} count={grouped.abandoned.length}>
              {grouped.abandoned.map(g => <GoalCard key={g.id} g={g} />)}
            </Section>
          )}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? t("common.loading") : t("pat.loadMore", { n: Math.min(PAGE_SIZE, totalElements - goals.length) })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="pgoals__section">
      <div className="pgoals__section-head">
        <h2>{title}</h2>
        <span className="pgoals__section-n">{count}</span>
      </div>
      <div className="pgoals__list">{children}</div>
    </section>
  );
}

function GoalCard({
  g, editable, onUpdated,
}: {
  g: PatientGoalView;
  editable?: boolean;
  onUpdated?: (u: PatientGoalView) => void;
}) {
  const { t } = useT();
  const [now] = useState(() => Date.now());
  const meta = STATUS_META[g.status];
  const overdue = g.targetDate && (g.status === "OPEN" || g.status === "IN_PROGRESS")
    && new Date(g.targetDate + "T23:59:59").getTime() < now;

  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(g.progressPct);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = await patientApi.updateGoalProgress(g.id, progress, note.trim() || null);
      onUpdated?.(saved);
      setEditing(false);
      setNote("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="pgoal-card">
      <div className="pgoal-card__top">
        <div className="pgoal-card__title">{g.title}</div>
        <span className="pgoal-card__status"
          style={{ background: meta.bg, color: meta.fg, borderColor: meta.border }}>
          {t(meta.labelKey)}
        </span>
      </div>

      {g.description && <div className="pgoal-card__desc">{g.description}</div>}

      <div className="pgoal-card__psy">
        <div className="pgoal-card__psy-avatar">{initials(g.psychologistName)}</div>
        <div className="pgoal-card__psy-info">
          <strong>{g.psychologistName ?? t("pat.yourPsy")}</strong>
          <span>{t("patGoals.assignedBy")}</span>
        </div>
      </div>

      <div className="pgoal-card__progress">
        <div className="pgoal-card__progress-bar">
          <div className="pgoal-card__progress-fill" style={{ width: `${g.progressPct}%` }} />
        </div>
        <span className="pgoal-card__progress-val">{g.progressPct}%</span>
      </div>

      <div className="pgoal-card__meta">
        {g.targetDate && (
          <span className={`pgoal-card__date${overdue ? " is-overdue" : ""}`}>
            {t("patGoals.targetDate", { date: azFormatDate(g.targetDate) })}
          </span>
        )}
        {/* gecikmə ayrıca sətir elementi — meta sıra flex gap ilə ayırır */}
        {g.targetDate && overdue && (
          <span style={{ color: "#991B1B", fontWeight: 700 }}>{t("patGoals.overdue")}</span>
        )}
        {g.achievedAt && (
          <span style={{ color: "#065F46", fontWeight: 600 }}>{t("patGoals.achievedAt", { date: azFormatDate(g.achievedAt) })}</span>
        )}
        {editable && !editing && (
          <button onClick={() => { setEditing(true); setProgress(g.progressPct); setErr(null); }}
            className="pgoal-card__action">
            {t("patGoals.addProgress")}
          </button>
        )}
      </div>

      {editable && editing && (
        <div className="pgoal-card__editor">
          <div className="pgoal-card__editor-row">
            <label>
              {t("patGoals.progressLabel")} <strong>{progress}%</strong>
            </label>
            <input type="range" min={0} max={100} step={5}
              value={progress} onChange={e => setProgress(Number(e.target.value))} />
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={2} maxLength={500}
            placeholder={t("patGoals.notePh")}
            className="pgoal-card__editor-note" />
          {err && <div className="pgoal-card__editor-err">{err}</div>}
          <div className="pgoal-card__editor-actions">
            <button onClick={() => setEditing(false)} className="pgoal-card__btn pgoal-card__btn--ghost">
              {t("patGoals.cancelShort")}
            </button>
            <button onClick={save} disabled={saving} className="pgoal-card__btn pgoal-card__btn--primary">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
