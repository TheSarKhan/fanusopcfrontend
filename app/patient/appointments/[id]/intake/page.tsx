"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { patientApi, type AppointmentIntakeRequest, type IntakeDuration } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const DURATIONS: IntakeDuration[] = ["LT_1M", "M_1_3", "M_3_6", "GT_6M"];

export default function PatientIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const apptId = Number(id);
  const { t } = useT();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const [form, setForm] = useState<AppointmentIntakeRequest>({
    mainConcern: "",
    expectations: "",
    symptoms: "",
    duration: "",
    priorTherapy: false,
    priorTherapyDetails: "",
    medications: "",
    medicalConditions: "",
    emergencyContact: "",
  });

  useEffect(() => {
    patientApi.getIntake(apptId)
      .then(existing => {
        if (existing) {
          setForm({
            mainConcern: existing.mainConcern ?? "",
            expectations: existing.expectations ?? "",
            symptoms: existing.symptoms ?? "",
            duration: existing.duration ?? "",
            priorTherapy: existing.priorTherapy,
            priorTherapyDetails: existing.priorTherapyDetails ?? "",
            medications: existing.medications ?? "",
            medicalConditions: existing.medicalConditions ?? "",
            emergencyContact: existing.emergencyContact ?? "",
          });
          setSubmittedAt(existing.submittedAt);
        }
      })
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [apptId]);

  const update = <K extends keyof AppointmentIntakeRequest>(k: K, v: AppointmentIntakeRequest[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const dto = await patientApi.submitIntake(apptId, {
        ...form,
        duration: form.duration === "" ? undefined : form.duration,
      });
      setSubmittedAt(dto.submittedAt);
      router.push("/patient/appointments");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A2535" }}>{t("intake.pageTitle")}</h1>
      <p style={{ color: "#52718F", fontSize: 14, marginTop: 4, marginBottom: 8 }}>
        {t("intake.pageSub")}
      </p>
      {submittedAt && (
        <p style={{ color: "#52718F", fontSize: 12, marginBottom: 24 }}>
          {t("intake.submittedAt", { date: new Date(submittedAt).toLocaleString() })}
        </p>
      )}

      {err && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {err}
        </div>
      )}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Section title={t("intake.sectionMain")}>
          <Field label={t("intake.mainConcern")}>
            <textarea rows={3} value={form.mainConcern}
              onChange={e => update("mainConcern", e.target.value)}
              placeholder={t("intake.mainConcernPh")} style={ta} />
          </Field>
          <Field label={t("intake.expectations")}>
            <textarea rows={2} value={form.expectations}
              onChange={e => update("expectations", e.target.value)}
              placeholder={t("intake.expectationsPh")} style={ta} />
          </Field>
        </Section>

        <Section title={t("intake.sectionSymptoms")}>
          <Field label={t("intake.symptoms")}>
            <textarea rows={2} value={form.symptoms}
              onChange={e => update("symptoms", e.target.value)}
              placeholder={t("intake.symptomsPh")} style={ta} />
          </Field>
          <Field label={t("intake.duration")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DURATIONS.map(d => {
                const active = form.duration === d;
                return (
                  <button key={d} type="button"
                    onClick={() => update("duration", active ? "" : d)}
                    style={{
                      padding: "8px 14px", borderRadius: 999,
                      border: active ? "1.5px solid var(--brand)" : "1.5px solid var(--brand-200)",
                      background: active ? "var(--brand-50)" : "#fff",
                      color: active ? "var(--brand-700)" : "#1A2535",
                      fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer",
                    }}>
                    {t(`intake.dur_${d}` as `intake.dur_LT_1M` | `intake.dur_M_1_3` | `intake.dur_M_3_6` | `intake.dur_GT_6M`)}
                  </button>
                );
              })}
            </div>
          </Field>
        </Section>

        <Section title={t("intake.sectionHistory")}>
          <Field label={t("intake.priorTherapyQ")}>
            <div style={{ display: "flex", gap: 8 }}>
              <Toggle on={form.priorTherapy === true} label={t("intake.yes")}
                onClick={() => update("priorTherapy", true)} />
              <Toggle on={form.priorTherapy === false} label={t("intake.no")}
                onClick={() => update("priorTherapy", false)} />
            </div>
          </Field>
          {form.priorTherapy && (
            <Field label={t("intake.priorTherapyDetails")}>
              <textarea rows={2} value={form.priorTherapyDetails}
                onChange={e => update("priorTherapyDetails", e.target.value)}
                placeholder={t("intake.priorTherapyDetailsPh")} style={ta} />
            </Field>
          )}
          <Field label={t("intake.medications")}>
            <textarea rows={2} value={form.medications}
              onChange={e => update("medications", e.target.value)}
              placeholder={t("intake.medicationsPh")} style={ta} />
          </Field>
          <Field label={t("intake.medicalConditions")}>
            <textarea rows={2} value={form.medicalConditions}
              onChange={e => update("medicalConditions", e.target.value)}
              placeholder={t("intake.medicalConditionsPh")} style={ta} />
          </Field>
        </Section>

        <Section title={t("intake.sectionEmergency")}>
          <Field label={t("intake.emergencyContact")}>
            <input type="text" value={form.emergencyContact}
              onChange={e => update("emergencyContact", e.target.value)}
              placeholder={t("intake.emergencyContactPh")} style={inp} />
          </Field>
        </Section>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button type="submit" disabled={submitting}
            style={{
              background: "var(--brand)", color: "#fff", border: "none",
              padding: "12px 22px", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}>
            {submitting ? t("intake.submitting") : t("intake.submitCta")}
          </button>
          <a href="/patient/appointments" style={{
              background: "transparent", color: "#1A2535",
              border: "1.5px solid var(--brand-200)",
              padding: "11px 20px", borderRadius: 10,
              fontSize: 14, fontWeight: 500, textDecoration: "none",
            }}>
            {t("intake.backToAppt")}
          </a>
        </div>
      </form>
    </div>
  );
}

const ta: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid var(--brand-100)", fontSize: 14, fontFamily: "inherit",
  resize: "vertical", color: "#1A2535", background: "#fff",
};
const inp: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid var(--brand-100)", fontSize: 14,
  color: "#1A2535", background: "#fff",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18,
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford-60)",
        textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#1A2535" }}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: "8px 18px", borderRadius: 999,
        border: on ? "1.5px solid var(--brand)" : "1.5px solid var(--brand-200)",
        background: on ? "var(--brand-50)" : "#fff",
        color: on ? "var(--brand-700)" : "#1A2535",
        fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", minWidth: 80,
      }}>
      {label}
    </button>
  );
}
