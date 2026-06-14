"use client";

import { useState } from "react";
import type {
  PsyTest,
  PsyTestReq,
  PsyQuestionReq,
  PsyOptionReq,
  PsyScaleReq,
} from "@/lib/api";
import { IconPlus, IconX } from "@/app/admin/_components/icons";

// ─── Local editable shapes ──────────────────────────────────────────────────
// We keep questions/options/scales as plain editable rows. displayOrder is
// derived from the array index on submit, so we never store it here.

type OptionRow = { label: string; points: string };
type QuestionRow = { text: string; options: OptionRow[] };
type ScaleRow = {
  label: string;
  minScore: string;
  maxScore: string;
  description: string;
};

function toRows(initial?: PsyTest | null): {
  questions: QuestionRow[];
  scales: ScaleRow[];
} {
  if (!initial) {
    return {
      questions: [{ text: "", options: [{ label: "", points: "0" }] }],
      scales: [],
    };
  }
  const questions = [...initial.questions]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((q) => ({
      text: q.text,
      options: [...q.options]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((o) => ({ label: o.label, points: String(o.points) })),
    }));
  const scales = [...initial.scales]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => ({
      label: s.label,
      minScore: String(s.minScore),
      maxScore: String(s.maxScore),
      description: s.description ?? "",
    }));
  return {
    questions: questions.length
      ? questions
      : [{ text: "", options: [{ label: "", points: "0" }] }],
    scales,
  };
}

