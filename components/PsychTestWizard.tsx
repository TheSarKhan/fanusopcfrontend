"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PsyTest, PsyTestReq, PsyDraftReq } from "@/lib/api";
import { IconPlus, IconX, IconCheck, IconArrowRight, IconAlert } from "@/app/admin/_components/icons";
import { azOrdinal } from "@/lib/datetime";

const navLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: "transparent",
  border: "none",
  padding: "8px 6px",
  color: "var(--brand, #52718F)",
  fontSize: 14.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

// ─── Local editable shapes ──────────────────────────────────────────────────
// Questions/options/scales are plain editable rows. displayOrder is derived from
// the array index on save, so we never store it here.

type OptionRow = { label: string; points: string; imageUrl?: string };
type QuestionRow = { text: string; imageUrl?: string; options: OptionRow[] };
// A result band. Bands are contiguous, so only the upper bound (`upTo`) is
// entered; the lower bound is derived from the previous band. `color` drives the
// live severity bar.
type ScaleRow = { label: string; upTo: string; description: string; color: string };

type SaveState = "idle" | "saving" | "saved" | "error";

/** Abstracts the admin vs. psychologist draft/publish endpoints + upload. */
export type WizardApi = {
  createDraft: () => Promise<PsyTest>;
  saveDraft: (id: number, data: PsyDraftReq) => Promise<PsyTest>;
  publish: (id: number, data: PsyTestReq) => Promise<PsyTest>;
  uploadFile: (file: File) => Promise<string>;
};

const STEPS = ["Məlumat", "Suallar", "Şkalalar", "Önizləmə"] as const;

const SCORE_OPTIONS = [
  { value: "TOTAL", title: "Ümumi bal", desc: "Toplanmış ümumi bala görə nəticə." },
  { value: "PERCENTAGE", title: "Faiz", desc: "Maksimal bala nisbətdə faizlə nəticə." },
] as const;

// Result bands share a green→red severity gradient, assigned by position.
const BAND_COLORS = ["#16A34A", "#84CC16", "#CA8A04", "#EA580C", "#DC2626", "#7C3AED"];
const nextColor = (c: string) => BAND_COLORS[(BAND_COLORS.indexOf(c) + 1) % BAND_COLORS.length];

/** Contiguous bands: each starts one point after the previous band's upper bound
 *  (the first at 0). Returns index-aligned [from, to] pairs. */
function deriveBands(scales: ScaleRow[]): { from: number; to: number }[] {
  let prev = -1;
  return scales.map((s) => {
    const to = Number(s.upTo) || 0;
    const from = prev + 1;
    prev = to;
    return { from, to };
  });
}

function toRows(initial?: PsyTest | null): { questions: QuestionRow[]; scales: ScaleRow[] } {
  if (!initial) {
    return { questions: [{ text: "", options: [{ label: "", points: "0" }] }], scales: [] };
  }
  const questions = [...initial.questions]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((q) => ({
      text: q.text,
      imageUrl: q.imageUrl ?? undefined,
      options: [...q.options]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((o) => ({ label: o.label, points: String(o.points), imageUrl: o.imageUrl ?? undefined })),
    }));
  const scales = [...initial.scales]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s, i) => ({
      label: s.label,
      upTo: String(s.maxScore),
      description: s.description ?? "",
      color: s.color ?? BAND_COLORS[i % BAND_COLORS.length],
    }));
  return {
    questions: questions.length ? questions : [{ text: "", options: [{ label: "", points: "0" }] }],
    scales,
  };
}

