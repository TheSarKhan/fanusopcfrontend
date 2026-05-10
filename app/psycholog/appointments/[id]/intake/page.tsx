"use client";

import { useEffect, useState, use } from "react";
import { psychologistApi, type AppointmentIntake, type IntakeDuration } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

const DUR_KEY: Record<IntakeDuration, "intake.dur_LT_1M" | "intake.dur_M_1_3" | "intake.dur_M_3_6" | "intake.dur_GT_6M"> = {
  LT_1M: "intake.dur_LT_1M",
  M_1_3: "intake.dur_M_1_3",
  M_3_6: "intake.dur_M_3_6",
  GT_6M: "intake.dur_GT_6M",
};

export default function PsyIntakeViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const apptId = Number(id);
  const { t } = useT();

  const [loading, setLoading] = useState(true);
  const [intake, setIntake] = useState<AppointmentIntake | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    psychologistApi.getAppointmentIntake(apptId)
      .then(setIntake)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [apptId]);

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
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A2535" }}>{t("intake.psyTitle")}</h1>
      {intake?.submittedAt && (
        <p style={{ color: "#52718F", fontSize: 12, marginTop: 4, marginBottom: 24 }}>
          {t("intake.submittedAt", { date: new Date(intake.submittedAt).toLocaleString() })}
        </p>
      )}

      {err && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {!intake ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          {t("intake.psyEmpty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Block title={t("intake.sectionMain")}>
            <Row label={t("intake.mainConcern")} value={intake.mainConcern} />
            <Row label={t("intake.expectations")} value={intake.expectations} />
          </Block>
          <Block title={t("intake.sectionSymptoms")}>
            <Row label={t("intake.symptoms")} value={intake.symptoms} />
            <Row label={t("intake.duration")}
              value={intake.duration ? t(DUR_KEY[intake.duration]) : null} />
          </Block>
          <Block title={t("intake.sectionHistory")}>
            <Row label={t("intake.priorTherapyQ")}
              value={intake.priorTherapy ? t("intake.yes") : t("intake.no")} />
            {intake.priorTherapy && intake.priorTherapyDetails && (
              <Row label={t("intake.priorTherapyDetails")} value={intake.priorTherapyDetails} />
            )}
            <Row label={t("intake.medications")} value={intake.medications} />
            <Row label={t("intake.medicalConditions")} value={intake.medicalConditions} />
          </Block>
          {intake.emergencyContact && (
            <Block title={t("intake.sectionEmergency")}>
              <Row label={t("intake.emergencyContact")} value={intake.emergencyContact} />
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18,
      boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)",
        textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ borderBottom: "1px solid var(--brand-50)", paddingBottom: 8 }}>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1A2535", whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}