export default function PsychTestBuilder({
  initial,
  onSubmit,
}: {
  initial?: PsyTest | null;
  onSubmit: (data: PsyTestReq) => Promise<void>;
}) {
  const seed = toRows(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [scoreBasis, setScoreBasis] = useState<"TOTAL" | "PERCENTAGE">(
    initial?.scoreBasis === "PERCENTAGE" ? "PERCENTAGE" : "TOTAL"
  );
  const [published, setPublished] = useState(initial?.published ?? false);
  const [questions, setQuestions] = useState<QuestionRow[]>(seed.questions);
  const [scales, setScales] = useState<ScaleRow[]>(seed.scales);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Question mutations ────────────────────────────────────────────────────
  const addQuestion = () =>
    setQuestions((qs) => [...qs, { text: "", options: [{ label: "", points: "0" }] }]);

  const removeQuestion = (qi: number) =>
    setQuestions((qs) => qs.filter((_, i) => i !== qi));

  const setQuestionText = (qi: number, text: string) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, text } : q)));

  const addOption = (qi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, options: [...q.options, { label: "", points: "0" }] } : q
      )
    );

  const removeOption = (qi: number, oi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q
      )
    );

  const setOption = (qi: number, oi: number, patch: Partial<OptionRow>) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi
          ? {
              ...q,
              options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
            }
          : q
      )
    );

  // ── Scale mutations ───────────────────────────────────────────────────────
  const addScale = () =>
    setScales((ss) => [
      ...ss,
      { label: "", minScore: "0", maxScore: "0", description: "" },
    ]);

  const removeScale = (si: number) =>
    setScales((ss) => ss.filter((_, i) => i !== si));

  const setScale = (si: number, patch: Partial<ScaleRow>) =>
    setScales((ss) => ss.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Test başlığı boş ola bilməz.");
      return;
    }
    if (questions.length < 1) {
      setError("Ən azı bir sual əlavə edin.");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`${i + 1}-ci sualın mətni boş ola bilməz.`);
        return;
      }
      if (q.options.length < 1) {
        setError(`${i + 1}-ci sualda ən azı bir variant olmalıdır.`);
        return;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].label.trim()) {
          setError(`${i + 1}-ci sualın ${j + 1}-ci variantı boş ola bilməz.`);
          return;
        }
      }
    }
    for (let i = 0; i < scales.length; i++) {
      if (!scales[i].label.trim()) {
        setError(`${i + 1}-ci şkalanın adı boş ola bilməz.`);
        return;
      }
    }

    const reqQuestions: PsyQuestionReq[] = questions.map((q, qi) => ({
      text: q.text.trim(),
      displayOrder: qi,
      options: q.options.map(
        (o, oi): PsyOptionReq => ({
          label: o.label.trim(),
          points: Number(o.points) || 0,
          displayOrder: oi,
        })
      ),
    }));

    const reqScales: PsyScaleReq[] = scales.map(
      (s, si): PsyScaleReq => ({
        label: s.label.trim(),
        minScore: Number(s.minScore) || 0,
        maxScore: Number(s.maxScore) || 0,
        description: s.description.trim() || undefined,
        displayOrder: si,
      })
    );

    const data: PsyTestReq = {
      title: title.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      scoreBasis,
      published,
      questions: reqQuestions,
      scales: reqScales,
    };

    setSaving(true);
    try {
      await onSubmit(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── General ── */}
      <div className="card">
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Test başlığı">
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Məsələn: Beck Depressiya Şkalası"
            />
          </Field>

          <Field label="Təsvir">
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Testin qısa təsviri"
            />
          </Field>

          <Field label="Təlimat">
            <textarea
              className="textarea"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="İştirakçıya göstərilən təlimat"
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Hesablama üsulu">
              <select
                className="select"
                value={scoreBasis}
                onChange={(e) => setScoreBasis(e.target.value as "TOTAL" | "PERCENTAGE")}
              >
                <option value="TOTAL">TOTAL — ümumi bal</option>
                <option value="PERCENTAGE">PERCENTAGE — faiz</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                TOTAL = toplanmış ümumi bala görə nəticə. PERCENTAGE = maksimal
                bala nisbətdə faizlə nəticə.
              </div>
            </Field>

            <Field label="Status">
              <div className="row" style={{ gap: 10, height: 38 }}>
                <button
                  type="button"
                  className={`switch${published ? " on" : ""}`}
                  onClick={() => setPublished((v) => !v)}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  {published ? "Yayımlanıb" : "Qaralama"}
                </span>
              </div>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Questions ── */}
      <div className="card">
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              Suallar ({questions.length})
            </div>
            <button type="button" className="btn sm" onClick={addQuestion}>
              <IconPlus size={13} /> Sual əlavə et
            </button>
          </div>

          {questions.map((q, qi) => (
            <div
              key={qi}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                background: "var(--surface-2)",
              }}
            >
              <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--muted)",
                    marginTop: 9,
                    minWidth: 22,
                  }}
                >
                  #{qi + 1}
                </span>
                <textarea
                  className="textarea"
                  style={{ minHeight: 56, flex: 1 }}
                  value={q.text}
                  onChange={(e) => setQuestionText(qi, e.target.value)}
                  placeholder="Sual mətni"
                />
                <button
                  type="button"
                  className="btn sm danger icon-only"
                  title="Sualı sil"
                  onClick={() => removeQuestion(qi)}
                  disabled={questions.length <= 1}
                >
                  <IconX size={13} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 30 }}>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
                  Variantlar (cavab + bal)
                </div>
                {q.options.map((o, oi) => (
                  <div key={oi} className="row" style={{ gap: 8 }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      value={o.label}
                      onChange={(e) => setOption(qi, oi, { label: e.target.value })}
                      placeholder="Variant mətni"
                    />
                    <input
                      className="input"
                      type="number"
                      style={{ width: 90 }}
                      value={o.points}
                      onChange={(e) => setOption(qi, oi, { points: e.target.value })}
                      placeholder="Bal"
                    />
                    <button
                      type="button"
                      className="btn sm danger icon-only"
                      title="Variantı sil"
                      onClick={() => removeOption(qi, oi)}
                      disabled={q.options.length <= 1}
                    >
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
                <div>
                  <button type="button" className="btn sm ghost" onClick={() => addOption(qi)}>
                    <IconPlus size={12} /> Variant əlavə et
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scales ── */}
      <div className="card">
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                Bal şkalaları ({scales.length})
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                Yığılan bal aralığına görə nəticə təsviri.
              </div>
            </div>
            <button type="button" className="btn sm" onClick={addScale}>
              <IconPlus size={13} /> Şkala əlavə et
            </button>
          </div>

          {scales.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 0" }}>
              Hələ şkala yoxdur.
            </div>
          )}

          {scales.map((s, si) => (
            <div
              key={si}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "var(--surface-2)",
              }}
            >
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={s.label}
                  onChange={(e) => setScale(si, { label: e.target.value })}
                  placeholder="Şkala adı (məs: Yüngül)"
                />
                <input
                  className="input"
                  type="number"
                  style={{ width: 100 }}
                  value={s.minScore}
                  onChange={(e) => setScale(si, { minScore: e.target.value })}
                  placeholder="Min bal"
                />
                <input
                  className="input"
                  type="number"
                  style={{ width: 100 }}
                  value={s.maxScore}
                  onChange={(e) => setScale(si, { maxScore: e.target.value })}
                  placeholder="Maks bal"
                />
                <button
                  type="button"
                  className="btn sm danger icon-only"
                  title="Şkalanı sil"
                  onClick={() => removeScale(si)}
                >
                  <IconX size={13} />
                </button>
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 56 }}
                value={s.description}
                onChange={(e) => setScale(si, { description: e.target.value })}
                placeholder="Nəticə təsviri"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#8b3d35",
            background: "var(--rose-bg)",
            border: "1px solid #ddc2bf",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <a className="btn" href="/admin/tests">
          Ləğv et
        </a>
        <button type="button" className="btn primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saxlanır…" : "Saxla"}
        </button>
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
