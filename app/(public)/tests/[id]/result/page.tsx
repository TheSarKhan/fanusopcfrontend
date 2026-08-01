"use client";

// Test nəticəsi — QEYDİYYAT GATE-İ. Nəticə serverdə saxlanılıb, amma yalnız pasiyent
// hesabı ilə açılır: giriş varsa avtomatik "claim" olunur və göstərilir, yoxsa
// qeydiyyat/giriş CTA-sı çıxır (token brauzerdə saxlanılır, sonra avtomatik açılır).

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useSearchParams } from "next/navigation";
import { patientApi, tryGetMe, type PublicTestResult } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PublicTestResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const token = search.get("token");
  const { t } = useT();

  const [state, setState] = useState<"checking" | "locked" | "ready" | "error">("checking");
  const [result, setResult] = useState<PublicTestResult | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMessage(t("testsPage.linkMissing")); return; }
    try { localStorage.setItem("pendingTestClaim", token); } catch { /* private mode */ }

    let alive = true;
    (async () => {
      const me = await tryGetMe();
      if (!alive) return;
      if (!me || me.role !== "PATIENT") { setState("locked"); return; }
      try {
        const r = await patientApi.claimPublicTestResult(token);
        if (!alive) return;
        setResult(r); setState("ready");
        try { localStorage.removeItem("pendingTestClaim"); } catch { /* ignore */ }
      } catch (e) {
        if (!alive) return;
        setState("error");
        setMessage(e instanceof Error ? e.message : t("testsPage.errorTitle"));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const wrap = (children: React.ReactNode) => (
    <>
      <Breadcrumb items={[{ label: t("nav.tests"), href: "/tests" }, { label: t("pub.crumbResult") }]} />
      <div className="fanus-container" style={{ padding: "16px 0 72px", maxWidth: 620 }}>
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 18, padding: 32 }}>{children}</div>
      </div>
    </>
  );

  if (state === "checking") return wrap(<p style={{ textAlign: "center", color: "var(--oxford-60)", margin: 0 }}>{t("testsPage.checking")}</p>);

  if (state === "locked") {
    return wrap(
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#F1F6FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--oxford)", margin: "0 0 10px" }}>{t("testsPage.lockedTitle")}</h1>
        <p style={{ fontSize: 14.5, color: "var(--oxford-60)", lineHeight: 1.6, margin: "0 0 22px" }}>
          {t("testsPage.lockedBody")}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="fanus-btn fanus-btn-primary">{t("auth.registerCta")}</Link>
          <Link href="/login" className="fanus-btn fanus-btn-ghost">{t("auth.loginCta")}</Link>
        </div>
      </div>
    );
  }

  if (state === "error" || !result) {
    return wrap(
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--oxford)", margin: "0 0 10px" }}>{t("testsPage.errorTitle")}</h1>
        <p style={{ fontSize: 14, color: "var(--oxford-60)", margin: "0 0 20px" }}>{message || t("testsPage.errorBody")}</p>
        <Link href="/tests" className="fanus-btn fanus-btn-ghost">{t("testsPage.backToTests")}</Link>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, Number(result.percentage) || 0));
  return wrap(
    <div>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, margin: "0 0 6px" }}>{result.testTitle ?? t("testsPage.resultFallbackTitle")}</p>
        <div style={{ fontSize: 40, fontWeight: 800, color: "var(--oxford)", lineHeight: 1 }}>{result.totalScore}<span style={{ fontSize: 20, color: "var(--oxford-60)", fontWeight: 700 }}> / {result.maxScore}</span></div>
        {result.scaleLabel && (
          <div style={{ display: "inline-block", marginTop: 10, padding: "5px 14px", borderRadius: 999, background: "#F1F6FE", color: "var(--brand-700, #1051B7)", fontSize: 14, fontWeight: 700 }}>
            {result.scaleLabel}
          </div>
        )}
      </div>

      <div style={{ height: 10, background: "#F1F5FC", borderRadius: 999, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)" }} />
      </div>

      {result.scaleDescription && (
        <p style={{ fontSize: 14.5, color: "var(--oxford)", lineHeight: 1.65, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12, padding: 16, margin: "0 0 20px" }}>
          {result.scaleDescription}
        </p>
      )}

      <div style={{ background: "#F1F6FE", border: "1px solid #DCE8FB", borderRadius: 12, padding: 16, marginBottom: 22 }}>
        <p style={{ fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.6, margin: 0 }}>
          {t("testsPage.disclaimer")}
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/psychologists`} className="fanus-btn fanus-btn-primary">{t("testsPage.choosePsy")}</Link>
        <Link href="/patient" className="fanus-btn fanus-btn-ghost">{t("testsPage.myAccount")}</Link>
        <Link href={`/tests/${id}`} className="fanus-btn fanus-btn-ghost">{t("testsPage.retake")}</Link>
      </div>
    </div>
  );
}
