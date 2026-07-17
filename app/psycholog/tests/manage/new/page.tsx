"use client";

import Link from "next/link";
// The wizard is styled by admin.css selectors scoped under `.admin-shell`,
// so importing it here is safe (rules only apply inside the wrapper below).
import "@/app/admin/admin.css";
import { psychologistApi } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";

export default function PsyNewTestPage() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/psycholog/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>← Testlərə qayıt</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 4px" }}>Yeni test</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
          Addım-addım doldurun — dəyişikliklər avtomatik saxlanılır. Test dərhal öz
          pasiyentlərinizə təyin oluna bilər; digər psixoloqlara açmaq üçün admin təsdiqi lazımdır.
        </p>
      </div>

      <div className="admin-shell">
        <PsychTestWizard
          doneHref="/psycholog/tests"
          api={{
            createDraft: psychologistApi.createMyTestDraft,
            saveDraft: psychologistApi.saveMyTestDraft,
            publish: psychologistApi.publishMyTest,
            uploadFile: psychologistApi.uploadFile,
          }}
        />
      </div>
    </div>
  );
}
