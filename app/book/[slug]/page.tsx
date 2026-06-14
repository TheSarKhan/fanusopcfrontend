"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getPsychologistAvailability,
  getPsychologists,
  patientApi,
  repeatCheck,
  isSlotConflict,
  type AvailableSlot,
  type BasketResult,
  type Psychologist,
  type PackageSummary,
} from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { buildPanelUrl, getStoredUser } from "@/lib/auth";
import { withSlugs } from "@/lib/slug";
import { downloadIcsMulti } from "@/lib/calendar";
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

/** Basket row: a freely-picked slot, or a repeat-probe week that turned out busy. */
type BasketItem =
  | { kind: "ok"; startAt: string }
  | { kind: "conflict"; startAt: string; alternatives: string[] };

function sortBasket(items: BasketItem[]): BasketItem[] {
  return [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Extend-mode context parsed from ?extend=&anchor=&step=&weeks= (B2-2). */
interface ExtendCtx {
  seriesId: number;
  anchor: string | null;
  step: 7 | 14;
  weeks: number;
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
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentsUrl, setAppointmentsUrl] = useState("/patient/appointments");
  const [packagesUrl, setPackagesUrl] = useState("/patient/packages");

  // Modul A — tək seans vs paket seçimi
  const [mode, setMode] = useState<"SINGLE" | "PACKAGE">("SINGLE");
  const [selectedPackage, setSelectedPackage] = useState<PackageSummary | null>(null);
  const [chooseLater, setChooseLater] = useState(false);

  // Repeat accelerator (B1-2)
  const [repeatOpenFor, setRepeatOpenFor] = useState<string | null>(null);
  const [repeatStep, setRepeatStep] = useState<7 | 14>(7);
  const [repeatCustom, setRepeatCustom] = useState<number>(4);
  const [repeatBusy, setRepeatBusy] = useState(false);

  // Extend mode (B2-2)
  const [extendCtx, setExtendCtx] = useState<ExtendCtx | null>(null);
  const [extendPrefilled, setExtendPrefilled] = useState(false);

  // Submit result (success screen)
  const [result, setResult] = useState<BasketResult | null>(null);
  const [appendBusySlot, setAppendBusySlot] = useState<string | null>(null);

  useEffect(() => {
    setAppointmentsUrl(`${buildPanelUrl("PATIENT")}/appointments`);
    setPackagesUrl(`${buildPanelUrl("PATIENT")}/packages`);
  }, []);

  // Parse extend-mode query params once (client-only page).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const extend = Number(sp.get("extend"));
    if (Number.isFinite(extend) && extend > 0) {
      const step = sp.get("step") === "14" ? 14 : 7;
      const weeksRaw = Number(sp.get("weeks"));
      setExtendCtx({
        seriesId: extend,
        anchor: sp.get("anchor"),
        step,
        weeks: Number.isFinite(weeksRaw) ? Math.max(1, Math.min(12, weeksRaw)) : 4,
      });
    }
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
            // Canonicalise to the slug URL, keeping panel prefix and query
            // string (the extend flow arrives here with a numeric id).
            const prefix = window.location.pathname.startsWith("/patient/") ? "/patient/book" : "/book";
            router.replace(`${prefix}/${match.slug}${window.location.search}`);
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

  // B2-2: prefill the basket from the course's rhythm when extending.
  useEffect(() => {
    if (!extendCtx || !extendCtx.anchor || !psychologist || extendPrefilled) return;
    setExtendPrefilled(true);
    setRepeatStep(extendCtx.step);
    repeatCheck({
      psychologistId: psychologist.id,
      slot: extendCtx.anchor,
      weeks: extendCtx.weeks,
      step: extendCtx.step,
    })
      .then(entries => {
        setBasket(prev => sortBasket([
          ...prev,
          ...entries
            .filter(e => !prev.some(b => b.startAt === e.date))
            .map(e => (e.free
              ? { kind: "ok" as const, startAt: e.date }
              : { kind: "conflict" as const, startAt: e.date, alternatives: e.alternatives })),
        ]));
      })
      .catch(() => { /* user can still pick slots manually */ });
  }, [extendCtx, psychologist, extendPrefilled]);

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

  const okItems = useMemo(() => basket.filter(b => b.kind === "ok"), [basket]);
  const conflictItems = useMemo(() => basket.filter(b => b.kind === "conflict"), [basket]);
  const inBasket = (startAt: string) => basket.some(b => b.startAt === startAt && b.kind === "ok");

  const toggleSlot = (s: AvailableSlot) => {
    setError(null);
    setBasket(prev => {
      const hit = prev.find(b => b.startAt === s.startAt);
      if (hit) return prev.filter(b => b.startAt !== s.startAt);
      return sortBasket([...prev, { kind: "ok", startAt: s.startAt }]);
    });
  };

  const removeRow = (startAt: string) => {
    setBasket(prev => prev.filter(b => b.startAt !== startAt));
    if (repeatOpenFor === startAt) setRepeatOpenFor(null);
  };

  const replaceConflict = (startAt: string, alt: string) => {
    setBasket(prev => sortBasket(
      prev
        .filter(b => b.startAt !== startAt)
        .filter(b => b.startAt !== alt)
        .concat([{ kind: "ok", startAt: alt }]),
    ));
  };

  // B1-2: probe the next weeks for one basket row and fill the basket.
  const runRepeat = async (anchor: string, weeks: number) => {
    if (!psychologist || repeatBusy) return;
    setRepeatBusy(true);
    setError(null);
    try {
      const entries = await repeatCheck({
        psychologistId: psychologist.id,
        slot: anchor,
        weeks,
        step: repeatStep,
      });
      setBasket(prev => sortBasket([
        ...prev,
        ...entries
          .filter(e => !prev.some(b => b.startAt === e.date))
          .map(e => (e.free
            ? { kind: "ok" as const, startAt: e.date }
            : { kind: "conflict" as const, startAt: e.date, alternatives: e.alternatives })),
      ]));
      setRepeatOpenFor(null);
    } catch (err) {
      setError((err as Error).message || t("common.error"));
    } finally {
      setRepeatBusy(false);
    }
  };

  const reloadAvailability = () => {
    if (!psychologist) return;
    const today = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21);
    getPsychologistAvailability(psychologist.id, isoDateOnly(today), isoDateOnly(to))
      .then(setSlots)
      .catch(() => {});
  };

  const noteOk = !!extendCtx || note.trim().length >= 5;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!psychologist) return;
    if (!noteOk) {
      setError(t("book.errorNoteShort"));
      return;
    }
    if (conflictItems.length > 0) {
      setError(t("book.basketUnresolved"));
      return;
    }
    // Modul A — paket alışı (tək seans branch-i aşağıda dəyişməz qalır)
    if (mode === "PACKAGE" && selectedPackage) {
      if (!chooseLater && okItems.length !== selectedPackage.sessionCount) {
        setError(t("pkg.needN", { n: selectedPackage.sessionCount }));
        return;
      }
      setSubmitting(true);
      try {
        await patientApi.purchasePackage({
          psychologistId: psychologist.id,
          packageId: selectedPackage.id,
          schedulingMode: chooseLater ? "SCHEDULE_LATER" : "SCHEDULE_NOW",
          slots: chooseLater ? undefined : okItems.map(b => b.startAt),
          note: note.trim() || undefined,
        });
        router.replace(packagesUrl);
      } catch (err) {
        setError((err as Error).message || "Müraciət göndərilərkən xəta baş verdi");
        if (isSlotConflict(err)) {
          setBasket(prev => prev.filter(b => b.kind !== "ok"));
          reloadAvailability();
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setSubmitting(true);
    try {
      if (extendCtx) {
        // Extend an existing course — always through the basket endpoint.
        if (okItems.length === 0) throw new Error(t("book.errorNoteShort"));
        const res = await patientApi.createBookingBasket({
          requestedPsychologistId: psychologist.id,
          slots: okItems.map(b => b.startAt),
          note: note.trim() || undefined,
          seriesId: extendCtx.seriesId,
        });
        handleBasketResponse(res);
      } else if (okItems.length >= 2) {
        const res = await patientApi.createBookingBasket({
          requestedPsychologistId: psychologist.id,
          slots: okItems.map(b => b.startAt),
          note: note.trim(),
        });
        handleBasketResponse(res);
      } else {
        // 0 or 1 slot — the unchanged single-booking flow.
        await patientApi.book({
          note: note.trim(),
          requestedPsychologistId: psychologist.id,
          requestedStartAt: okItems.length === 1 ? okItems[0].startAt : null,
        });
        setResult({
          seriesId: null,
          createdAppointmentIds: [],
          createdSlots: okItems.map(b => b.startAt),
          conflicts: [],
        });
      }
    } catch (err) {
      setError((err as Error).message || "Müraciət göndərilərkən xəta baş verdi");
      // GAP-02: slot raced away — refresh availability so stale picks vanish.
      if (isSlotConflict(err)) {
        setBasket(prev => prev.filter(b => b.kind !== "ok"));
        reloadAvailability();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBasketResponse = (res: BasketResult) => {
    if (res.createdSlots.length === 0) {
      // Everything raced away — stay on the form, flip rows to conflicts.
      setBasket(prev => sortBasket(prev.map(b => {
        const c = res.conflicts.find(x => x.slot === b.startAt);
        return c ? { kind: "conflict" as const, startAt: c.slot, alternatives: c.alternatives } : b;
      })));
      setError(t("book.basketAllTakenBody"));
      reloadAvailability();
      return;
    }
    setResult(res);
  };

  // Success screen: append a conflict alternative straight into the course.
  const appendAlternative = async (conflictSlot: string, alt: string) => {
    if (!psychologist || !result?.seriesId || appendBusySlot) return;
    setAppendBusySlot(alt);
    try {
      const res = await patientApi.createBookingBasket({
        requestedPsychologistId: psychologist.id,
        slots: [alt],
        seriesId: result.seriesId,
      });
      setResult(prev => prev && ({
        ...prev,
        createdSlots: [...prev.createdSlots, ...res.createdSlots].sort(),
        createdAppointmentIds: [...prev.createdAppointmentIds, ...res.createdAppointmentIds],
        conflicts: res.createdSlots.length > 0
          ? prev.conflicts.filter(c => c.slot !== conflictSlot)
          : prev.conflicts,
      }));
    } catch {
      /* chip stays — user can retry another alternative */
    } finally {
      setAppendBusySlot(null);
    }
  };

  if (result) {
    const sessionMin = psychologist?.defaultSessionMinutes ?? 50;
    const handleIcsExport = () => {
      if (!psychologist || result.createdSlots.length === 0) return;
      downloadIcsMulti(result.createdSlots.map((slot, i) => {
        const start = new Date(slot);
        return {
          uid: String(result.createdAppointmentIds[i] ?? `${Date.now()}-${i}`),
          start,
          end: new Date(start.getTime() + sessionMin * 60_000),
          title: `Seans · ${psychologist.name}`,
          description: `Psixoloq: ${psychologist.name}\nFanus platforması\n${note.slice(0, 240)}`,
        };
      }), "fanus-seanslar.ics");
    };
    return (
      <main className="bk-page">
        <div className="bk-success">
          <div className="bk-success-icon" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1>{t("book.basketSuccessTitle")}</h1>
          <p>
            {result.conflicts.length > 0
              ? t("book.basketPartialBody", { created: result.createdSlots.length, conflicts: result.conflicts.length })
              : result.createdSlots.length > 1
                ? t("book.basketSuccessBody", { created: result.createdSlots.length })
                : t("book.successBody")}
          </p>

          {result.createdSlots.length > 0 && (
            <div className="bk-success-list">
              <div className="bk-success-list__title">{t("book.basketCreatedList")}</div>
              {result.createdSlots.map(slot => (
                <div key={slot} className="bk-success-list__row">
                  <span className="bk-success-list__when">{dayLabel(slot)}, {fmtTime(slot)}</span>
                  <span className="bk-success-list__ok">✓</span>
                </div>
              ))}
              {result.conflicts.map(c => (
                <div key={c.slot} className="bk-success-list__row is-conflict">
                  <span className="bk-success-list__when">
                    {dayLabel(c.slot)}, {fmtTime(c.slot)} · <em>{t("book.basketTaken")}</em>
                  </span>
                  <span className="bk-success-list__alts">
                    {c.alternatives.length === 0
                      ? <em>{t("book.basketAltNone")}</em>
                      : c.alternatives.map(alt => (
                        <button key={alt} type="button"
                          className="bk-alt-chip"
                          disabled={appendBusySlot !== null}
                          onClick={() => appendAlternative(c.slot, alt)}>
                          {appendBusySlot === alt ? "…" : `${dayLabel(alt)}, ${fmtTime(alt)}`}
                        </button>
                      ))}
                  </span>
                </div>
              ))}
            </div>
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
            {result.createdSlots.length > 0 && (
              <button type="button" className="bk-btn bk-btn-ghost" onClick={handleIcsExport}>
                {t("book.basketIcsAll")}
              </button>
            )}
            <Link className="bk-btn bk-btn-ghost" href="/psychologists">{t("book.backToList")}</Link>
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

              {extendCtx && (
                <div className="bk-extend-banner">
                  {t("book.extendBanner")}
                </div>
              )}

              {/* ── Addım 0 — tək seans vs paket (Modul A) ──────────────── */}
              {!extendCtx && (
                <section className="bk-section bk-mode">
                  <div className="bk-section-head">
                    <h3>{t("pkg.chooseType")}</h3>
                  </div>
                  <div className="bk-mode-grid">
                    <button
                      type="button"
                      className={`bk-mode-card${mode === "SINGLE" ? " is-active" : ""}`}
                      aria-pressed={mode === "SINGLE"}
                      onClick={() => { setMode("SINGLE"); setSelectedPackage(null); setChooseLater(false); }}
                    >
                      <span className="bk-mode-card__name">{t("pkg.single")}</span>
                      {psychologist.individualPrice != null && (
                        <span className="bk-mode-card__price">{formatAzn(psychologist.individualPrice)}</span>
                      )}
                    </button>

                    {psychologist.packages?.map(pkg => {
                      const picked = mode === "PACKAGE" && selectedPackage?.id === pkg.id;
                      return (
                        <button
                          type="button"
                          key={pkg.id}
                          className={`bk-mode-card${picked ? " is-active" : ""}`}
                          aria-pressed={picked}
                          onClick={() => { setMode("PACKAGE"); setSelectedPackage(pkg); }}
                        >
                          <span className="bk-mode-card__badge">{t("pkg.package")}</span>
                          <span className="bk-mode-card__name">{pkg.name}</span>
                          <span className="bk-mode-card__price">{formatAzn(pkg.packagePrice)}</span>
                          <span className="bk-mode-card__per">
                            {formatAzn(pkg.perSessionPrice)}{t("pricing.perSession")}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {mode === "PACKAGE" && selectedPackage && (
                    <div className="bk-mode-when">
                      <div className="bk-mode-when__opts">
                        <button
                          type="button"
                          className={`bk-mode-when__opt${!chooseLater ? " is-active" : ""}`}
                          aria-pressed={!chooseLater}
                          onClick={() => setChooseLater(false)}
                        >
                          {t("pkg.pickNNow")}
                        </button>
                        <button
                          type="button"
                          className={`bk-mode-when__opt${chooseLater ? " is-active" : ""}`}
                          aria-pressed={chooseLater}
                          onClick={() => setChooseLater(true)}
                        >
                          {t("pkg.chooseLater")}
                        </button>
                      </div>
                      {!chooseLater && (
                        <div className={`bk-mode-when__counter${okItems.length === selectedPackage.sessionCount ? " is-ok" : ""}`}>
                          {t("pkg.selectedOfN", { m: okItems.length, n: selectedPackage.sessionCount })}
                        </div>
                      )}
                      {chooseLater && (
                        <p className="bk-mode-when__hint">{t("pkg.scheduleLaterHint")}</p>
                      )}
                      <p className="bk-mode-when__note">{t("pkg.pendingNote")}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Sonra-seç paketdə vaxt seçimi gizlədilir */}
              {!(mode === "PACKAGE" && chooseLater) && (
              <>
              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>{t("book.timeSection")}</h3>
                  {mode === "PACKAGE" && selectedPackage ? (
                    <span className={`bk-pill bk-pill-brand${okItems.length === selectedPackage.sessionCount ? " is-ok" : ""}`}>
                      {t("pkg.selectedOfN", { m: okItems.length, n: selectedPackage.sessionCount })}
                    </span>
                  ) : okItems.length > 0 && (
                    <span className="bk-pill bk-pill-brand">
                      {t("book.basketCount", { n: okItems.length })}
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
                        const picked = daySlots.filter(s => inBasket(s.startAt)).length;
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
                            {picked > 0 && <span className="bk-day-tab__badge bk-day-tab__badge--picked">{picked}</span>}
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
                                  const active = inBasket(s.startAt);
                                  return (
                                    <button
                                      type="button"
                                      key={s.startAt}
                                      className={`bk-slot${active ? " is-active" : ""}`}
                                      onClick={() => toggleSlot(s)}
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

              {/* ── Səbət (B1-1) ──────────────────────────────────────────── */}
              <section className="bk-section bk-basket">
                <div className="bk-section-head">
                  <h3>{t("book.basketTitle")}</h3>
                  {basket.length > 0 && (
                    <span className="bk-pill bk-pill-brand">{basket.length}</span>
                  )}
                </div>

                {basket.length === 0 ? (
                  <p className="bk-basket__empty">{t("book.basketEmpty")}</p>
                ) : (
                  <div className="bk-basket__list">
                    {basket.map(item => (
                      <div key={item.startAt}
                        className={`bk-basket__row${item.kind === "conflict" ? " is-conflict" : ""}`}>
                        <div className="bk-basket__when">
                          <strong>{dayLabel(item.startAt)}</strong>
                          <span>{fmtTime(item.startAt)}</span>
                          {item.kind === "conflict" && (
                            <span className="bk-basket__taken">{t("book.basketConflictRow")}</span>
                          )}
                        </div>

                        {item.kind === "conflict" ? (
                          <div className="bk-basket__alts">
                            {item.alternatives.length === 0
                              ? <em>{t("book.basketAltNone")}</em>
                              : item.alternatives.map(alt => (
                                <button key={alt} type="button" className="bk-alt-chip"
                                  onClick={() => replaceConflict(item.startAt, alt)}
                                  title={t("book.basketConflictHint")}>
                                  {dayLabel(alt)}, {fmtTime(alt)}
                                </button>
                              ))}
                          </div>
                        ) : (
                          <div className="bk-basket__row-actions">
                            <button type="button" className="bk-basket__repeat"
                              onClick={() => setRepeatOpenFor(repeatOpenFor === item.startAt ? null : item.startAt)}>
                              ⟳ {t("book.basketRepeat")}
                            </button>
                          </div>
                        )}

                        <button type="button" className="bk-basket__remove"
                          onClick={() => removeRow(item.startAt)}
                          aria-label={t("book.basketRemove")}
                          title={t("book.basketRemove")}>
                          ✕
                        </button>

                        {repeatOpenFor === item.startAt && item.kind === "ok" && (
                          <div className="bk-repeat-menu">
                            <div className="bk-repeat-menu__steps">
                              <button type="button"
                                className={`bk-repeat-menu__step${repeatStep === 7 ? " is-active" : ""}`}
                                onClick={() => setRepeatStep(7)}>
                                {t("book.basketRepeatStep7")}
                              </button>
                              <button type="button"
                                className={`bk-repeat-menu__step${repeatStep === 14 ? " is-active" : ""}`}
                                onClick={() => setRepeatStep(14)}>
                                {t("book.basketRepeatStep14")}
                              </button>
                            </div>
                            <div className="bk-repeat-menu__counts">
                              {[4, 6, 8].map(n => (
                                <button key={n} type="button" className="bk-repeat-menu__count"
                                  disabled={repeatBusy}
                                  onClick={() => runRepeat(item.startAt, n)}>
                                  +{n}
                                </button>
                              ))}
                              <label className="bk-repeat-menu__custom">
                                <span>{t("book.basketRepeatCustom")}</span>
                                <input type="number" min={2} max={12} value={repeatCustom}
                                  onChange={e => setRepeatCustom(Math.max(2, Math.min(12, Number(e.target.value) || 4)))} />
                                <button type="button" disabled={repeatBusy}
                                  onClick={() => runRepeat(item.startAt, repeatCustom)}>
                                  {repeatBusy ? t("book.basketChecking") : "+"}
                                </button>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {conflictItems.length > 0 && (
                  <p className="bk-basket__conflict-hint">{t("book.basketConflictHint")}</p>
                )}
              </section>
              </>
              )}

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
                  <span className="bk-hint">
                    {extendCtx ? t("book.extendNoteHint") : t("book.noteHint")}
                  </span>
                  <span className={`bk-counter${noteOk ? " is-ok" : ""}`}>
                    {noteOk ? "✓ kifayətdir" : `${note.trim().length} / minimum 5`}
                  </span>
                </div>
              </section>

              {(() => {
                const pkgNeedsSlots = mode === "PACKAGE" && !!selectedPackage && !chooseLater;
                const pkgSlotsOk = !pkgNeedsSlots || okItems.length === selectedPackage!.sessionCount;
                const blockers: string[] = [];
                if (!noteOk) blockers.push("Mövzu üçün ən azı 5 simvol yazın");
                if (conflictItems.length > 0) blockers.push(t("book.basketUnresolved"));
                if (extendCtx && okItems.length === 0) blockers.push(t("book.basketEmpty"));
                if (pkgNeedsSlots && !pkgSlotsOk) blockers.push(t("pkg.needN", { n: selectedPackage!.sessionCount }));
                const ready = blockers.length === 0;
                return (
                  <>
                    <div className="bk-checklist">
                      <div className={`bk-check${psychologist ? " is-ok" : ""}`}>
                        <CheckIconSmall ok={!!psychologist} /> Psixoloq seçildi
                      </div>
                      {pkgNeedsSlots ? (
                        <div className={`bk-check${pkgSlotsOk ? " is-ok" : ""}`}>
                          <CheckIconSmall ok={pkgSlotsOk} />{" "}
                          {t("pkg.selectedOfN", { m: okItems.length, n: selectedPackage!.sessionCount })}
                        </div>
                      ) : (
                        <div className={`bk-check${okItems.length > 0 ? " is-ok" : ""}`}>
                          <CheckIconSmall ok={okItems.length > 0} />{" "}
                          {okItems.length > 0
                            ? t("book.basketCount", { n: okItems.length })
                            : "Vaxt (istəyə bağlı)"}
                        </div>
                      )}
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
                        {submitting
                          ? t("common.sending")
                          : mode === "PACKAGE" && selectedPackage
                            ? t("pkg.buyPackage")
                            : okItems.length > 1
                              ? t("book.basketSubmitN", { n: okItems.length })
                              : t("book.submitCta")}
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
