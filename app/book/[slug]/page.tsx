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
  type IntroEligibility,
} from "@/lib/api";
import { buildPanelUrl, getStoredUser } from "@/lib/auth";
import { withSlugs } from "@/lib/slug";
import { downloadIcsMulti } from "@/lib/calendar";
import { useT } from "@/lib/i18n/LocaleProvider";
import DatePicker from "@/components/DatePicker";

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

  // Pulsuz tanışlıq (INTRO, 15 dəq) görüşü — hər pasient platforma üzrə 1 pulsuz
  // haqqa malikdir; 2-ci yalnız operator icazə versə.
  const [sessionKind, setSessionKind] = useState<"STANDARD" | "INTRO">("STANDARD");
  const [introEligibility, setIntroEligibility] = useState<IntroEligibility | null>(null);
  // Eligible olduqda göstərilən "istəyirsiniz?" bannerinin cavablanıb-cavablanmadığı —
  // TypeCard-lar bu cavabı istənilən vaxt dəyişdirmək üçün mexanizm kimi qalır.
  const [introPromptAnswered, setIntroPromptAnswered] = useState(false);
  // sessionKind toggle olunanda grid yenidən yüklənir — page-level `loading`-dən ayrı.
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Əlavə vaxt seçimi — günün mövcud aralığı daxilində grid-ə bağlı olmayan sərbəst vaxt.
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [customTimeDraft, setCustomTimeDraft] = useState("");
  const [customTime, setCustomTime] = useState<string | null>(null);
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);

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

  useEffect(() => {
    patientApi.introEligibility().then(setIntroEligibility).catch(() => {});
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
    // Randevu yalnız pasiyent üçündür — digər rolları (psixoloq/operator/admin)
    // öz panellərinə ötür, randevu səhifəsində saxlama.
    if (user.role !== "PATIENT") {
      window.location.replace(buildPanelUrl(user.role));
      return;
    }
    // Pasiyent randevunu öz panelində götürür — saytın public /book səhifəsinə
    // (birbaşa link və ya login-sonrası `next`) düşərsə, panel versiyasına ötür.
    if (!window.location.pathname.startsWith("/patient/")) {
      window.location.replace(`${buildPanelUrl("PATIENT")}/book/${rawSlug}`);
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
        setLoading(false);
      })
      .catch(() => {
        setError("Məlumatları yükləmək alınmadı");
        setLoading(false);
      });
  }, [rawSlug, router]);

  // sessionKind toggle olunanda köhnə grid-ə aid seçimlər (basket/custom vaxt) etibarsızlaşır.
  useEffect(() => {
    setBasket([]);
    setCustomTime(null);
    setCustomTimeOpen(false);
    setCustomTimeError(null);
  }, [sessionKind]);

  // Slot grid-i psixoloq yükləndikdə VƏ sessionKind hər dəfə dəyişdikdə yenidən çəkir —
  // STANDARD üçün param-sız (bugünkü davranışla eyni sorğu), INTRO üçün 15-dəq grid.
  useEffect(() => {
    if (!psychologist) return;
    setSlotsLoading(true);
    const today = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21);
    getPsychologistAvailability(psychologist.id, isoDateOnly(today), isoDateOnly(to),
      sessionKind === "INTRO" ? "INTRO" : undefined)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [psychologist?.id, sessionKind]);

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

  // Seçilmiş günün mövcud aralığı (əlavə vaxt seçimi üçün sərhəd) — min/max reduce ilə,
  // çünki nə backend, nə də `grouped` gün-daxili xronoloji sıra zəmanət vermir.
  const dayBounds = useMemo(() => {
    if (activeSlots.length === 0) return null;
    const minIso = activeSlots.map(s => s.startAt).reduce((a, b) => (a < b ? a : b));
    const maxIso = activeSlots.map(s => s.endAt).reduce((a, b) => (a > b ? a : b));
    return { minIso, maxIso };
  }, [activeSlots]);

  // Grid-dən seçilmiş vaxtlar + (varsa) əlavə vaxt seçimi ilə təsdiqlənmiş sərbəst vaxt.
  const okItems = useMemo(() => {
    const gridOk = basket.filter(b => b.kind === "ok");
    return customTime ? [...gridOk, { kind: "ok" as const, startAt: customTime }] : gridOk;
  }, [basket, customTime]);
  const conflictItems = useMemo(() => basket.filter(b => b.kind === "conflict"), [basket]);
  const inBasket = (startAt: string) => basket.some(b => b.startAt === startAt && b.kind === "ok");

  const toggleSlot = (s: AvailableSlot) => {
    setError(null);
    setCustomTime(null);
    setBasket(prev => {
      const hit = prev.find(b => b.startAt === s.startAt);
      if (hit) return prev.filter(b => b.startAt !== s.startAt);
      return sortBasket([...prev, { kind: "ok", startAt: s.startAt }]);
    });
  };

  // Gün tab-ı dəyişəndə açıq (təsdiqlənməmiş) əlavə-vaxt formu bağlanır — sərhədlər
  // artıq həmin günə aid deyil. Təsdiqlənmiş customTime toxunulmur (basket kimi qalır).
  useEffect(() => {
    setCustomTimeOpen(false);
    setCustomTimeDraft("");
    setCustomTimeError(null);
  }, [activeDayKey]);

  const confirmCustomTime = () => {
    if (!dayBounds || !customTimeDraft) return;
    const picked = new Date(customTimeDraft);
    if (Number.isNaN(picked.getTime())) {
      setCustomTimeError("Etibarsız vaxt");
      return;
    }
    if (picked <= new Date()) {
      setCustomTimeError("Keçmiş vaxt seçilə bilməz");
      return;
    }
    if (dayKey(customTimeDraft) !== activeDayKey) {
      setCustomTimeError("Seçilmiş gün üçün vaxt daxil edin");
      return;
    }
    if (customTimeDraft < dayBounds.minIso || customTimeDraft > dayBounds.maxIso) {
      setCustomTimeError(`Seçdiyiniz vaxt mövcud aralıqdan (${fmtTime(dayBounds.minIso)}–${fmtTime(dayBounds.maxIso)}) kənardır`);
      return;
    }
    setCustomTimeError(null);
    setCustomTime(customTimeDraft);
    setBasket([]);
    setCustomTimeOpen(false);
  };

  // Seans növü seçimi — həm "istəyirsiniz?" banneri, həm TypeCard-lar bunları çağırır
  // (banner cavablandıqdan sonra TypeCard-lar fikri dəyişmək üçün mexanizm kimi qalır).
  const chooseStandardSingle = () => {
    setMode("SINGLE"); setSelectedPackage(null); setChooseLater(false);
    setSessionKind("STANDARD"); setIntroPromptAnswered(true);
  };
  const chooseIntro = () => {
    setMode("SINGLE"); setSelectedPackage(null); setChooseLater(false);
    setSessionKind("INTRO"); setIntroPromptAnswered(true);
  };
  const choosePackage = (pkg: PackageSummary) => {
    setMode("PACKAGE"); setSelectedPackage(pkg); setSessionKind("STANDARD"); setIntroPromptAnswered(true);
    // sessionKind effekti yalnız STANDARD↔INTRO keçidində tetiklənir — Single(standard)→Package
    // keçidində sessionKind dəyişmədiyi üçün custom vaxtı əl ilə təmizləyirik.
    setCustomTime(null); setCustomTimeOpen(false); setCustomTimeError(null);
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
    getPsychologistAvailability(psychologist.id, isoDateOnly(today), isoDateOnly(to),
      sessionKind === "INTRO" ? "INTRO" : undefined)
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
    if (sessionKind === "INTRO" && okItems.length >= 2) {
      setError("Tanışlıq görüşü üçün yalnız bir vaxt seçilə bilər");
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
          sessionKind: sessionKind === "INTRO" ? "INTRO" : undefined,
        });
        setResult({
          seriesId: null,
          createdAppointmentIds: [],
          createdSlots: okItems.map(b => b.startAt),
          conflicts: [],
        });
        // Pulsuz tanışlıq uğurla bron olundu — eligibility server-tərəfdə dəyişdi
        // (1-ci istifadə olundu / 2-ci qrant istehlak oldu), UI vəziyyətini təzələ.
        if (sessionKind === "INTRO") {
          patientApi.introEligibility().then(setIntroEligibility).catch(() => {});
        }
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

  /* ── Layout CSS (media queries + scrollbar can't be inline) ─────────────── */
  const layoutCss = `
    .bkx-grid { display: grid; grid-template-columns: minmax(0,1fr) 360px; gap: 22px; align-items: start; }
    .bkx-side { position: sticky; top: 24px; }
    .bkx-bottombar { display: none; }
    .bkx-days::-webkit-scrollbar { height: 6px }
    .bkx-days::-webkit-scrollbar-thumb { background: #D6E2F7; border-radius: 99px }
    @media (max-width: 980px) {
      .bkx-grid { grid-template-columns: 1fr; }
      .bkx-side { display: none; }
      .bkx-bottombar { display: flex; }
      .bkx-app { padding-bottom: 104px !important; }
    }
  `;

  /* ── SUCCESS SCREEN ─────────────────────────────────────────────────────── */
  if (result) {
    const sessionMin = sessionKind === "INTRO" ? 15 : (psychologist?.defaultSessionMinutes ?? 50);
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
      <main style={{ background: "#F0F4FA", minHeight: "100vh", width: "100%" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 36, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#D1FAE5", color: "#065F46", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }} aria-hidden>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--oxford)", margin: "0 0 8px" }}>{t("book.basketSuccessTitle")}</h1>
            <p style={{ fontSize: 14.5, color: "var(--oxford-60)", fontWeight: 500, margin: "0 0 22px", lineHeight: 1.5 }}>
              {result.conflicts.length > 0
                ? t("book.basketPartialBody", { created: result.createdSlots.length, conflicts: result.conflicts.length })
                : result.createdSlots.length > 1
                  ? t("book.basketSuccessBody", { created: result.createdSlots.length })
                  : t("book.successBody")}
            </p>

            {result.createdSlots.length > 0 && (
              <div style={{ textAlign: "left", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>{t("book.basketCreatedList")}</div>
                {result.createdSlots.map(slot => (
                  <div key={slot} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>{dayLabel(slot)}, {fmtTime(slot)}</span>
                    <span style={{ color: "#065F46" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                  </div>
                ))}
                {result.conflicts.map(c => (
                  <div key={c.slot} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderTop: "1px solid #EDF1F8" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
                      {dayLabel(c.slot)}, {fmtTime(c.slot)} · <em>{t("book.basketTaken")}</em>
                    </span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {c.alternatives.length === 0
                        ? <em style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{t("book.basketAltNone")}</em>
                        : c.alternatives.map(alt => (
                          <button key={alt} type="button"
                            disabled={appendBusySlot !== null}
                            onClick={() => appendAlternative(c.slot, alt)}
                            style={{ background: "#fff", border: "1px solid #D6E2F7", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, color: "var(--brand-700)", cursor: "pointer" }}>
                            {appendBusySlot === alt ? "…" : `${dayLabel(alt)}, ${fmtTime(alt)}`}
                          </button>
                        ))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: "var(--brand-50)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "var(--brand-700)", fontWeight: 500, marginBottom: 20 }}>
              <strong>1 saat içində</strong> operator komandamız sizinlə əlaqə saxlayacaq.
            </div>

            <ol style={{ listStyle: "none", margin: "0 0 22px", padding: 0, display: "grid", gap: 10, textAlign: "left", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
              {[
                "Operator zəng edir / yazır",
                "Vaxt təsdiqlənir",
                "Seansın linki email/SMS ilə gəlir",
                "Seansa qoşulursunuz",
              ].map((step, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, color: "var(--oxford)" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand-100)", color: "var(--brand-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={appointmentsUrl} style={{ background: "var(--brand)", color: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t("book.successCta")}</a>
              {result.createdSlots.length > 0 && (
                <button type="button" onClick={handleIcsExport} style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("book.basketIcsAll")}
                </button>
              )}
              <Link href="/psychologists" style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t("book.backToList")}</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── Derived summary state (shared by sticky side + mobile bar) ──────────── */
  const pkgNeedsSlots = mode === "PACKAGE" && !!selectedPackage && !chooseLater;
  const pkgSlotsOk = !pkgNeedsSlots || okItems.length === (selectedPackage?.sessionCount ?? 0);
  const blockers: string[] = [];
  if (!noteOk) blockers.push("Mövzu üçün ən azı 5 simvol yazın");
  if (conflictItems.length > 0) blockers.push(t("book.basketUnresolved"));
  if (extendCtx && okItems.length === 0) blockers.push(t("book.basketEmpty"));
  if (pkgNeedsSlots && selectedPackage && !pkgSlotsOk) blockers.push(t("pkg.needN", { n: selectedPackage.sessionCount }));
  const ready = blockers.length === 0;
  const submitDisabled = submitting || !ready;

  const submitLabel = submitting
    ? t("common.sending")
    : mode === "PACKAGE" && selectedPackage
      ? t("pkg.buyPackage")
      : okItems.length > 1
        ? t("book.basketSubmitN", { n: okItems.length })
        : t("book.submitCta");

  const typeSummary = mode === "PACKAGE" && selectedPackage
    ? selectedPackage.name
    : sessionKind === "INTRO" ? "Tanışlıq görüşü (pulsuz)"
    : okItems.length > 1 ? "Çoxlu seans" : "Tək seans";

  const timeDone = (mode === "PACKAGE" && chooseLater) ? true : okItems.length > 0;
  const timeLabel = (mode === "PACKAGE" && chooseLater)
    ? "Vaxt sonra seçiləcək"
    : pkgNeedsSlots && selectedPackage
      ? t("pkg.selectedOfN", { m: okItems.length, n: selectedPackage.sessionCount })
      : okItems.length === 0 ? "Vaxt (istəyə bağlı)" : `${okItems.length} seans seçildi`;

  const showPicker = !(mode === "PACKAGE" && chooseLater);

  /* ── BOOKING FLOW ───────────────────────────────────────────────────────── */
  return (
    <main style={{ background: "#F0F4FA", minHeight: "100vh", width: "100%", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--oxford)" }}>
      <style>{layoutCss}</style>
      <div className="bkx-app" style={{ width: "100%", padding: "30px 32px 56px", maxWidth: "min(1360px, 94vw)", margin: "0 auto" }}>

        {/* breadcrumb + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 14 }}>
          <button type="button" onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--oxford-60)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, fontSize: 13 }}>Psixoloqlar</button>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C9D6EC" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          <span style={{ color: "var(--oxford)" }}>Randevu al</span>
        </div>
        <h1 style={{ margin: "0 0 22px", fontSize: 27, fontWeight: 800, letterSpacing: "-.02em" }}>{t("book.subtitle")}</h1>

        {loading ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)", border: "1px solid #EDF1F8" }}>{t("common.loading")}</div>
        ) : !psychologist ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#991B1B", border: "1px solid #FECACA" }}>{error ?? "Psixoloq tapılmadı."}</div>
        ) : (
          <form onSubmit={onSubmit} className="bkx-grid">
            {/* ===== LEFT: STEPS ===== */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

              {/* A) PSYCHOLOGIST SUMMARY */}
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span style={{ width: 58, height: 58, borderRadius: 16, background: psychologist.accentColor || "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "none", overflow: "hidden" }}>
                  {psychologist.photoUrl
                    ? <Image src={psychologist.photoUrl} alt={psychologist.name} width={58} height={58} unoptimized style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : initials(psychologist.name)}
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{psychologist.name}</div>
                  <div style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 10 }}>{psychologist.title}</div>
                  {psychologist.specializations && psychologist.specializations.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {psychologist.specializations.slice(0, 4).map(s => (
                        <span key={s} style={{ background: "var(--brand-50)", color: "var(--brand-700)", border: "1px solid var(--brand-100)", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    Seans müddəti: {sessionKind === "INTRO" ? 15 : (psychologist.defaultSessionMinutes ?? 50)} dəq
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                    Format: Onlayn (video)
                  </span>
                </div>
              </div>

              {extendCtx && (
                <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "var(--brand-700)" }}>
                  {t("book.extendBanner")}
                </div>
              )}

              {/* B) SESSION TYPE (step 1) */}
              {!extendCtx && (
                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
                  <SectionHead n={1} title={t("pkg.chooseType")} />

                  {introEligibility?.eligible && !introPromptAnswered && (
                    <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--brand-700)", marginBottom: 4 }}>
                        Sizin 1 dəfəlik pulsuz 15 dəqiqəlik tanışlıq görüşü keçirmək şansınız var
                        {introEligibility.usedCount === 1 ? " (2-ci pulsuz seans)" : ""}.
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, margin: "0 0 12px" }}>İstəyirsiniz?</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={chooseIntro}
                          style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Bəli
                        </button>
                        <button type="button" onClick={chooseStandardSingle}
                          style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Xeyr, uzun seans istəyirəm
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                    <TypeCard
                      selected={mode === "SINGLE" && sessionKind === "STANDARD"}
                      label={t("pkg.single")}
                      note="Bir dəfəlik seans"
                      onClick={chooseStandardSingle}
                    />
                    {introEligibility?.eligible && (
                      <TypeCard
                        selected={mode === "SINGLE" && sessionKind === "INTRO"}
                        badge="Pulsuz"
                        label="Tanışlıq görüşü"
                        note="15 dəq · Pulsuz"
                        onClick={chooseIntro}
                      />
                    )}
                    {psychologist.packages?.map(pkg => {
                      const picked = mode === "PACKAGE" && selectedPackage?.id === pkg.id;
                      return (
                        <TypeCard
                          key={pkg.id}
                          isPkg
                          selected={picked}
                          label={pkg.name}
                          note={`${pkg.sessionCount} seans daxildir`}
                          onClick={() => choosePackage(pkg)}
                        />
                      );
                    })}
                  </div>

                  {mode === "PACKAGE" && selectedPackage && (
                    <div style={{ marginTop: 16, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-700)", marginBottom: 10 }}>Vaxtları nə vaxt seçmək istəyirsiniz?</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <WhenCard active={!chooseLater} title={t("pkg.pickNNow")} sub="Bütün seansları planlayın" onClick={() => setChooseLater(false)} />
                        <WhenCard active={chooseLater} title={t("pkg.chooseLater")} sub="Paketi al, vaxtı sonra təyin et" onClick={() => setChooseLater(true)} />
                      </div>
                      <p style={{ fontSize: 12, color: "var(--oxford-60)", margin: "10px 0 0" }}>{t("pkg.pendingNote")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* C) TIME PICKER (step 2) + D) BASKET */}
              {showPicker && (
                <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <SectionHead n={2} title={t("book.timeSection")} />
                    {pkgNeedsSlots && selectedPackage ? (
                      <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: pkgSlotsOk ? "#D1FAE5" : "var(--brand-50)", color: pkgSlotsOk ? "#065F46" : "var(--brand-700)" }}>
                        {t("pkg.selectedOfN", { m: okItems.length, n: selectedPackage.sessionCount })}
                      </span>
                    ) : okItems.length > 0 && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: "var(--brand-50)", color: "var(--brand-700)" }}>
                        {t("book.basketCount", { n: okItems.length })}
                      </span>
                    )}
                  </div>

                  {slotsLoading ? (
                    <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>{t("common.loading")}</div>
                  ) : grouped.length === 0 ? (
                    <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>{t("book.noSlots")}</div>
                  ) : (
                    <>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 12 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        Bütün vaxtlar Asia/Baku zonası
                      </div>

                      <div className="bkx-days" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
                        {grouped.map(([k, daySlots], idx) => {
                          const active = k === activeDayKey;
                          const picked = daySlots.filter(s => inBasket(s.startAt)).length;
                          return (
                            <button type="button" key={k} onClick={() => setActiveDayKey(k)}
                              style={{ flex: "none", position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`, background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)", borderRadius: 11, padding: "9px 13px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {idx === 0 && <span style={{ background: active ? "rgba(255,255,255,.22)" : "#D1FAE5", color: active ? "#fff" : "#065F46", fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".04em" }}>Ən tez</span>}
                                {picked > 0 && <span style={{ background: active ? "#fff" : "var(--brand)", color: active ? "var(--brand)" : "#fff", fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{picked}</span>}
                              </span>
                              {dayLabel(daySlots[0].startAt)}
                              <small style={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.85 : 0.6 }}>{daySlots.length} vaxt</small>
                            </button>
                          );
                        })}
                      </div>

                      {(() => {
                        const sessionMin = sessionKind === "INTRO" ? 15 : (psychologist.defaultSessionMinutes ?? 50);
                        const byTod: Record<"morning" | "afternoon" | "evening", AvailableSlot[]> = { morning: [], afternoon: [], evening: [] };
                        for (const s of activeSlots) byTod[timeOfDay(s.startAt)].push(s);
                        const groups = (["morning", "afternoon", "evening"] as const).filter(g => byTod[g].length > 0);
                        if (groups.length === 0) {
                          return (
                            <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 20, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>
                              Bu gündə boş vaxt yoxdur.{grouped.length > 1 && " Növbəti günü yoxlayın →"}
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {groups.map(g => (
                              <div key={g}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>{TOD_LABEL[g]}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {byTod[g].map(s => {
                                    const active = inBasket(s.startAt);
                                    return (
                                      <button type="button" key={s.startAt} onClick={() => toggleSlot(s)} title={fmtRange(s.startAt, sessionMin)}
                                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 76, border: `1.5px solid ${active ? "var(--brand)" : "#D6E2F7"}`, background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)", borderRadius: 10, padding: "9px 12px", fontFamily: "inherit", cursor: "pointer" }}>
                                        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{fmtTime(s.startAt)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.85 : 0.6 }}>{sessionMin} dəq</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Əlavə vaxt seçimi — grid-ə uyğun gəlməyəndə günün mövcud aralığında sərbəst vaxt */}
                      {mode === "SINGLE" && !extendCtx && dayBounds && (
                        <div style={{ marginTop: 14 }}>
                          {customTime ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{dayLabel(customTime)}, {fmtTime(customTime)}</span>
                              <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>Fərqli saat</span>
                              <button type="button" onClick={() => setCustomTime(null)}
                                style={{ marginLeft: "auto", background: "#fff", border: "1px solid #E1E9F5", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "#991B1B", cursor: "pointer", fontFamily: "inherit" }}>
                                Sil
                              </button>
                            </div>
                          ) : !customTimeOpen ? (
                            <button type="button" onClick={() => { setCustomTimeOpen(true); setCustomTimeDraft(""); setCustomTimeError(null); }}
                              style={{ background: "none", border: "none", color: "var(--brand-700)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                              Fərqli saat istəyirəm →
                            </button>
                          ) : (
                            <div style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: 14 }}>
                              <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 8 }}>
                                Bu gün üçün mövcud aralıq: {fmtTime(dayBounds.minIso)}–{fmtTime(dayBounds.maxIso)}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <DatePicker value={customTimeDraft} onChange={setCustomTimeDraft} withTime theme="light" size="sm"
                                  min={dayBounds.minIso} max={dayBounds.maxIso} style={{ minWidth: 220 }} />
                                <button type="button" onClick={confirmCustomTime}
                                  style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                  Bu vaxtı seç
                                </button>
                                <button type="button" onClick={() => setCustomTimeOpen(false)}
                                  style={{ background: "#fff", border: "1px solid #D6E2F7", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                  Ləğv et
                                </button>
                              </div>
                              {customTimeError && (
                                <div style={{ color: "#991B1B", fontSize: 12, fontWeight: 600, marginTop: 8 }}>{customTimeError}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* selected-times basket */}
                      {basket.length > 0 && (
                        <div style={{ marginTop: 18, borderTop: "1px solid #F0F4FA", paddingTop: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>{t("book.basketTitle")} · {basket.length}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {basket.map(item => (
                              <div key={item.startAt}
                                style={{ border: `1px solid ${item.kind === "conflict" ? "#FECACA" : "#EDF1F8"}`, background: item.kind === "conflict" ? "#FEF2F2" : "#F8FAFD", borderRadius: 10, padding: "10px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  <div style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "baseline", gap: 8 }}>
                                    <strong style={{ fontSize: 13.5, color: "var(--oxford)" }}>{dayLabel(item.startAt)}</strong>
                                    <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>{fmtTime(item.startAt)}</span>
                                    {item.kind === "conflict" && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#991B1B" }}>{t("book.basketConflictRow")}</span>}
                                  </div>
                                  {item.kind === "ok" && (
                                    <button type="button" onClick={() => setRepeatOpenFor(repeatOpenFor === item.startAt ? null : item.startAt)}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", border: "1px solid #D6E2F7", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "var(--brand-700)", cursor: "pointer", fontFamily: "inherit" }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                                      {t("book.basketRepeat")}
                                    </button>
                                  )}
                                  <button type="button" onClick={() => removeRow(item.startAt)} aria-label={t("book.basketRemove")} title={t("book.basketRemove")}
                                    style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #E1E9F5", borderRadius: 8, color: "#991B1B", cursor: "pointer" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                  </button>
                                </div>

                                {item.kind === "conflict" && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                    {item.alternatives.length === 0
                                      ? <em style={{ fontSize: 12, color: "var(--oxford-60)" }}>{t("book.basketAltNone")}</em>
                                      : item.alternatives.map(alt => (
                                        <button key={alt} type="button" onClick={() => replaceConflict(item.startAt, alt)} title={t("book.basketConflictHint")}
                                          style={{ background: "#fff", border: "1px solid #D6E2F7", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "var(--brand-700)", cursor: "pointer" }}>
                                          {dayLabel(alt)}, {fmtTime(alt)}
                                        </button>
                                      ))}
                                  </div>
                                )}

                                {repeatOpenFor === item.startAt && item.kind === "ok" && (
                                  <div style={{ marginTop: 10, background: "#fff", border: "1px solid #E1E9F5", borderRadius: 10, padding: 12 }}>
                                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                      <button type="button" onClick={() => setRepeatStep(7)}
                                        style={{ flex: 1, border: `1px solid ${repeatStep === 7 ? "var(--brand)" : "#D6E2F7"}`, background: repeatStep === 7 ? "var(--brand-50)" : "#fff", color: repeatStep === 7 ? "var(--brand-700)" : "var(--oxford-60)", borderRadius: 8, padding: "7px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Hər həftə</button>
                                      <button type="button" onClick={() => setRepeatStep(14)}
                                        style={{ flex: 1, border: `1px solid ${repeatStep === 14 ? "var(--brand)" : "#D6E2F7"}`, background: repeatStep === 14 ? "var(--brand-50)" : "#fff", color: repeatStep === 14 ? "var(--brand-700)" : "var(--oxford-60)", borderRadius: 8, padding: "7px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>2 həftədən bir</button>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                      {[4, 6, 8].map(n => (
                                        <button key={n} type="button" disabled={repeatBusy} onClick={() => runRepeat(item.startAt, n)}
                                          style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700, color: "var(--brand-700)", cursor: repeatBusy ? "wait" : "pointer", fontFamily: "inherit" }}>+{n}</button>
                                      ))}
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        <input type="number" min={2} max={12} value={repeatCustom}
                                          onChange={e => setRepeatCustom(Math.max(2, Math.min(12, Number(e.target.value) || 4)))}
                                          style={{ width: 56, border: "1px solid #D6E2F7", borderRadius: 8, padding: "7px 8px", fontSize: 13, fontFamily: "inherit" }} />
                                        <button type="button" disabled={repeatBusy} onClick={() => runRepeat(item.startAt, repeatCustom)}
                                          style={{ background: "var(--brand)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: repeatBusy ? "wait" : "pointer", fontFamily: "inherit" }}>
                                          {repeatBusy ? t("book.basketChecking") : "+"}
                                        </button>
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {conflictItems.length > 0 && (
                            <p style={{ fontSize: 12, color: "#991B1B", margin: "10px 0 0", fontWeight: 500 }}>{t("book.basketConflictHint")}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* E) NOTE (step 3) */}
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
                <SectionHead n={3} title={t("book.noteSection")} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {NOTE_TEMPLATES.map(tpl => (
                    <button key={tpl.key} type="button" onClick={() => setNote(note ? note + "\n\n" + tpl.body : tpl.body)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-50)", color: "var(--brand-700)", border: "1px solid var(--brand-100)", borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <textarea rows={4} placeholder={t("book.notePlaceholder")} value={note} onChange={e => setNote(e.target.value)}
                  style={{ width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: 11, padding: 13, fontSize: 14, fontWeight: 500, color: "var(--oxford)", fontFamily: "inherit", resize: "vertical", lineHeight: 1.55, boxSizing: "border-box" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>{extendCtx ? t("book.extendNoteHint") : t("book.noteHint")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: noteOk ? "#065F46" : "var(--oxford-60)" }}>
                    {noteOk && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                    {noteOk ? "kifayətdir" : `${note.trim().length} / minimum 5`}
                  </span>
                </div>
              </div>
            </div>

            {/* ===== RIGHT: STICKY SUMMARY ===== */}
            <aside className="bkx-side">
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 30px rgba(8,47,109,.10)", border: "1px solid #EDF1F8", padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--brand-700)", marginBottom: 14 }}>Sifariş xülasəsi</div>

                <div style={{ display: "flex", alignItems: "center", gap: 11, paddingBottom: 14, borderBottom: "1px solid #F0F4FA", marginBottom: 14 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: psychologist.accentColor || "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flex: "none" }}>{initials(psychologist.name)}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{psychologist.name}</div>
                    <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{psychologist.title}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>Növ</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{typeSummary}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "14px 0", borderTop: "1px solid #F0F4FA", borderBottom: "1px solid #F0F4FA", marginBottom: 14 }}>
                  <CheckRow done label="Psixoloq seçildi" />
                  <CheckRow done={timeDone} label={timeLabel} />
                  <CheckRow done={noteOk} label="Mövzu yazıldı" />
                </div>

                <button type="submit" disabled={submitDisabled} title={!ready ? blockers.join(" · ") : undefined}
                  style={{ width: "100%", background: submitDisabled ? "#A9BEE2" : "var(--brand)", color: "#fff", border: "none", borderRadius: 11, padding: 14, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: submitDisabled ? "not-allowed" : "pointer", boxShadow: submitDisabled ? "none" : "0 4px 14px rgba(16,81,183,.28)" }}>
                  {submitLabel}
                </button>
                <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, textAlign: "center", marginTop: 9, minHeight: 16 }}>{!ready ? blockers[0] : ""}</div>
                {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 8 }}>{error}</div>}

                <button type="button" onClick={() => router.back()}
                  style={{ width: "100%", marginTop: 8, background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 11, padding: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  {t("common.cancel")}
                </button>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, background: "var(--brand-50)", borderRadius: 10, padding: "11px 12px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                  <span style={{ fontSize: 12, color: "var(--brand-700)", fontWeight: 500, lineHeight: 1.45 }}>Onlayn ödəniş yoxdur. Operator 1 saat içində təsdiq üçün sizinlə əlaqə saxlayacaq.</span>
                </div>
              </div>
            </aside>

            {/* MOBILE STICKY BOTTOM BAR */}
            <div className="bkx-bottombar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: "#fff", borderTop: "1px solid #E1E9F5", boxShadow: "0 -4px 20px rgba(8,47,109,.10)", padding: "12px 18px", alignItems: "center", gap: 14 }}>
              <div style={{ flex: "none", maxWidth: 140 }}>
                <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>Növ</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--brand-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{typeSummary}</div>
              </div>
              <button type="submit" disabled={submitDisabled}
                style={{ flex: 1, background: submitDisabled ? "#A9BEE2" : "var(--brand)", color: "#fff", border: "none", borderRadius: 11, padding: 14, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: submitDisabled ? "not-allowed" : "pointer" }}>
                {submitLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

/* ─── Small building blocks ──────────────────────────────────────────────── */

function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--brand)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flex: "none" }}>{n}</span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
    </div>
  );
}

function TypeCard({
  selected, isPkg, badge, label, note, onClick,
}: {
  selected: boolean;
  isPkg?: boolean;
  badge?: string;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      style={{ position: "relative", textAlign: "left", background: selected ? "var(--brand-50)" : "#fff", border: `1.5px solid ${selected ? "var(--brand)" : "#E1E9F5"}`, borderRadius: 13, padding: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 6 }}>
      {(isPkg || badge) && (
        <span style={{ alignSelf: "flex-start", background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 6 }}>{badge ?? "Paket"}</span>
      )}
      <span style={{ position: "absolute", top: 14, right: 14, width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selected ? "var(--brand)" : "#CBD5E6"}`, background: selected ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: selected ? 1 : 0 }}><path d="M20 6L9 17l-5-5" /></svg>
      </span>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)", paddingRight: 24 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: isPkg ? "#065F46" : "var(--oxford-60)" }}>{note}</span>
    </button>
  );
}

function WhenCard({ active, title, sub, onClick }: { active: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{ flex: 1, minWidth: 150, textAlign: "left", background: active ? "var(--brand-100)" : "#fff", border: `1.5px solid ${active ? "var(--brand)" : "#E1E9F5"}`, borderRadius: 11, padding: 13, cursor: "pointer", fontFamily: "inherit" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--brand-700)" : "var(--oxford)", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>{sub}</div>
    </button>
  );
}

function CheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: done ? "#D1FAE5" : "#EEF2F9", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={done ? "#065F46" : "#9DB0CC"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: done ? 1 : 0.5 }}><path d="M20 6L9 17l-5-5" /></svg>
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: done ? "var(--oxford)" : "var(--oxford-60)" }}>{label}</span>
    </div>
  );
}
