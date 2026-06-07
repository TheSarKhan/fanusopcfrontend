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
function fmtRange(startIso: string, minutes: number) {
  const s = new Date(startIso);
  const e = new Date(s.getTime() + minutes * 60_000);
  return `${fmtTime(startIso)}–${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
}
function timeOfDay(iso: string): "morning" | "afternoon" | "evening" {
  const h = new Date(iso).getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
const TOD_LABEL: Record<"morning" | "afternoon" | "evening", string> = {
  morning: "Səhər",
  afternoon: "Günorta",
  evening: "Axşam",
};

const NOTE_TEMPLATES: { key: string; label: string; body: string }[] = [
  {
    key: "first",
    label: "İlk müraciət",
    body: "Bu mənim ilk seansımdır. Son zamanlar [vəziyyəti qısa təsvir edin] yaşadığımı hiss edirəm. İlk növbədə bu mövzunu müzakirə etmək istəyirəm.",
  },
  {
    key: "continue",
    label: "Davam edən mövzu",
    body: "Əvvəlki seansda müzakirə etdiyimiz [mövzu] istiqamətində davam etmək istəyirəm. Bu həftə [müşahidələr / hisslər]…",
  },
  {
    key: "urgent",
    label: "Təcili",
    body: "Yaxın günlərdə kəskin stress / narahatlıq yaşayıram və mümkün qədər tez seans almaq istəyirəm. Mövzu: [qısaca].",
  },
];

function downloadIcs(opts: { uid: string; start: Date; end: Date; title: string; description: string }) {
  const toIcs = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fanus//AZ//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${toIcs(new Date())}`,
    `DTSTART:${toIcs(opts.start)}`,
    `DTEND:${toIcs(opts.end)}`,
    `SUMMARY:${opts.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fanus-seans.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
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
    const sessionMin = psychologist?.defaultSessionMinutes ?? 50;
    const handleIcsExport = () => {
      if (!pickedSlot || !psychologist) return;
      const start = new Date(pickedSlot.startAt);
      const end = new Date(start.getTime() + sessionMin * 60_000);
      downloadIcs({
        uid: `fanus-${Date.now()}@fanusopc.com`,
        start, end,
        title: `Seans · ${psychologist.name}`,
        description: `Psixoloq: ${psychologist.name}\nFanus platforması\n${note.slice(0, 240)}`,
      });
    };
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

          <div className="bk-success-sla">
            <strong>1 saat içində</strong> operator komandamız sizinlə əlaqə saxlayacaq.
          </div>

          <ol className="bk-success-steps">
            <li><span>1</span> Operator zəng edir / yazır</li>
            <li><span>2</span> Vaxt təsdiqlənir</li>
            <li><span>3</span> Seansın linki email/SMS ilə gəlir</li>
            <li><span>4</span> Seansa qoşulursunuz</li>
          </ol>

          <div className="bk-success-actions">
            <a className="bk-btn bk-btn-primary" href={appointmentsUrl}>{t("book.successCta")}</a>
            {pickedSlot && (
              <button type="button" className="bk-btn bk-btn-ghost" onClick={handleIcsExport}>
                Təqvimə əlavə et (.ics)
              </button>
            )}
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
                    <div className="bk-tz-hint">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      Bütün vaxtlar Asia/Baku zonası
                    </div>

                    <div className="bk-day-tabs" role="tablist">
                      {grouped.map(([k, daySlots], idx) => {
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
                            {idx === 0 && <span className="bk-day-tab__badge">Ən tez</span>}
                            {dayLabel(daySlots[0].startAt)}
                            <small>{daySlots.length} vaxt</small>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const sessionMin = psychologist.defaultSessionMinutes ?? 50;
                      const byTod: Record<"morning" | "afternoon" | "evening", AvailableSlot[]> = {
                        morning: [], afternoon: [], evening: [],
                      };
                      for (const s of activeSlots) byTod[timeOfDay(s.startAt)].push(s);
                      const groups = (["morning", "afternoon", "evening"] as const).filter(g => byTod[g].length > 0);
                      if (groups.length === 0) {
                        return (
                          <div className="bk-empty">
                            Bu gündə boş vaxt yoxdur.
                            {grouped.length > 1 && " Növbəti günü yoxlayın →"}
                          </div>
                        );
                      }
                      return (
                        <div className="bk-tod-stack">
                          {groups.map(g => (
                            <div key={g} className="bk-tod">
                              <div className="bk-tod__label">{TOD_LABEL[g]}</div>
                              <div className="bk-slots">
                                {byTod[g].map(s => {
                                  const active = pickedSlot?.startAt === s.startAt;
                                  return (
                                    <button
                                      type="button"
                                      key={s.startAt}
                                      className={`bk-slot${active ? " is-active" : ""}`}
                                      onClick={() => setPickedSlot(active ? null : s)}
                                      title={fmtRange(s.startAt, sessionMin)}
                                    >
                                      <span className="bk-slot__time">{fmtTime(s.startAt)}</span>
                                      <span className="bk-slot__range">{sessionMin} dəq</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </section>

              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>{t("book.noteSection")}</h3>
                </div>
                <div className="bk-note-templates">
                  {NOTE_TEMPLATES.map(tpl => (
                    <button key={tpl.key} type="button"
                      className="bk-note-template"
                      onClick={() => setNote(note ? note + "\n\n" + tpl.body : tpl.body)}>
                      + {tpl.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={4}
                  className="bk-textarea"
                  placeholder={t("book.notePlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="bk-note-foot">
                  <span className="bk-hint">{t("book.noteHint")}</span>
                  <span className={`bk-counter${note.trim().length >= 5 ? " is-ok" : ""}`}>
                    {note.trim().length >= 5 ? "✓ kifayətdir" : `${note.trim().length} / minimum 5`}
                  </span>
                </div>
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
                    <div>
                      <span>{t("book.recurringCount")}</span>
                      <div className="bk-recurring-presets">
                        {[2, 4, 6, 8].map(n => (
                          <button key={n} type="button"
                            className={`bk-recurring-preset${totalCount === n ? " is-active" : ""}`}
                            onClick={() => setTotalCount(n)}>
                            {n}
                          </button>
                        ))}
                        <input
                          type="number" min={2} max={12}
                          value={totalCount}
                          onChange={(e) => setTotalCount(Math.max(2, Math.min(12, Number(e.target.value) || 4)))}
                        />
                      </div>
                    </div>

                    {/* Live summary */}
                    {(() => {
                      if (!pickedSlot) {
                        return (
                          <p className="bk-recurring-hint">
                            Yekun planı görmək üçün yuxarıda vaxt seçin.
                          </p>
                        );
                      }
                      const step = frequency === "WEEKLY" ? 7 : 14;
                      const start = new Date(pickedSlot.startAt);
                      const last = new Date(start.getTime() + step * (totalCount - 1) * 24 * 60 * 60 * 1000);
                      return (
                        <div className="bk-recurring-summary">
                          <div className="bk-recurring-summary__row">
                            <span>İlk seans</span>
                            <strong>{dayLabel(pickedSlot.startAt)}, {fmtTime(pickedSlot.startAt)}</strong>
                          </div>
                          <div className="bk-recurring-summary__row">
                            <span>Cəmi seans</span>
                            <strong>{totalCount}</strong>
                          </div>
                          <div className="bk-recurring-summary__row">
                            <span>Müddət</span>
                            <strong>{(totalCount - 1) * step / 7} həftə</strong>
                          </div>
                          <div className="bk-recurring-summary__row">
                            <span>Son seans</span>
                            <strong>{dayLabel(last.toISOString())}</strong>
                          </div>
                          <p className="bk-recurring-note">
                            Psixoloqun məzuniyyət günlərinə düşənlər avtomatik atlanır — sonra «Genişləndir» düyməsi ilə əlavə edə bilərsiniz.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>

              {(() => {
                const noteOk = note.trim().length >= 5;
                const slotOk = !!pickedSlot || !recurring;
                const blockers: string[] = [];
                if (recurring && !pickedSlot) blockers.push("Davamlı rezerv üçün vaxt seçin");
                if (!noteOk) blockers.push("Mövzu üçün ən azı 5 simvol yazın");
                const ready = noteOk && slotOk;
                return (
                  <>
                    <div className="bk-checklist">
                      <div className={`bk-check${psychologist ? " is-ok" : ""}`}>
                        <CheckIconSmall ok={!!psychologist} /> Psixoloq seçildi
                      </div>
                      <div className={`bk-check${slotOk ? " is-ok" : ""}`}>
                        <CheckIconSmall ok={slotOk} /> {pickedSlot ? "Vaxt seçildi" : recurring ? "Vaxt seçilməlidir" : "Vaxt (istəyə bağlı)"}
                      </div>
                      <div className={`bk-check${noteOk ? " is-ok" : ""}`}>
                        <CheckIconSmall ok={noteOk} /> Mövzu yazıldı
                      </div>
                    </div>

                    {error && <div className="bk-error">{error}</div>}

                    <div className="bk-actions">
                      <button type="button" className="bk-btn bk-btn-ghost" onClick={() => router.back()}>
                        {t("common.cancel")}
                      </button>
                      <button type="submit"
                        className="bk-btn bk-btn-primary"
                        disabled={submitting || !ready}
                        title={!ready ? blockers.join(" · ") : undefined}>
                        {submitting ? t("common.sending") : t("book.submitCta")}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function CheckIconSmall({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  );
}
