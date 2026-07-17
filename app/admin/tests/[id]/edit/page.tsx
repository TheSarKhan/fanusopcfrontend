"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminApi, type PsyTest } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";

export default function EditTestPage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<PsyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    adminApi
      .getPsychTest(Number(id))
      .then(setTest)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      </div>
    );
  }

  if (notFound || !test) {
    return (
      <div className="page">
        <div style={{ padding: 60, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Test tapılmadı</p>
          <a className="btn" href="/admin/tests">← Testlərə qayıt</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Testi redaktə et</h1>
          <p className="page-sub">{test.title}</p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href="/admin/tests">← Testlərə qayıt</a>
        </div>
      </div>

      <PsychTestWizard
        showPublished
        initial={test}
        doneHref="/admin/tests"
        api={{
          createDraft: adminApi.createPsychTestDraft,
          saveDraft: adminApi.savePsychTestDraft,
          publish: adminApi.publishPsychTest,
          uploadFile: adminApi.uploadFile,
        }}
      />
    </div>
  );
}
