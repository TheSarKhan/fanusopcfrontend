import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import { getPublicTestCatalog } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Psixoloji testlər — Fanus",
  description: "Fanus mütəxəssislərinin hazırladığı psixoloji testlər — pulsuz doldurun, nəticənizi hesabınızda görün.",
};

export default async function PublicTestsPage() {
  const tests = await getPublicTestCatalog().catch(() => []);

  return (
    <>
      <Breadcrumb items={[{ label: "Testlər" }]} />
      <div className="fanus-container" style={{ padding: "16px 0 72px" }}>
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600, color: "var(--oxford)", margin: "0 0 12px" }}>
          Psixoloji testlər
        </h1>
        <p style={{ fontSize: 16, color: "var(--oxford-60)", lineHeight: 1.6, margin: 0 }}>
          Mütəxəssislərimizin hazırladığı testləri pulsuz doldurun. Nəticənizi görmək üçün
          qeydiyyatdan keçmək kifayətdir — nəticə hesabınızda saxlanılır.
        </p>
      </div>

      {tests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "#F8FAFD", border: "1px dashed #D6E2F7", borderRadius: 16, color: "var(--oxford-60)" }}>
          Hazırda yayımlanmış test yoxdur — tezliklə əlavə olunacaq.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {tests.map((t) => (
            <Link
              key={t.id}
              href={`/tests/${t.id}`}
              style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #EDF1F8", borderRadius: 16, padding: 22, textDecoration: "none", boxShadow: "0 2px 10px rgba(16,81,183,.05)" }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--oxford)", margin: "0 0 8px", lineHeight: 1.35 }}>{t.title}</h2>
              {t.description && (
                <p style={{ fontSize: 13.5, color: "var(--oxford-60)", lineHeight: 1.55, margin: "0 0 14px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {t.description}
                </p>
              )}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>{t.questionCount} sual</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>Testə başla →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
