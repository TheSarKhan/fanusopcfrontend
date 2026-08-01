"use client";

/** Test kataloqunun görüntü hissəsi — data server komponentində alınır (page.tsx). */

import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import type { PublicTestCard } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function TestsCatalogView({ tests }: { tests: PublicTestCard[] }) {
  const { t } = useT();

  return (
    <>
      <Breadcrumb items={[{ label: t("nav.tests") }]} />
      <div className="fanus-container" style={{ padding: "16px 0 72px" }}>
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
        {/* Başlıq üslubu bloq/psixoloqlar hero-su ilə eynidir (poppins 800) — modullar
            arasında fərq olmasın. */}
        <h1 style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif", fontSize: "clamp(32px, 4.6vw, 54px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: "var(--fanus-ink)", margin: "0 0 16px" }}>
          {t("testsPage.title")}
        </h1>
        <p style={{ fontSize: 17, color: "var(--fanus-ink-3)", lineHeight: 1.6, margin: "0 auto", maxWidth: 600 }}>
          {t("testsPage.lead")}
        </p>
      </div>

      {tests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "#F8FAFD", border: "1px dashed #D6E2F7", borderRadius: 16, color: "var(--oxford-60)" }}>
          {t("testsPage.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {tests.map((item) => (
            <Link
              key={item.id}
              href={`/tests/${item.id}`}
              style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #EDF1F8", borderRadius: 16, padding: 22, textDecoration: "none", boxShadow: "0 2px 10px rgba(16,81,183,.05)" }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: "0 0 8px", lineHeight: 1.35 }}>{item.title}</h2>
              {item.description && (
                <p style={{ fontSize: 13.5, color: "var(--oxford-60)", lineHeight: 1.55, margin: "0 0 14px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.description}
                </p>
              )}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{t("testsPage.questionCount", { n: item.questionCount })}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>{t("testsPage.startCta")} →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
