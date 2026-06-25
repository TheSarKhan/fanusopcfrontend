"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import "@/app/admin/admin.css";
import { psychologistApi, type PsyTest } from "@/lib/api";
import PsychTestBuilder from "@/components/PsychTestBuilder";

export default function PsyEditTestPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [test, setTest] = useState<PsyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError("Yanlış test nömrəsi"); setLoading(false); return; }
    psychologistApi.myTest(id)
      .then(t => { setTest(t); setError(null); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <a href="/psycholog/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>← Testlərə qayıt</a>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 0" }}>Testi redaktə et</h1>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : error || !test ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>
          {error ?? "Test tapılmadı."}
        </div>
      ) : (
        <div className="admin-shell">
          <PsychTestBuilder
            hidePublished
            initial={test}
            onSubmit={(d) => psychologistApi.updateMyTest(id, d).then(() => router.push("/psycholog/tests"))}
          />
        </div>
      )}
    </div>
  );
}