export default function PsychTestWizard({
  initial,
  api,
  showPublished = false,
  doneHref,
}: {
  initial?: PsyTest | null;
  api: WizardApi;
  /** Admin controls global publishing; psychologists never do. */
  showPublished?: boolean;
  /** Where "Ləğv et" / post-publish redirect goes. */
  doneHref: string;
}) {
  const seed = toRows(initial);

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [scoreBasis, setScoreBasis] = useState<"TOTAL" | "PERCENTAGE">(
    initial?.scoreBasis === "PERCENTAGE" ? "PERCENTAGE" : "TOTAL"
  );
  const [published, setPublished] = useState(initial?.published ?? false);
  const [questions, setQuestions] = useState<QuestionRow[]>(seed.questions);
  const [scales, setScales] = useState<ScaleRow[]>(seed.scales);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // ── Draft payload (lenient — index-derived order) ─────────────────────────
  const buildDraft = (): PsyDraftReq => {
    const bands = deriveBands(scales);
    return {
      title,
      description,
      instructions,
      scoreBasis,
      questions: questions.map((q, qi) => ({
        text: q.text,
        imageUrl: q.imageUrl || undefined,
        displayOrder: qi,
        options: q.options.map((o, oi) => ({
          label: o.label,
          points: Number(o.points) || 0,
          imageUrl: o.imageUrl || undefined,
          displayOrder: oi,
        })),
      })),
      scales: scales.map((s, si) => ({
        label: s.label,
        minScore: bands[si].from,
        maxScore: bands[si].to,
        color: s.color,
        description: s.description || undefined,
        displayOrder: si,
      })),
    };
  };

  const payloadKey = useMemo(
    () => JSON.stringify(buildDraft()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, description, instructions, scoreBasis, questions, scales]
  );

  // ── Single-flight, coalescing autosave ─────────────────────────────────────
  const testIdRef = useRef<number | null>(initial?.id ?? null);
  const savingRef = useRef(false);
  const latestRef = useRef<PsyDraftReq | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);
  const createPromiseRef = useRef<Promise<number> | null>(null);

  /** Resolve the draft's id, creating the row exactly once even under concurrent
   *  callers (autosave + publish racing on a brand-new test). */
  const ensureDraftId = (): Promise<number> => {
    if (testIdRef.current != null) return Promise.resolve(testIdRef.current);
    if (!createPromiseRef.current) {
      createPromiseRef.current = api.createDraft().then(
        (t) => {
          testIdRef.current = t.id;
          return t.id;
        },
        (e) => {
          createPromiseRef.current = null; // allow a later retry
          throw e;
        }
      );
    }
    return createPromiseRef.current;
  };

  const runSave = async () => {
    if (savingRef.current) return; // in flight; it will pick up latestRef when it loops
    savingRef.current = true;
    setSaveState("saving");
    try {
      while (latestRef.current) {
        const payload = latestRef.current;
        latestRef.current = null;
        const id = await ensureDraftId();
        await api.saveDraft(id, payload);
      }
      setSaveState("saved");
      setSavedAt(new Date());
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  };

  const scheduleSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      latestRef.current = buildDraft();
      void runSave();
    }, 800);
  };

  // Debounced autosave on any change. Skips the initial mount so seeding an
  // existing test doesn't fire a redundant save.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    scheduleSave();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  /** Force any pending change to persist now and resolve once written. */
  const flushNow = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    latestRef.current = buildDraft();
    await runSave();
  };

  const retrySave = () => {
    latestRef.current = buildDraft();
    void runSave();
  };

  // ── Question mutations ─────────────────────────────────────────────────────
  const addQuestion = () =>
    setQuestions((qs) => [...qs, { text: "", options: [{ label: "", points: "0" }] }]);
  const removeQuestion = (qi: number) => setQuestions((qs) => qs.filter((_, i) => i !== qi));
  const setQuestion = (qi: number, patch: Partial<QuestionRow>) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  const addOption = (qi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, options: [...q.options, { label: "", points: "0" }] } : q))
    );
  const removeOption = (qi: number, oi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q))
    );
  const setOption = (qi: number, oi: number, patch: Partial<OptionRow>) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : q
      )
    );

  // ── Scale mutations ────────────────────────────────────────────────────────
  const addScale = () =>
    setScales((ss) => [
      ...ss,
      { label: "", upTo: "", description: "", color: BAND_COLORS[ss.length % BAND_COLORS.length] },
    ]);
  const removeScale = (si: number) => setScales((ss) => ss.filter((_, i) => i !== si));
  const setScale = (si: number, patch: Partial<ScaleRow>) =>
    setScales((ss) => ss.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  // Top of the score range the bands should cover: 100 for percentage, else the
  // sum of the highest option points per question.
  const maxPossible = useMemo(
    () =>
      questions.reduce((sum, q) => {
        const pts = q.options.map((o) => Number(o.points) || 0);
        return sum + (pts.length ? Math.max(...pts) : 0);
      }, 0),
    [questions]
  );
  const rangeMax = scoreBasis === "PERCENTAGE" ? 100 : maxPossible;

  // ── Validation (mirrors the publish rules) ─────────────────────────────────
  const validate = (): string | null => {
    if (!title.trim()) return "Test başlığı boş ola bilməz.";
    if (questions.length < 1) return "Ən azı bir sual əlavə edin.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `${azOrdinal(i + 1)} sualın mətni boş ola bilməz.`;
      if (q.options.length < 1) return `${azOrdinal(i + 1)} sualda ən azı bir variant olmalıdır.`;
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].label.trim())
          return `${azOrdinal(i + 1)} sualın ${azOrdinal(j + 1)} variantı boş ola bilməz.`;
      }
    }
    for (let i = 0; i < scales.length; i++) {
      if (!scales[i].label.trim()) return `${azOrdinal(i + 1)} şkalanın adı boş ola bilməz.`;
    }
    return null;
  };

  /** Blocking check for the step being left when moving forward. */
  const stepError = (s: number): string | null => {
    if (s === 1) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
          return `${azOrdinal(i + 1)} sual boşdur. Boş sual yarada bilməzsiniz — sual mətnini doldurun.`;
        }
        if (q.options.length < 1) {
          return `${azOrdinal(i + 1)} sualda ən azı bir cavab variantı olmalıdır.`;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].label.trim()) {
            return `${azOrdinal(i + 1)} sualın ${azOrdinal(j + 1)} variantı boşdur. Bütün variantları doldurun.`;
          }
        }
      }
    }
    return null;
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goStep = (n: number) => {
    // Moving forward: block on the current step's incomplete data with a popup.
    if (n > step) {
      const err = stepError(step);
      if (err) {
        setPopup(err);
        return;
      }
    }
    setError(null);
    void flushNow();
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    const v = validate();
    if (v) {
      setPopup(v);
      return;
    }
    setError(null);
    setPublishing(true);
    try {
      await flushNow(); // ensure the draft row exists + latest is written
      const id = await ensureDraftId();

      const data: PsyTestReq = {
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        scoreBasis,
        published: showPublished ? published : false,
        questions: questions.map((q, qi) => ({
          text: q.text.trim(),
          imageUrl: q.imageUrl || undefined,
          displayOrder: qi,
          options: q.options.map((o, oi) => ({
            label: o.label.trim(),
            points: Number(o.points) || 0,
            imageUrl: o.imageUrl || undefined,
            displayOrder: oi,
          })),
        })),
        scales: deriveBands(scales).map((b, si) => ({
          label: scales[si].label.trim(),
          minScore: b.from,
          maxScore: b.to,
          color: scales[si].color,
          description: scales[si].description.trim() || undefined,
          displayOrder: si,
        })),
      };
      await api.publish(id, data);
      if (typeof window !== "undefined") window.location.assign(doneHref);
    } catch (e) {
      setError((e as Error).message);
      setPublishing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div className="wiz-header">
        <Stepper step={step} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SaveIndicator state={saveState} savedAt={savedAt} onRetry={retrySave} />
          <a
            href={doneHref}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--muted, #6B7A8D)", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Ləğv et
          </a>
        </div>
      </div>

      {/* Content is capped to a comfortable reading column; header + footer span
          the full width so the edges are filled. */}
      <div style={{ width: "100%", maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div key={step} className="wiz-step">
      {step === 0 && (
        <InfoStep
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          instructions={instructions}
          setInstructions={setInstructions}
          scoreBasis={scoreBasis}
          setScoreBasis={setScoreBasis}
          showPublished={showPublished}
          published={published}
          setPublished={setPublished}
        />
      )}

      {step === 1 && (
        <QuestionsStep
          questions={questions}
          addQuestion={addQuestion}
          removeQuestion={removeQuestion}
          setQuestion={setQuestion}
          addOption={addOption}
          removeOption={removeOption}
          setOption={setOption}
          uploadFile={api.uploadFile}
        />
      )}

      {step === 2 && (
        <ScalesStep
          scales={scales}
          addScale={addScale}
          removeScale={removeScale}
          setScale={setScale}
          scoreBasis={scoreBasis}
          rangeMax={rangeMax}
        />
      )}

      {step === 3 && (
        <PreviewStep
          title={title}
          description={description}
          instructions={instructions}
          scoreBasis={scoreBasis}
          questions={questions}
          scales={scales}
          onEdit={goStep}
        />
      )}
      </div>

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#8b3d35",
            background: "var(--rose-bg, #FBECEA)",
            border: "1px solid #ddc2bf",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}
      </div>

      {/* ── Footer navigation — full-width sticky bar, arrows at the edges ── */}
      <div className="wiz-footer">
        <div>
          {step > 0 && (
            <button type="button" onClick={() => goStep(step - 1)} style={navLinkStyle}>
              <IconArrowRight size={16} style={{ transform: "rotate(180deg)" }} />
              Geri
            </button>
          )}
        </div>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => goStep(step + 1)} style={navLinkStyle}>
            İrəli
            <IconArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? "Paylaşılır…" : "Paylaş"}
          </button>
        )}
      </div>

      {popup && <WarningPopup message={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}

// ─── Blocking warning popup ───────────────────────────────────────────────────
function WarningPopup({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,28,46,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="wiz-pop"
        role="alertdialog"
        aria-modal="true"
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "min(420px, 100%)",
          padding: 24,
          textAlign: "center",
          boxShadow: "0 18px 50px rgba(10,26,51,0.28)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: "#FEF3C7",
            color: "#B45309",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <IconAlert size={26} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink, #1A2535)", margin: "0 0 6px" }}>Diqqət</h3>
        <p style={{ fontSize: 13.5, color: "var(--muted, #52718F)", lineHeight: 1.6, margin: "0 0 18px" }}>{message}</p>
        <button type="button" className="btn primary" onClick={onClose} style={{ minWidth: 120 }}>
          Anladım
        </button>
      </div>
    </div>
  );
}

// ─── Stepper (display only — navigation is sequential via the footer) ─────────
function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: active ? "var(--brand, #52718F)" : "transparent",
                background: active ? "var(--brand-50, #EEF4F9)" : "transparent",
                color: active ? "var(--brand-700, #2F4A63)" : "var(--muted, #6B7A8D)",
                fontSize: 12.5,
                fontWeight: 700,
                transition: "background .25s ease, border-color .25s ease, color .25s ease",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  fontSize: 11,
                  transition: "background .25s ease",
                  background: active
                    ? "var(--brand, #52718F)"
                    : done
                    ? "#065F46"
                    : "var(--surface-2, #EEF2F7)",
                  color: active || done ? "#fff" : "var(--muted, #6B7A8D)",
                }}
              >
                {done ? <IconCheck size={12} /> : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <span style={{ color: "var(--line, #DDE6F0)", fontSize: 12 }}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Save indicator ─────────────────────────────────────────────────────────
function SaveIndicator({
  state,
  savedAt,
  onRetry,
}: {
  state: SaveState;
  savedAt: Date | null;
  onRetry: () => void;
}) {
  const time = savedAt
    ? `${String(savedAt.getHours()).padStart(2, "0")}:${String(savedAt.getMinutes()).padStart(2, "0")}`
    : "";
  const base: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 };

  if (state === "saving")
    return <span style={{ ...base, color: "var(--muted, #6B7A8D)" }}><Dot color="#C7A24A" pulse /> Yadda saxlanılır…</span>;
  if (state === "saved")
    return <span style={{ ...base, color: "#065F46" }}><Dot color="#065F46" /> Saxlanıldı{time ? ` · ${time}` : ""}</span>;
  if (state === "error")
    return (
      <span style={{ ...base, color: "#991B1B" }}>
        <Dot color="#991B1B" /> Saxlanılmadı
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginLeft: 4,
            fontSize: 12,
            fontWeight: 700,
            color: "#991B1B",
            background: "transparent",
            border: "1px solid #FECACA",
            borderRadius: 6,
            padding: "2px 8px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Yenidən cəhd et
        </button>
      </span>
    );
  return <span style={{ ...base, color: "var(--muted, #9AAFC4)" }}>Dəyişikliklər avtomatik saxlanılır</span>;
}

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        display: "inline-block",
        animation: pulse ? "pulse 1s ease-in-out infinite" : undefined,
      }}
    />
  );
}

