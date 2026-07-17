"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { psychologistApi, type PsyTest } from "@/lib/api";

export default function PsyTestPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [test, setTest] = useState<PsyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError("Yanlış test nömrəsi"); setLoading(false); return; }
    psychologistApi
      .previewTest(id)
      .then((t) => { setTest(t); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const questions = test ? [...test.questions].sort((a, b) => a.displayOrder - b.displayOrder) : [];

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/psycholog/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>← Testlərə qayıt</Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: "8px 0 2px" }}>Önizləmə</h1>
        <p style={{ fontSize: 12.5, color: "#52718F", margin: 0 }}>İştirakçının gördüyü kimi</p>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : error || !test ? (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 18, borderRadius: 14, fontSize: 13 }}>
          {error ?? "Test tapılmadı."}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #EEF2F7", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: 0, lineHeight: 1.3 }}>{test.title}</h2>
            {test.description && (
              <p style={{ fontSize: 13.5, color: "#52718F", margin: "6px 0 0", lineHeight: 1.6 }}>{test.description}</p>
            )}
          </div>
          {test.instructions && (
            <div style={{ fontSize: 13, color: "#1A2535", background: "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 10, padding: "10px 14px", lineHeight: 1.6 }}>
              {test.instructions}
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1A2535" }}>
                {qi + 1}. {q.text}
              </div>
              {q.imageUrl && (
                 
                <img src={q.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10, border: "1px solid #EEF2F7", objectFit: "contain", display: "block" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...q.options].sort((a, b) => a.displayOrder - b.displayOrder).map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, border: "2px solid #9AAFC4", flexShrink: 0 }} />
                    {o.imageUrl && (
                       
                      <img src={o.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid #E5E7EB" }} />
                    )}
                    <span style={{ fontSize: 13.5, color: "#1A2535" }}>{o.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
