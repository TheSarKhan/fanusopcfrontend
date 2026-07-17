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
import { useT } from "@/lib/i18n/LocaleProvider";
import { azLocalToISO, azOrdinal, azNowLocal } from "@/lib/datetime";
import DatePicker from "@/components/DatePicker";

// Qısa forma (B.e/Ç.a/...) yalnız kompakt gün-tab çipləri üçün — sərbəst mətndə
// (səbətlər, təsdiq ekranı) qarışıq görünür, ona görə oralarda tam adlar (aşağıda) işlədilir.
const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];
const WEEKDAYS_AZ_FULL = ["Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə", "Bazar"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtDateFull(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Tam, birmənalı gün etiketi — "Cümə, 24.07.2026" (təsdiq/səbət kontekstləri üçün). */
function dayLabelFull(iso: string) {
  const d = new Date(iso);
  const isoDow = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_AZ_FULL[isoDow]}, ${fmtDateFull(iso)}`;
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
  // Psixoloqun açıq vaxtı olmadıqda pasient hələ də davam edə bilsin deyə —
  // hazır saatlardan seçim əvəzinə öz istədiyi tarix/saatı DatePicker ilə
  // qeyd edir; requestedStartAt kimi göndərilir, operator bunu təsdiqləyir.
  const [preferredStartAt, setPreferredStartAt] = useState("");
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

  // 4-addımlı wizard: 1 Növ, 2 Vaxt, 3 Səbəb, 4 Təsdiq — eyni anda yalnız 1 addım
  // görünür. Seriya-uzatma (extendCtx) bu naviqasiyadan azaddır, addımsız davam edir.
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Əlavə vaxt seçimi — günün mövcud aralığı daxilində grid-ə bağlı olmayan sərbəst vaxt.
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [customTimeDraft, setCustomTimeDraft] = useState("");
  const [customTime, setCustomTime] = useState<string | null>(null);
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);

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
    // psychologist yüklənməmişsə ümumi (psixoloqdan asılı olmayan) haqq yoxlanır;
    // yükləndikdən sonra bu psixoloqla artıq tanışlıq götürülüb-götürülmədiyi də nəzərə alınır.
    patientApi.introEligibility(psychologist?.id).then(setIntroEligibility).catch(() => {});
  }, [psychologist?.id]);

  // Tanışlıq görüşünə uyğun deyilsə banner heç göstərilmir və TypeCard-lar
  // "Tək seans" default seçili görünür — amma introPromptAnswered manual klik
  // olmadan false qalırdı, ona görə görünüşdə seçili olsa da Davam et düyməsi
  // bloklu qalırdı. Uyğun olmadığı bilinən kimi default seçimi həqiqətən
  // təsdiqlənmiş sayırıq.
  useEffect(() => {
    if (introEligibility && !introEligibility.eligible) {
      setIntroPromptAnswered(true);
    }
  }, [introEligibility]);

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
    if (basket.some(b => b.startAt === s.startAt)) {
      setError(null);
      setCustomTime(null);
      setBasket(prev => prev.filter(b => b.startAt !== s.startAt));
      return;
    }
    // Paket alışında ən çox sessionCount qədər vaxt seçilə bilər — yarımçıq
    // planlamaya (1..N) icazə var, amma paketdə olandan çox vaxt seçilə bilməz.
    if (!extendCtx && mode === "PACKAGE" && selectedPackage) {
      const okCount = basket.filter(b => b.kind === "ok").length;
      if (okCount >= selectedPackage.sessionCount) {
        setError(t("pkg.needN", { n: selectedPackage.sessionCount }));
        return;
      }
    }
    setError(null);
    setCustomTime(null);
    setBasket(prev => {
      // Tək seans (STANDARD və ya INTRO) yalnız 1 vaxtla göndərilə bilər — yeni
      // seçim basketə əlavə olunmur, əvəzinə köhnəni əvəz edir. Çoxlu-vaxt basket
      // yalnız paket alışında (yarımçıq planlama da daxil) və seriya-uzatmada qalır.
      if (!extendCtx && mode === "SINGLE") return [{ kind: "ok", startAt: s.startAt }];
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
    if (!customTimeDraft) return;
    const picked = new Date(customTimeDraft);
    if (Number.isNaN(picked.getTime())) {
      setCustomTimeError("Etibarsız vaxt");
      return;
    }
    if (picked <= new Date()) {
      setCustomTimeError("Keçmiş vaxt seçilə bilməz");
      return;
    }
    // Mövcud aralıq məhdudiyyəti yoxdur — bu, yalnız pasiyentin ilkin istəyidir; operator/
    // psixoloq lazım gələrsə vaxtı sonradan tənzimləyir. İstənilən (keçmiş olmayan) vaxt olar.
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
  };

  const replaceConflict = (startAt: string, alt: string) => {
    setBasket(prev => sortBasket(
      prev
        .filter(b => b.startAt !== startAt)
        .filter(b => b.startAt !== alt)
        .concat([{ kind: "ok", startAt: alt }]),
    ));
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
    // Modul A — paket alışı (tək seans branch-i aşağıda dəyişməz qalır).
    // Yarımçıq planlama: 1..sessionCount aralığında istənilən say seçilə bilər —
    // qalan seanslar "remainingSessions" kimi paketdə qalır, sonra pasient özü
    // (SCHEDULE_LATER axını) və ya operator tərəfindən planlaşdırılır.
    if (mode === "PACKAGE" && selectedPackage) {
      if (!chooseLater && okItems.length === 0) {
        setError(t("pkg.needAtLeast1"));
        return;
      }
      if (!chooseLater && okItems.length > selectedPackage.sessionCount) {
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
        // 0 or 1 slot — the unchanged single-booking flow. When the psychologist has
        // no open slots at all, the patient may have picked their own preferred
        // date/time via the DatePicker instead — send it as the requested start.
        const requestedStartAt = okItems.length === 1 ? okItems[0].startAt
          : preferredStartAt ? azLocalToISO(preferredStartAt)
          : null;
        await patientApi.book({
          note: note.trim(),
          requestedPsychologistId: psychologist.id,
          requestedStartAt,
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
          patientApi.introEligibility(psychologist.id).then(setIntroEligibility).catch(() => {});
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
    .bkx-grid { display: flex; flex-direction: column; gap: 18px; }
    .bkx-bottombar { display: none; }
    .bkx-days::-webkit-scrollbar { height: 6px }
    .bkx-days::-webkit-scrollbar-thumb { background: #D6E2F7; border-radius: 99px }
    @media (max-width: 980px) {
      .bkx-bottombar { display: flex; }
      .bkx-app { padding-bottom: 104px !important; }
    }

    /* ── Animations ─────────────────────────────────────────────────────── */
    @keyframes bkx-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bkx-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bkx-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }

    /* fill-mode intentionally omitted on bkx-step/bkx-pop: their end-keyframe sets
       a non-"none" transform (translateY(0)/scale(1)) which, if left applied via
       "both"/"forwards" after the animation ends, creates a CSS containing block
       on that element — breaking position:fixed children (e.g. the DatePicker
       popup) that expect to be positioned relative to the viewport. Letting the
       animation end normally reverts transform to the element's real (none) style. */
    .bkx-app { animation: bkx-fade 0.45s ease both; }
    .bkx-step { animation: bkx-fade-up 0.4s cubic-bezier(.22,1,.36,1); }
    .bkx-pop { animation: bkx-pop 0.45s cubic-bezier(.34,1.56,.64,1); }

    .bkx-hover { transition: transform .18s ease, box-shadow .18s ease; }
    .bkx-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(16,81,183,.14); }
    .bkx-hover:active { transform: translateY(0); box-shadow: none; }

    .bkx-btn-primary { transition: transform .15s ease, box-shadow .15s ease, background .2s ease; }
    .bkx-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(16,81,183,.28); }
    .bkx-btn-primary:active:not(:disabled) { transform: translateY(0); }

    @media (prefers-reduced-motion: reduce) {
      .bkx-app, .bkx-step, .bkx-pop, .bkx-hover, .bkx-btn-primary { animation: none !important; transition: none !important; }
    }
  `;

  /* ── SUCCESS SCREEN ─────────────────────────────────────────────────────── */
  if (result) {
    return (
      <main style={{ background: "#F0F4FA", minHeight: "100vh", width: "100%" }}>
        <style>{layoutCss}</style>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
          <div className="bkx-step" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 36, textAlign: "center" }}>
            <div className="bkx-pop" style={{ width: 64, height: 64, borderRadius: "50%", background: "#D1FAE5", color: "#065F46", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }} aria-hidden>
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
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)" }}>{dayLabelFull(slot)}, saat {fmtTime(slot)}</span>
                    <span style={{ color: "#065F46" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                  </div>
                ))}
                {result.conflicts.map(c => (
                  <div key={c.slot} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderTop: "1px solid #EDF1F8" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
                      {dayLabelFull(c.slot)}, saat {fmtTime(c.slot)} · <em>{t("book.basketTaken")}</em>
                    </span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {c.alternatives.length === 0
                        ? <em style={{ fontSize: 12.5, color: "var(--oxford-60)" }}>{t("book.basketAltNone")}</em>
                        : c.alternatives.map(alt => (
                          <button key={alt} type="button"
                            disabled={appendBusySlot !== null}
                            onClick={() => appendAlternative(c.slot, alt)}
                            style={{ background: "#fff", border: "1px solid #D6E2F7", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, color: "var(--brand-700)", cursor: "pointer" }}>
                            {appendBusySlot === alt ? "…" : `${dayLabelFull(alt)}, saat ${fmtTime(alt)}`}
                          </button>
                        ))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: "var(--brand-50)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "var(--brand-700)", fontWeight: 500, marginBottom: 20 }}>
              <strong>Ən yaxın müddətdə</strong> operator komandamız sizinlə əlaqə saxlayacaq.
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
              <a href={appointmentsUrl} className="bkx-btn-primary bkx-hover" style={{ background: "var(--brand)", color: "#fff", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t("book.successCta")}</a>
              <Link href="/psychologists" className="bkx-hover" style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t("book.backToList")}</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── Derived summary state (shared by sticky side + mobile bar) ──────────── */
  // Paket üçün yarımçıq planlama: 1..sessionCount aralığında istənilən say keçərlidir —
  // dəqiq N tələb olunmur, qalanlar "remainingSessions" kimi paketdə qalıb sonra planlaşdırılır.
  const pkgNeedsSlots = mode === "PACKAGE" && !!selectedPackage && !chooseLater;
  const pkgSlotsOk = !pkgNeedsSlots || (okItems.length >= 1 && okItems.length <= (selectedPackage?.sessionCount ?? 0));
  const blockers: string[] = [];
  if (!introPromptAnswered && !extendCtx) blockers.push("Əvvəlcə seans növünü seçin");
  if (!noteOk) blockers.push("Mövzu üçün ən azı 5 simvol yazın");
  if (conflictItems.length > 0) blockers.push(t("book.basketUnresolved"));
  if (extendCtx && okItems.length === 0) blockers.push(t("book.basketEmpty"));
  if (pkgNeedsSlots && selectedPackage && okItems.length === 0) blockers.push(t("pkg.needAtLeast1"));
  if (pkgNeedsSlots && selectedPackage && okItems.length > selectedPackage.sessionCount) blockers.push(t("pkg.needN", { n: selectedPackage.sessionCount }));
  const ready = blockers.length === 0;
  const submitDisabled = submitting || !ready;

  const submitLabel = submitting
    ? t("common.sending")
    : mode === "PACKAGE" && selectedPackage
      ? t("pkg.buyPackage")
      : okItems.length > 1
        ? t("book.basketSubmitN", { n: okItems.length })
        : t("book.submitCta");

  const typeSummary = !introPromptAnswered && !extendCtx
    ? "Seçilməyib"
    : mode === "PACKAGE" && selectedPackage
      ? selectedPackage.name
      : sessionKind === "INTRO" ? "Tanışlıq görüşü (pulsuz)"
      : okItems.length > 1 ? "Çoxlu seans" : "Tək seans";

  const showPicker = !(mode === "PACKAGE" && chooseLater);
  // Psixoloq heç bir açıq vaxt göstərməyibsə (grouped boşdur), seçiləcək heç nə yoxdur —
  // pasienti bloklamaq əvəzinə davam etməyə icazə veririk (operator sonra əl ilə
  // uyğunlaşdırır), paket/seriya-uzatma axınları isə öz "sonra seç" mexanizmini saxlayır.
  const noSlotsAvailable = showPicker && !slotsLoading && grouped.length === 0;
  // Sərbəst tarix/saat sahəsi (əl ilə) — psixoloqun açıq vaxtı yoxdursa göstərilir.
  // Boş buraxmaq olar (opsional), amma doldurularsa keçmiş vaxt qəbul edilməməlidir.
  const preferredStartInPast = noSlotsAvailable && !!preferredStartAt
    && new Date(preferredStartAt) <= new Date();
  const timeDone = (mode === "PACKAGE" && chooseLater) ? true
    : pkgNeedsSlots ? okItems.length > 0
    : extendCtx ? okItems.length > 0
    : (okItems.length > 0 || (noSlotsAvailable && !preferredStartInPast));
  const timeLabel = (mode === "PACKAGE" && chooseLater)
    ? "Vaxt sonra seçiləcək"
    : pkgNeedsSlots && selectedPackage
      ? t("pkg.selectedOfN", { m: okItems.length, n: selectedPackage.sessionCount })
      : okItems.length > 0 ? `${okItems.length} seans seçildi`
      : preferredStartAt ? `${dayLabelFull(preferredStartAt)}, saat ${fmtTime(preferredStartAt)}`
      : "Vaxt (istəyə bağlı)";

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

              {/* Wizard stepper — seriya-uzatmada (extendCtx) addım naviqasiyası yoxdur */}
              {!extendCtx && <Stepper current={wizardStep} />}

              {/* B) SESSION TYPE (step 1) */}
              {!extendCtx && wizardStep === 1 && (
                <div className="bkx-step" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
                  <SectionHead n={1} title={t("pkg.chooseType")} />

                  {introEligibility?.eligible && !introPromptAnswered && (
                    <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--brand-700)", marginBottom: 4 }}>
                        Sizin 1 dəfəlik pulsuz 15 dəqiqəlik tanışlıq görüşü keçirmək şansınız var
                        {introEligibility.usedCount >= 1 ? ` (${azOrdinal(introEligibility.usedCount + 1)} pulsuz seans)` : ""}.
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500, margin: "0 0 12px" }}>İstəyirsiniz?</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={chooseIntro} className="bkx-btn-primary bkx-hover"
                          style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Bəli
                        </button>
                        <button type="button" onClick={chooseStandardSingle} className="bkx-hover"
                          style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Xeyr, uzun seans istəyirəm
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pulsuz tanışlıq sualı cavablanana qədər növ seçimi gizlədilir — istifadəçi
                      əvvəlcə "istəyirsiniz?" sualına cavab verməyə məcburdur. Uyğun deyilsə
                      (artıq istifadə edib və ya hələ yüklənməyibsə) seçim birbaşa göstərilir. */}
                  {(!introEligibility?.eligible || introPromptAnswered) && (
                    <>
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
                            <WhenCard active={!chooseLater} title={t("pkg.pickNNow")} sub="İstədiyiniz qədər planlayın, qalanını sonra edin" onClick={() => setChooseLater(false)} />
                            <WhenCard active={chooseLater} title={t("pkg.chooseLater")} sub="Paketi al, vaxtı sonra təyin et" onClick={() => setChooseLater(true)} />
                          </div>
                          <p style={{ fontSize: 12, color: "var(--oxford-60)", margin: "10px 0 0" }}>{t("pkg.pendingNote")}</p>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                        <button type="button" disabled={!introPromptAnswered} onClick={() => setWizardStep(2)} className="bkx-btn-primary"
                          style={{ background: introPromptAnswered ? "var(--brand)" : "#E1E9F5", color: introPromptAnswered ? "#fff" : "var(--oxford-60)", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: introPromptAnswered ? "pointer" : "not-allowed", transition: "background .2s ease" }}>
                          Davam et →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* C) TIME PICKER (step 2) + D) BASKET — seans növü seçilənə (və ya
                  seriya-uzatma olana) qədər gizli, addımlar sıra ilə açılsın. */}
              {(extendCtx || wizardStep === 2) && (
                <div className="bkx-step" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
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

                  {!showPicker ? (
                    <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>
                      Vaxt sonra seçiləcək — paket satın alındıqdan sonra operator sizinlə əlaqə saxlayıb vaxtları planlaşdıracaq.
                    </div>
                  ) : slotsLoading ? (
                    <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>{t("common.loading")}</div>
                  ) : grouped.length === 0 ? (
                    <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>
                      <p style={{ margin: pkgNeedsSlots || extendCtx ? 0 : "0 0 14px" }}>{t("book.noSlots")}</p>
                      {!pkgNeedsSlots && !extendCtx && (
                        <div style={{ textAlign: "left", maxWidth: 280, margin: "0 auto" }}>
                          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--oxford-80)", marginBottom: 6 }}>
                            Sizə uyğun tarix/saatı seçin (opsional)
                          </label>
                          <DatePicker value={preferredStartAt} onChange={setPreferredStartAt} withTime theme="light"
                            min={azNowLocal()} placeholder="gg.aa.iiii ss:dd" />
                          {preferredStartInPast && (
                            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#B42318", fontWeight: 600 }}>
                              Keçmiş vaxt seçilə bilməz
                            </p>
                          )}
                        </div>
                      )}
                    </div>
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
                            <button type="button" key={k} onClick={() => setActiveDayKey(k)} className="bkx-hover"
                              style={{ flex: "none", position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, border: `1px solid ${active ? "var(--brand)" : "#D6E2F7"}`, background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)", borderRadius: 11, padding: "9px 13px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", transition: "background .2s ease, border-color .2s ease" }}>
                              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {idx === 0 && <span style={{ background: active ? "rgba(255,255,255,.22)" : "#D1FAE5", color: active ? "#fff" : "#065F46", fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".04em" }}>Ən tez</span>}
                                {picked > 0 && <span style={{ background: active ? "#fff" : "var(--brand)", color: active ? "var(--brand)" : "#fff", fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{picked}</span>}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{WEEKDAYS_AZ_FULL[(new Date(daySlots[0].startAt).getDay() + 6) % 7]}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, opacity: active ? 0.9 : 0.7 }}>{fmtDateFull(daySlots[0].startAt)}</span>
                              <small style={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.85 : 0.6 }}>{daySlots.length} vaxt</small>
                            </button>
                          );
                        })}
                      </div>

                      {(() => {
                        const sessionMin = sessionKind === "INTRO" ? 15 : (psychologist.defaultSessionMinutes ?? 50);
                        if (activeSlots.length === 0) {
                          return (
                            <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 10, padding: 20, textAlign: "center", fontSize: 13, color: "var(--oxford-60)" }}>
                              Bu gündə boş vaxt yoxdur.{grouped.length > 1 && " Növbəti günü yoxlayın →"}
                            </div>
                          );
                        }
                        // Bütün vaxtlar tək ardıcıl grid-də (səhər/günorta/axşam bölmələri yoxdur).
                        const sorted = [...activeSlots].sort((a, b) => a.startAt.localeCompare(b.startAt));
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {sorted.map(s => {
                              const active = inBasket(s.startAt);
                              return (
                                <button type="button" key={s.startAt} onClick={() => toggleSlot(s)} title={fmtRange(s.startAt, sessionMin)} className="bkx-hover"
                                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 76, border: `1.5px solid ${active ? "var(--brand)" : "#D6E2F7"}`, background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--oxford)", borderRadius: 10, padding: "9px 12px", fontFamily: "inherit", cursor: "pointer", transition: "background .2s ease, border-color .2s ease" }}>
                                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{fmtTime(s.startAt)}</span>
                                  <span style={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.85 : 0.6 }}>{sessionMin} dəq</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Əlavə vaxt seçimi — grid-ə uyğun gəlməyəndə günün mövcud aralığında sərbəst vaxt */}
                      {mode === "SINGLE" && !extendCtx && dayBounds && (
                        <div style={{ marginTop: 14 }}>
                          {customTime ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{dayLabelFull(customTime)}, saat {fmtTime(customTime)}</span>
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
                                İstədiyiniz tarix və saatı seçin — bu, ilkin istəyinizdir, lazım gələrsə sonradan dəyişdirilə bilər.
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <DatePicker value={customTimeDraft} onChange={setCustomTimeDraft} withTime theme="light" size="sm"
                                  min={isoDateOnly(new Date())} style={{ width: 240, flex: "0 0 auto" }} />
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
                                    <strong style={{ fontSize: 13.5, color: "var(--oxford)" }}>{dayLabelFull(item.startAt)}</strong>
                                    <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>saat {fmtTime(item.startAt)}</span>
                                    {item.kind === "conflict" && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#991B1B" }}>{t("book.basketConflictRow")}</span>}
                                  </div>
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
                                          {dayLabelFull(alt)}, saat {fmtTime(alt)}
                                        </button>
                                      ))}
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

                  {!extendCtx && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                      <button type="button" onClick={() => setWizardStep(1)} className="bkx-hover"
                        style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                        ← Geri
                      </button>
                      <button type="button" disabled={!timeDone || conflictItems.length > 0} onClick={() => setWizardStep(3)} className="bkx-btn-primary"
                        style={{ background: (timeDone && conflictItems.length === 0) ? "var(--brand)" : "#E1E9F5", color: (timeDone && conflictItems.length === 0) ? "#fff" : "var(--oxford-60)", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: (timeDone && conflictItems.length === 0) ? "pointer" : "not-allowed", transition: "background .2s ease" }}>
                        Davam et →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* E) NOTE (step 3) — eynilə seans növü seçilənə qədər gizli */}
              {(extendCtx || wizardStep === 3) && (
                <div className="bkx-step" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
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

                  {!extendCtx && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                      <button type="button" onClick={() => setWizardStep(2)} className="bkx-hover"
                        style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                        ← Geri
                      </button>
                      <button type="button" disabled={!noteOk} onClick={() => setWizardStep(4)} className="bkx-btn-primary"
                        style={{ background: noteOk ? "var(--brand)" : "#E1E9F5", color: noteOk ? "#fff" : "var(--oxford-60)", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: noteOk ? "pointer" : "not-allowed", transition: "background .2s ease" }}>
                        Davam et →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* F) SUMMARY + SUBMIT (step 4) — seriya-uzatmada yoxdur, o birbaşa sağ paneldən göndərir */}
              {!extendCtx && wizardStep === 4 && (
                <div className="bkx-step" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20 }}>
                  <SectionHead n={4} title="Təsdiq" />

                  {/* Psixoloq kartı */}
                  <div style={{ display: "flex", gap: 14, alignItems: "center", paddingBottom: 16, borderBottom: "1px solid #F0F4FA", marginBottom: 16 }}>
                    <span style={{ width: 48, height: 48, borderRadius: 14, background: psychologist.accentColor || "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flex: "none", overflow: "hidden" }}>
                      {psychologist.photoUrl
                        ? <Image src={psychologist.photoUrl} alt={psychologist.name} width={48} height={48} unoptimized style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : initials(psychologist.name)}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{psychologist.name}</div>
                      <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{psychologist.title}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>Növ</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>{typeSummary}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>Seans müddəti</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>
                        {sessionKind === "INTRO" ? 15 : (psychologist.defaultSessionMinutes ?? 50)} dəq · Onlayn (video)
                      </span>
                    </div>

                    {mode === "PACKAGE" && selectedPackage && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>Paket</span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>
                          {selectedPackage.name} · {selectedPackage.sessionCount} seans
                        </span>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>Vaxt</span>
                      {chooseLater || okItems.length === 0 ? (
                        <div style={{ background: "#F8FAFD", border: "1px dashed var(--brand-100)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>
                          {timeLabel}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {okItems.map(item => (
                            <div key={item.startAt} style={{ display: "flex", alignItems: "baseline", gap: 8, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 8, padding: "8px 10px" }}>
                              <strong style={{ fontSize: 13, color: "var(--oxford)" }}>{dayLabelFull(item.startAt)}</strong>
                              <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>saat {fmtTime(item.startAt)}</span>
                            </div>
                          ))}
                          {mode === "PACKAGE" && selectedPackage && okItems.length < selectedPackage.sessionCount && (
                            <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>
                              Qalan {selectedPackage.sessionCount - okItems.length} seans sonra planlaşdırılacaq.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>Mövzu</span>
                      <div style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "var(--oxford)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {note.trim() || "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 18, background: "var(--brand-50)", borderRadius: 10, padding: "11px 12px" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                    <span style={{ fontSize: 12, color: "var(--brand-700)", fontWeight: 500, lineHeight: 1.45 }}>Operator ən yaxın müddətdə təsdiq üçün sizinlə əlaqə saxlayacaq.</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <button type="button" onClick={() => setWizardStep(3)} className="bkx-hover"
                      style={{ background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                      ← Geri
                    </button>
                    <button type="submit" disabled={submitDisabled} className="bkx-btn-primary"
                      style={{ flex: 1, background: submitDisabled ? "#A9BEE2" : "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: submitDisabled ? "not-allowed" : "pointer", transition: "background .2s ease" }}>
                      {submitLabel}
                    </button>
                  </div>
                  {!ready && <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, textAlign: "right", marginTop: 8 }}>{blockers[0]}</div>}
                  {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 8 }}>{error}</div>}
                </div>
              )}
            </div>

            {/* MOBILE STICKY BOTTOM BAR */}
            <div className="bkx-bottombar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: "#fff", borderTop: "1px solid #E1E9F5", boxShadow: "0 -4px 20px rgba(8,47,109,.10)", padding: "12px 18px", alignItems: "center", gap: 14 }}>
              <div style={{ flex: "none", maxWidth: 140 }}>
                <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>Növ</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--brand-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{typeSummary}</div>
              </div>
              <button type="submit" disabled={submitDisabled} className="bkx-btn-primary"
                style={{ flex: 1, background: submitDisabled ? "#A9BEE2" : "var(--brand)", color: "#fff", border: "none", borderRadius: 11, padding: 14, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: submitDisabled ? "not-allowed" : "pointer", transition: "background .2s ease" }}>
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

function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Növ", "Vaxt", "Səbəb", "Təsdiq"];
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "none" }}>
                <span style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: done || active ? "var(--brand)" : "#EEF2F9",
                  color: done || active ? "#fff" : "var(--oxford-60)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, flex: "none",
                  transform: active ? "scale(1.12)" : "scale(1)",
                  boxShadow: active ? "0 0 0 4px var(--brand-50)" : "none",
                  transition: "background .3s ease, transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease",
                }}>
                  {done
                    ? <svg key="check" className="bkx-pop" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : n}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? "var(--brand-700)" : "var(--oxford-60)", whiteSpace: "nowrap", transition: "color .25s ease" }}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <span style={{ flex: 1, height: 2, background: done ? "var(--brand)" : "#EEF2F9", margin: "14px 8px 0", transition: "background .35s ease" }} />
              )}
            </div>
          );
        })}
      </div>
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
    <button type="button" onClick={onClick} aria-pressed={selected} className="bkx-hover"
      style={{ position: "relative", textAlign: "left", background: selected ? "var(--brand-50)" : "#fff", border: `1.5px solid ${selected ? "var(--brand)" : "#E1E9F5"}`, borderRadius: 13, padding: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 6, transition: "background .2s ease, border-color .2s ease" }}>
      {(isPkg || badge) && (
        <span style={{ alignSelf: "flex-start", background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 6 }}>{badge ?? "Paket"}</span>
      )}
      <span style={{ position: "absolute", top: 14, right: 14, width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selected ? "var(--brand)" : "#CBD5E6"}`, background: selected ? "var(--brand)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background .2s ease, border-color .2s ease, transform .25s cubic-bezier(.34,1.56,.64,1)", transform: selected ? "scale(1)" : "scale(.85)" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: selected ? 1 : 0, transition: "opacity .2s ease" }}><path d="M20 6L9 17l-5-5" /></svg>
      </span>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--oxford)", paddingRight: 24 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: isPkg ? "#065F46" : "var(--oxford-60)" }}>{note}</span>
    </button>
  );
}

function WhenCard({ active, title, sub, onClick }: { active: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="bkx-hover"
      style={{ flex: 1, minWidth: 150, textAlign: "left", background: active ? "var(--brand-100)" : "#fff", border: `1.5px solid ${active ? "var(--brand)" : "#E1E9F5"}`, borderRadius: 11, padding: 13, cursor: "pointer", fontFamily: "inherit", transition: "background .2s ease, border-color .2s ease" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--brand-700)" : "var(--oxford)", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>{sub}</div>
    </button>
  );
}