// ─── Paperclip attach button — sits at the end of a question / option input ───
function IconPaperclip({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconTrash({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function AttachButton({
  url,
  onChange,
  uploadFile,
  title,
}: {
  url?: string;
  onChange: (url: string | undefined) => void;
  uploadFile: (file: File) => Promise<string>;
  title: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(false);
    try {
      onChange(await uploadFile(file));
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const attached = !!url;
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      <button
        type="button"
        className="btn sm ghost icon-only"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={err ? "Şəkil yüklənmədi — yenidən cəhd edin" : attached ? "Şəkli dəyiş" : title}
        style={{
          flexShrink: 0,
          color: err ? "#991B1B" : attached ? "var(--brand)" : undefined,
          opacity: busy ? 0.55 : 1,
        }}
      >
        <IconPaperclip size={15} />
      </button>
    </>
  );
}

// ─── Uploaded-image thumbnail with a remove control ───────────────────────────
function ImageThumb({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="wiz-pop" style={{ position: "relative", display: "inline-block" }}>
      { }
      <img
        src={url}
        alt=""
        style={{ maxWidth: 170, maxHeight: 110, borderRadius: 8, border: "1px solid var(--line, #DDE6F0)", objectFit: "cover", display: "block" }}
      />
      <button
        type="button"
        onClick={onRemove}
        title="Şəkli sil"
        style={{
          position: "absolute",
          top: -8,
          right: -8,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#fff",
          border: "1px solid var(--line, #DDE6F0)",
          color: "#991B1B",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      >
        <IconX size={11} />
      </button>
    </div>
  );
}

// ─── Step 1: Info ─────────────────────────────────────────────────────────────
function InfoStep(props: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  scoreBasis: "TOTAL" | "PERCENTAGE";
  setScoreBasis: (v: "TOTAL" | "PERCENTAGE") => void;
  showPublished: boolean;
  published: boolean;
  setPublished: (v: boolean) => void;
}) {
  return (
    <div className="card">
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Test başlığı">
          <input
            className="input"
            value={props.title}
            onChange={(e) => props.setTitle(e.target.value)}
            placeholder="Məsələn: Beck Depressiya Şkalası"
          />
        </Field>
        <Field label="Təsvir">
          <textarea
            className="textarea"
            value={props.description}
            onChange={(e) => props.setDescription(e.target.value)}
            placeholder="Testin qısa təsviri"
          />
        </Field>
        <Field label="Təlimat">
          <textarea
            className="textarea"
            value={props.instructions}
            onChange={(e) => props.setInstructions(e.target.value)}
            placeholder="İştirakçıya göstərilən təlimat"
          />
        </Field>
        <Field label="Hesablama üsulu">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SCORE_OPTIONS.map((opt) => {
              const active = props.scoreBasis === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => props.setScoreBasis(opt.value)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1.5px solid ${active ? "var(--brand)" : "var(--line)"}`,
                    background: active ? "var(--brand-50)" : "var(--surface, #fff)",
                    transition: "border-color .15s, background .15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        flexShrink: 0,
                        border: `2px solid ${active ? "var(--brand)" : "var(--muted)"}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brand)" }} />}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{opt.title}</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, paddingLeft: 24 }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {props.showPublished && (
          <Field label="Status">
            <div className="row" style={{ gap: 10, height: 38 }}>
              <button
                type="button"
                className={`switch${props.published ? " on" : ""}`}
                onClick={() => props.setPublished(!props.published)}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {props.published ? "Yayımlanıb" : "Qaralama"}
              </span>
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Questions ────────────────────────────────────────────────────────
function QuestionsStep(props: {
  questions: QuestionRow[];
  addQuestion: () => void;
  removeQuestion: (qi: number) => void;
  setQuestion: (qi: number, patch: Partial<QuestionRow>) => void;
  addOption: (qi: number) => void;
  removeOption: (qi: number, oi: number) => void;
  setOption: (qi: number, oi: number, patch: Partial<OptionRow>) => void;
  uploadFile: (file: File) => Promise<string>;
}) {
  return (
    <div className="card">
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              Suallar ({props.questions.length})
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.5, maxWidth: 480 }}>
              Hər sual üçün cavab variantlarını və onların balını təyin edin. Şəkil əlavə etmək
              üçün ataç <IconPaperclip size={11} /> ikonundan istifadə edin.
            </div>
          </div>
          <button type="button" className="btn sm" onClick={props.addQuestion}>
            <IconPlus size={13} /> Sual əlavə et
          </button>
        </div>

        {props.questions.map((q, qi) => (
          <div
            key={qi}
            className="wiz-pop"
            style={{
              border: "1px solid var(--line)",
              borderLeft: "3px solid var(--brand)",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "var(--surface-2)",
            }}
          >
            {/* Question header: number badge + image attach + delete */}
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--brand-700, #2F4A63)",
                  background: "var(--brand-50, #EEF4F9)",
                  padding: "4px 12px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                Sual {qi + 1}
              </span>
              <div className="row" style={{ gap: 6 }}>
                <AttachButton
                  url={q.imageUrl}
                  onChange={(u) => props.setQuestion(qi, { imageUrl: u })}
                  uploadFile={props.uploadFile}
                  title="Suala şəkil əlavə et"
                />
                <button
                  type="button"
                  className="btn sm danger icon-only"
                  title="Sualı sil"
                  onClick={() => props.removeQuestion(qi)}
                  disabled={props.questions.length <= 1}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>

            {/* Question text */}
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
                Sual mətni
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 60, width: "100%" }}
                value={q.text}
                onChange={(e) => props.setQuestion(qi, { text: e.target.value })}
                placeholder="Sualı buraya yazın…"
              />
              {q.imageUrl && (
                <div style={{ marginTop: 10 }}>
                  <ImageThumb url={q.imageUrl} onRemove={() => props.setQuestion(qi, { imageUrl: undefined })} />
                </div>
              )}
            </div>

            {/* Answer options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                  Cavab variantları ({q.options.length})
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Seçilən variantın balı nəticəyə əlavə olunur
                </div>
              </div>

              {q.options.map((o, oi) => (
                <div key={oi} className="wiz-pop" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: "var(--brand-50, #EEF4F9)",
                        color: "var(--brand-700, #2F4A63)",
                        fontSize: 12.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 0 }}
                      value={o.label}
                      onChange={(e) => props.setOption(qi, oi, { label: e.target.value })}
                      placeholder="Cavab variantı"
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 64 }}
                        value={o.points}
                        onChange={(e) =>
                          // Drop the leading placeholder zero as soon as a real digit is typed.
                          props.setOption(qi, oi, { points: e.target.value.replace(/^0+(?=\d)/, "") })
                        }
                        onBlur={(e) => {
                          if (e.target.value.trim() === "") props.setOption(qi, oi, { points: "0" });
                        }}
                        placeholder="0"
                      />
                      <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>bal</span>
                    </div>
                    <AttachButton
                      url={o.imageUrl}
                      onChange={(u) => props.setOption(qi, oi, { imageUrl: u })}
                      uploadFile={props.uploadFile}
                      title="Varianta şəkil əlavə et"
                    />
                    <button
                      type="button"
                      className="btn sm danger icon-only"
                      title="Variantı sil"
                      onClick={() => props.removeOption(qi, oi)}
                      disabled={q.options.length <= 1}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                  {o.imageUrl && (
                    <div style={{ paddingLeft: 36 }}>
                      <ImageThumb url={o.imageUrl} onRemove={() => props.setOption(qi, oi, { imageUrl: undefined })} />
                    </div>
                  )}
                </div>
              ))}

              <div>
                <button type="button" className="btn sm ghost" onClick={() => props.addOption(qi)}>
                  <IconPlus size={12} /> Variant əlavə et
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Scales ───────────────────────────────────────────────────────────
function ScalesStep(props: {
  scales: ScaleRow[];
  addScale: () => void;
  removeScale: (si: number) => void;
  setScale: (si: number, patch: Partial<ScaleRow>) => void;
  scoreBasis: "TOTAL" | "PERCENTAGE";
  rangeMax: number;
}) {
  const unit = props.scoreBasis === "PERCENTAGE" ? "%" : "bal";
  const bands = deriveBands(props.scales);
  const span = Math.max(props.rangeMax, ...bands.map((b) => b.to), 1);

  return (
    <div className="card">
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              Nəticə zolaqları ({props.scales.length})
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.5, maxWidth: 480 }}>
              İştirakçı yığdığı {props.scoreBasis === "PERCENTAGE" ? "faizə" : "bala"} görə bir zolağa düşür.
              Hər zolaq öncəkinin bitdiyi yerdən başlayır — yalnız <b>üst həddi</b> yazın. Bu addım məcburi deyil.
            </div>
          </div>
          <button type="button" className="btn sm" onClick={props.addScale}>
            <IconPlus size={13} /> Zolaq əlavə et
          </button>
        </div>

        {props.scales.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--line)",
              borderRadius: 10,
              padding: "22px 16px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.7,
              background: "var(--surface-2)",
            }}
          >
            Hələ zolaq yoxdur. Nümunə: <b style={{ color: "#16A34A" }}>0–13 Minimal</b> ·{" "}
            <b style={{ color: "#CA8A04" }}>14–19 Yüngül</b> · <b style={{ color: "#DC2626" }}>20–28 Orta</b>
            <br />
            İstəsəniz bu addımı keçə bilərsiniz.
          </div>
        ) : (
          <>
            {/* Live severity bar — the whole scale at a glance. */}
            <div>
              <div
                style={{
                  display: "flex",
                  height: 34,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--line)",
                }}
              >
                {props.scales.map((s, si) => {
                  const b = bands[si];
                  const w = Math.max(1, b.to - b.from + 1);
                  return (
                    <div
                      key={si}
                      title={`${b.from}–${b.to} ${s.label}`}
                      style={{
                        flex: w,
                        minWidth: 0,
                        background: s.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "0 6px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.label || (b.to >= b.from ? `${b.from}–${b.to}` : `${b.from}+`)}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
                <span>0</span>
                <span>
                  {span} {unit}
                </span>
              </div>
            </div>

            {/* Band editors — one number (upper bound) per band. */}
            {props.scales.map((s, si) => {
              const b = bands[si];
              return (
                <div
                  key={si}
                  className="wiz-pop"
                  style={{
                    border: "1px solid var(--line)",
                    borderLeft: `4px solid ${s.color}`,
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "var(--surface-2)",
                  }}
                >
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      title="Rəngi dəyiş"
                      onClick={() => props.setScale(si, { color: nextColor(s.color) })}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: s.color,
                        border: "2px solid #fff",
                        boxShadow: "0 0 0 1px var(--line)",
                        cursor: "pointer",
                        flexShrink: 0,
                        padding: 0,
                      }}
                    />
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      value={s.label}
                      onChange={(e) => props.setScale(si, { label: e.target.value })}
                      placeholder="Zolaq adı (məs: Yüngül)"
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>bu {unit}-a qədər</span>
                      <input
                        className="input"
                        type="number"
                        min={b.from}
                        style={{ width: 82 }}
                        value={s.upTo}
                        onChange={(e) => props.setScale(si, { upTo: e.target.value })}
                        onBlur={(e) => {
                          // The upper bound can never sit below where this band
                          // starts (i.e. below the previous band's limit).
                          const v = e.target.value.trim();
                          if (v !== "" && Number(v) < b.from) props.setScale(si, { upTo: String(b.from) });
                        }}
                        placeholder="Üst"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn sm danger icon-only"
                      title="Zolağı sil"
                      onClick={() => props.removeScale(si)}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 28 }}>
                    Aralıq:{" "}
                    {s.upTo.trim() === "" ? (
                      <b style={{ color: "var(--ink)" }}>{b.from}-dən yuxarı</b>
                    ) : (
                      <b style={{ color: b.to < b.from ? "#DC2626" : "var(--ink)" }}>
                        {b.from}–{b.to} {unit}
                      </b>
                    )}
                  </div>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 48 }}
                    value={s.description}
                    onChange={(e) => props.setScale(si, { description: e.target.value })}
                    placeholder="Nəticə təsviri (məs: Yüngül depressiya əlamətləri)"
                  />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Preview (renders like the patient take view) ─────────────────────
function PreviewStep(props: {
  title: string;
  description: string;
  instructions: string;
  scoreBasis: "TOTAL" | "PERCENTAGE";
  questions: QuestionRow[];
  scales: ScaleRow[];
  onEdit: (step: number) => void;
}) {
  const scaleBands = deriveBands(props.scales);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
              {props.title || "Adsız test"}
            </div>
            <button type="button" className="btn sm ghost" onClick={() => props.onEdit(0)}>
              Redaktə et
            </button>
          </div>
          {props.description && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>{props.description}</div>
          )}
          {props.instructions && (
            <div
              style={{
                fontSize: 13,
                color: "var(--ink)",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "10px 14px",
                lineHeight: 1.6,
              }}
            >
              {props.instructions}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              Suallar ({props.questions.length})
            </div>
            <button type="button" className="btn sm ghost" onClick={() => props.onEdit(1)}>
              Redaktə et
            </button>
          </div>
          {props.questions.map((q, qi) => (
            <div key={qi} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {qi + 1}. {q.text || <span style={{ color: "var(--muted)" }}>(boş sual)</span>}
              </div>
              {q.imageUrl && (
                 
                <img
                  src={q.imageUrl}
                  alt=""
                  style={{ maxWidth: 320, maxHeight: 200, borderRadius: 8, border: "1px solid var(--line)", objectFit: "cover" }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {q.options.map((o, oi) => (
                  <div
                    key={oi}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        border: "2px solid var(--muted)",
                        flexShrink: 0,
                      }}
                    />
                    {o.imageUrl && (
                       
                      <img
                        src={o.imageUrl}
                        alt=""
                        style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    )}
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>
                      {o.label || <span style={{ color: "var(--muted)" }}>(boş variant)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              Bal şkalaları ({props.scales.length})
            </div>
            <button type="button" className="btn sm ghost" onClick={() => props.onEdit(2)}>
              Redaktə et
            </button>
          </div>
          {props.scales.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Nəticə zolağı təyin edilməyib.</div>
          ) : (
            props.scales.map((s, si) => {
              const b = scaleBands[si];
              return (
                <div
                  key={si}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    borderLeft: `4px solid ${s.color}`,
                    background: "var(--surface-2)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", minWidth: 84 }}>
                    {b.from}–{b.to}
                  </span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{s.label || "—"}</div>
                    {s.description && (
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{s.description}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
