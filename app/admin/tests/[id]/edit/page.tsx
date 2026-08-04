"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminApi, type PsyTest } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";

export default function AdminEditTestPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [test, setTest] = useState<PsyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError("Yanlış test nömrəsi"); setLoading(false); return; }
    adminApi.getPsychTest(id)
      .then(t => { setTest(t); setError(null); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>← Psixoloji testlərə qayıt</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 0" }}>Testi redaktə et</h1>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : error || !test ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>
          {error ?? "Test tapılmadı."}
        </div>
      ) : (
        <PsychTestWizard
          initial={test}
          showPublished
          doneHref="/admin/tests"
          api={{
            createDraft: adminApi.createPsychTestDraft,
            saveDraft: adminApi.savePsychTestDraft,
            publish: adminApi.publishPsychTest,
            uploadFile: adminApi.uploadFile,
          }}
        />
      )}
    </div>
  );
}
