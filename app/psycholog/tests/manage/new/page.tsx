"use client";

import { useRouter } from "next/navigation";
// The test builder is styled by admin.css selectors scoped under `.admin-shell`,
// so importing it here is safe (rules only apply inside the wrapper below).
import "@/app/admin/admin.css";
import { psychologistApi } from "@/lib/api";
import PsychTestBuilder from "@/components/PsychTestBuilder";

export default function PsyNewTestPage() {
  const router = useRouter();

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <a href="/psycholog/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>← Testlərə qayıt</a>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 4px" }}>Yeni test</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
          Sual, variant və bal şkalalarını təyin edin. Test dərhal öz pasiyentlərinizə
          təyin oluna bilər; digər psixoloqlara açmaq üçün admin təsdiqi lazımdır.
        </p>
      </div>

      <div className="admin-shell">
        <PsychTestBuilder
          hidePublished
          onSubmit={(d) => psychologistApi.createMyTest(d).then(() => router.push("/psycholog/tests"))}
        />
      </div>
    </div>
  );
}
