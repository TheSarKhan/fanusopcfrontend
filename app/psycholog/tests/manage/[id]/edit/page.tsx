"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import "@/app/admin/admin.css";
import { psychologistApi, type PsyTest } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PsyEditTestPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [test, setTest] = useState<PsyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError(t("psyTestMgmt.invalidId")); setLoading(false); return; }
    psychologistApi.myTest(id)
      .then(tst => { setTest(tst); setError(null); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, t]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/psycholog/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>{t("psyTestMgmt.backToTests")}</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 0" }}>{t("psyTestMgmt.editTitle")}</h1>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>{t("psyTestMgmt.loading")}</div>
      ) : error || !test ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>
          {error ?? t("psyTestMgmt.notFound")}
        </div>
      ) : (
        <div className="admin-shell">
          <PsychTestWizard
            initial={test}
            doneHref="/psycholog/tests"
            api={{
              // Avtomatik qaralama saxlanması — popup açmasın (bax lib/loadingOverlay.ts).
              createDraft: () => psychologistApi.createMyTestDraft({ silent: true }),
              saveDraft: (id, data) => psychologistApi.saveMyTestDraft(id, data, { silent: true }),
              publish: psychologistApi.publishMyTest,
              uploadFile: psychologistApi.uploadFile,
            }}
          />
        </div>
      )}
    </div>
  );
}
