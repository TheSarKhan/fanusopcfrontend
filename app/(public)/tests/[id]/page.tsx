"use client";

// Publik test doldurma — qeydiyyat tələb olunmur. Cavab göndəriləndə NƏTİCƏ QAYTARILMIR:
// server yalnız claimToken verir, istifadəçi nəticə səhifəsinə yönləndirilir və orada
// pasiyent kimi qeydiyyat/giriş tələb olunur.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useRouter } from "next/navigation";
import { getPublicCatalogTest, submitPublicCatalogTest, type TakeTest } from "@/lib/api";
import { stripLeadingNumber } from "@/lib/testQuestion";
import { savePendingClaim } from "@/lib/pendingTestClaim";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PublicTakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const testId = Number(id);
  const router = useRouter();
  const { t } = useT();

  const [test, setTest] = useState<TakeTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(testId)) { setError(t("testsPage.notFound")); setLoading(false); return; }
    getPublicCatalogTest(testId)
      .then(setTest)
      .catch(() => setError(t("testsPage.notFoundOrUnpublished")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const total = test?.questions.length ?? 0;
  const answered = Object.keys(answers).length;
  const ready = total > 0 && answered === total;

  const submit = async () => {
    if (!ready || busy || !test) return;
    setBusy(true);
    try {
      const res = await submitPublicCatalogTest(testId, {
        answers: test.questions.map(q => ({ questionId: q.id, selectedOptionId: answers[q.id] })),
      });
      // Token brauzerdə saxlanılır ki, qeydiyyatdan sonra nəticə avtomatik açılsın.
      // Cookie ilə saxlanılır: panel ayrı alt-domendədir, localStorage ora çatmır.
      savePendingClaim(res.claimToken);
      // Kriz bayrağı URL ilə ötürülür: nəticə qeydiyyatın arxasındadır, amma
      // təcili dəstək məlumatı qeydiyyatsız da dərhal görünməlidir.
      const crisisParam = res.crisis ? "&crisis=1" : "";
      router.push(`/tests/${testId}/result?token=${encodeURIComponent(res.claimToken)}${crisisParam}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("testsPage.submitFailed"));
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="fanus-container" style={{ padding: "80px 0", textAlign: "center", color: "var(--oxford-60)" }}>{t("common.loading")}</div>;
  }
  if (error || !test) {
    return (
      <div className="fanus-container" style={{ padding: "80px 0", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--oxford)", marginBottom: 12 }}>{error ?? t("testsPage.notFound")}</p>
        <Link href="/tests" style={{ color: "var(--brand)", fontWeight: 600 }}>← {t("testsPage.backToTests")}</Link>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: t("nav.tests"), href: "/tests" }, { label: test.title }]} />
      <div className="fanus-container" style={{ padding: "8px 0 72px", maxWidth: 760 }}>
      <h1 style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif", fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.12, color: "var(--fanus-ink)", margin: "10px 0 12px" }}>{test.title}</h1>
      {test.description && <p style={{ fontSize: 15, color: "var(--oxford-60)", lineHeight: 1.6, margin: "0 0 8px" }}>{test.description}</p>}
      {test.instructions && (
        <div style={{ background: "#F1F6FE", border: "1px solid #DCE8FB", borderRadius: 12, padding: "12px 16px", fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.55, margin: "0 0 24px" }}>
          {test.instructions}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {test.questions.map((q, qi) => (
          <div key={q.id} style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 12, lineHeight: 1.45 }}>
              {qi + 1}. {stripLeadingNumber(q.text)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.options.map(o => {
                const selected = answers[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setAnswers(a => ({ ...a, [q.id]: o.id }))}
                    style={{
                      textAlign: "left", padding: "11px 14px", borderRadius: 10, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
                      border: selected ? "2px solid var(--brand)" : "1px solid #D6E2F7",
                      background: selected ? "#F1F6FE" : "#fff",
                      color: "var(--oxford)", fontWeight: selected ? 600 : 500,
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "linear-gradient(to top, #fff 60%, transparent)", padding: "20px 0 8px", marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 600 }}>{t("testsPage.answeredOf", { a: answered, t: total })}</span>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || busy}
            className="fanus-btn fanus-btn-primary"
            style={{ opacity: !ready || busy ? 0.55 : 1, cursor: !ready || busy ? "not-allowed" : "pointer" }}
          >
            {busy ? t("common.sending") : t("testsPage.finishCta")}
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--oxford-60)", margin: "10px 0 0" }}>
          {t("testsPage.registerNote")}
        </p>
      </div>
      </div>
    </>
  );
}
