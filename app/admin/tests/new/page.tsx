"use client";

import { adminApi } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";

export default function NewTestPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Yeni test</h1>
          <p className="page-sub">Addım-addım doldurun — dəyişikliklər avtomatik saxlanılır.</p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href="/admin/tests">← Testlərə qayıt</a>
        </div>
      </div>

      <PsychTestWizard
        showPublished
        doneHref="/admin/tests"
        api={{
          createDraft: adminApi.createPsychTestDraft,
          saveDraft: adminApi.savePsychTestDraft,
          publish: adminApi.publishPsychTest,
          uploadFile: adminApi.uploadFile,
        }}
      />
    </div>
  );
}
