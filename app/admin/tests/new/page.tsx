"use client";

import Link from "next/link";
import { adminApi } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";

export default function AdminNewTestPage() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>← Psixoloji testlərə qayıt</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 4px" }}>Yeni test</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
          Addım-addım doldurun — dəyişikliklər avtomatik saxlanılır. Yayımlansa bütün psixoloqlara açıq olur.
        </p>
      </div>

      <PsychTestWizard
        showPublished
        doneHref="/admin/tests"
        api={{
          // Avtomatik qaralama saxlanması — popup açmasın (bax lib/loadingOverlay.ts).
          createDraft: () => adminApi.createPsychTestDraft({ silent: true }),
          saveDraft: (id, data) => adminApi.savePsychTestDraft(id, data, { silent: true }),
          publish: adminApi.publishPsychTest,
          uploadFile: adminApi.uploadFile,
        }}
      />
    </div>
  );
}
