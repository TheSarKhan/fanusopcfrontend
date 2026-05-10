"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getPsychologistAvailability,
  getPsychologists,
  patientApi,
  type AvailableSlot,
  type Psychologist,
} from "@/lib/api";
import { buildPanelUrl, getStoredUser } from "@/lib/auth";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const isoDow = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_AZ[isoDow]} · ${fmtDate(iso)}`;
}
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
}

export default function BookPsychologistPage() {
  const { t } = useT();
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const rawSlug = decodeURIComponent(params.slug ?? "");

  const [psychologist, setPsychologist] = useState<(Psychologist & { slug: string }) | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<AvailableSlot | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [appointmentsUrl, setAppointmentsUrl] = useState("/patient/appointments");

  // Recurring booking
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [totalCount, setTotalCount] = useState<number>(4);
  const [seriesResult, setSeriesResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    setAppointmentsUrl(`${buildPanelUrl("PATIENT")}/appointments`);
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/book/${rawSlug}`)}`);
      return;
    }
    if (user.role !== "PATIENT") {
      setError("Yalnız pasiyent hesabı ilə müraciət edə bilərsiniz");
    }
  }, [rawSlug, router]);

  useEffect(() => {
    setLoading(true);
    getPsychologists()
      .then((list) => {
        const withSlug = withSlugs(list);
        const numeric = Number(rawSlug);
        let match: (Psychologist & { slug: string }) | undefined;
        if (Number.isFinite(numeric)) {
          match = withSlug.find(p => p.id === numeric);
          if (match && match.slug !== rawSlug) {
            router.replace(`/book/${match.slug}`);
            return;
          }
        }
        if (!match) match = withSlug.find(p => p.slug === rawSlug);
        if (!match) {
          setError("Psixoloq tapılmadı");
          setLoading(false);
          return;
        }
        setPsychologist(match);
        const today = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 21);
        getPsychologistAvailability(match.id, isoDateOnly(today), isoDateOnly(to))
          .then(setSlots)
          .catch(() => setSlots([]))
          .finally(() => setLoading(false));
      })
      .catch(() => {
        setError("Məlumatları yükləmək alınmadı");
        setLoading(false);
      });
  }, [rawSlug, router]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = dayKey(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  useEffect(() => {
    if (!activeDayKey && grouped.length > 0) setActiveDayKey(grouped[0][0]);
  }, [grouped, activeDayKey]);

  const activeSlots = useMemo(
    () => grouped.find(([k]) => k === activeDayKey)?.[1] ?? [],
    [grouped, activeDayKey],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!psychologist) return;
    if (note.trim().length < 5) {
      setError(t("book.errorNoteShort"));
      return;
    }
    if (recurring && !pickedSlot) {
      setError(t("book.errorMissingSlot"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        note: note.trim(),
        requestedPsychologistId: psychologist.id,
        requestedStartAt: pickedSlot ? pickedSlot.startAt : null,
      };
      if (recurring && pickedSlot) {
        const series = await patientApi.createBookingSeries({
          firstBooking: payload,
          frequency,
          totalCount,
        });
        setSeriesResult({ created: series.createdAppointments, skipped: series.skippedOccurrences });
      } else {
        await patientApi.book(payload);
      }
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Müraciət göndərilərkən xəta baş verdi");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="bk-page">
        <div className="bk-success">
          <div className="bk-success-icon" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1>{seriesResult ? t("book.recurringSuccessTitle") : t("book.successTitle")}</h1>
          {seriesResult ? (
            <p>
              {seriesResult.skipped > 0
                ? t("book.recurringSuccessBodyWithSkipped", { created: seriesResult.created, skipped: seriesResult.skipped })
                : t("book.recurringSuccessBody", { created: seriesResult.created })}
            </p>
          ) : (
            <p>{t("book.successBody")}</p>
          )}
          <div className="bk-success-actions">
            <a className="bk-btn bk-btn-primary" href={appointmentsUrl}>{t("book.successCta")}</a>
            <a className="bk-btn bk-btn-ghost" href="/psychologists">{t("book.backToList")}</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bk-page">
      <div className="bk-shell">
        <a href={`/psychologists/${rawSlug}`} className="bk-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t("common.back")}
        </a>

        {loading ? (
          <div className="bk-card bk-card-loading">{t("common.loading")}</div>
        ) : !psychologist ? (
          <div className="bk-card bk-card-error">{error ?? "Psixoloq tapılmadı."}</div>
        ) : (
          <div className="bk-grid">
            <aside className="bk-aside">
              <div className="bk-aside-card">
                <div className="bk-avatar">
                  {psychologist.photoUrl ? (
                    <Image
                      src={psychologist.photoUrl}
                      alt={psychologist.name}
                      width={88}
                      height={88}
                      unoptimized
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>{initials(psychologist.name)}</span>
                  )}
                </div>
                <h2 className="bk-name">{psychologist.name}</h2>
                <p className="bk-title">{psychologist.title}</p>
                {psychologist.specializations && psychologist.specializations.length > 0 && (
                  <div className="bk-tags">
                    {psychologist.specializations.slice(0, 4).map(t => (
                      <span key={t} className="bk-tag">{t}</span>
                    ))}
                  </div>
                )}
                <div className="bk-aside-meta">
                  <div>
                    <span>Seans müddəti</span>
                    <strong>{psychologist.defaultSessionMinutes ?? 50} dəq</strong>
                  </div>
                  <div>
                    <span>Format</span>
                    <strong>Onlayn (video)</strong>
                  </div>
                </div>
              </div>

              <ol className="bk-steps">
                <li><span>1</span>Vaxt seçin</li>
                <li><span>2</span>Qısa qeyd</li>
                <li><span>3</span>Operator təsdiqi</li>
              </ol>
            </aside>

            <form onSubmit={onSubmit} className="bk-form">
              <header className="bk-form-head">
                <p className="bk-eyebrow">{t("book.title")}</p>
                <h1>{t("book.subtitle")}</h1>
                <p className="bk-form-sub">{t("book.submitBlurb")}</p>
              </header>

              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>{t("book.timeSection")}</h3>
                  {pickedSlot && (
                    <span className="bk-pill bk-pill-brand">
                      {dayLabel(pickedSlot.startAt)}, {fmtTime(pickedSlot.startAt)}
                    </span>
                  )}
                </div>

                {grouped.length === 0 ? (
                  <div className="bk-empty">{t("book.noSlots")}</div>
                ) : (
                  <>
                    <div className="bk-day-tabs" role="tablist">
                      {grouped.map(([k, daySlots]) => {
                        const active = k === activeDayKey;
                        return (
                          <button
                            type="button"
                            key={k}
                            role="tab"
                            aria-selected={active}
                            className={`bk-day-tab${active ? " is-active" : ""}`}
                            onClick={() => setActiveDayKey(k)}
                          >
                            {dayLabel(daySlots[0].startAt)}
                            <small>{daySlots.length} vaxt</small>
                          </button>
                        );
                      })}
                    </div>

                    <div className="bk-slots">
                      {activeSlots.map(s => {
                        const active = pickedSlot?.startAt === s.startAt;
                        return (
                          <button
                            type="button"
                            key={s.startAt}
                            className={`bk-slot${active ? " is-active" : ""}`}
                            onClick={() => setPickedSlot(active ? null : s)}
                          >
                            {fmtTime(s.startAt)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>{t("book.noteSection")}</h3>
                </div>
                <textarea
                  rows={4}
                  className="bk-textarea"
                  placeholder={t("book.notePlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="bk-hint">{t("book.noteHint")}</p>
              </section>

              <section className="bk-section bk-recurring">
                <label className="bk-recurring-toggle">
                  <input type="checkbox" checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)} />
                  <div>
                    <strong>{t("book.recurringTitle")}</strong>
                    <small>{t("book.recurringSub")}</small>
                  </div>
                </label>
                {recurring && (
                  <div className="bk-recurring-opts">
                    <label>
                      <span>{t("book.recurringFreq")}</span>
                      <select value={frequency} onChange={(e) => setFrequency(e.target.value as "WEEKLY"|"BIWEEKLY")}>
                        <option value="WEEKLY">{t("book.recurringWeekly")}</option>
                        <option value="BIWEEKLY">{t("book.recurringBiweekly")}</option>
                      </select>
                    </label>
                    <label>
                      <span>{t("book.recurringCount")}</span>
                      <input
                        type="number" min={2} max={12}
                        value={totalCount}
                        onChange={(e) => setTotalCount(Math.max(2, Math.min(12, Number(e.target.value) || 4)))}
                      />
                    </label>
                    <p className="bk-recurring-hint">
                      {t("book.recurringHint", {
                        first: pickedSlot ? `${dayLabel(pickedSlot.startAt)}, ${fmtTime(pickedSlot.startAt)}` : "—",
                        freq: frequency === "WEEKLY" ? t("book.recurringWeekly").toLowerCase() : t("book.recurringBiweekly").toLowerCase(),
                      })}
                    </p>
                  </div>
                )}
              </section>

              {error && <div className="bk-error">{error}</div>}

              <div className="bk-actions">
                <button type="button" className="bk-btn bk-btn-ghost" onClick={() => router.back()}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="bk-btn bk-btn-primary" disabled={submitting}>
                  {submitting ? t("common.sending") : t("book.submitCta")}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
