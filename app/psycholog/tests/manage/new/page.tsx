"use client";

import Link from "next/link";
// The wizard is styled by admin.css selectors scoped under `.admin-shell`,
// so importing it here is safe (rules only apply inside the wrapper below).
import "@/app/admin/admin.css";
import { psychologistApi } from "@/lib/api";
import PsychTestWizard from "@/components/PsychTestWizard";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PsyNewTestPage() {
  const { t } = useT();
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/psycholog/tests" style={{ fontSize: 13, color: "#52718F", textDecoration: "none" }}>{t("psyTestMgmt.backToTests")}</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--oxford)", margin: "8px 0 4px" }}>{t("psyTestMgmt.newTitle")}</h1>
        <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: 0 }}>
          {t("psyTestMgmt.newSub")}
        </p>
      </div>

      <div className="admin-shell">
        <PsychTestWizard
          doneHref="/psycholog/tests"
          api={{
            // Avtomatik qaralama saxlanması — popup açmasın (bax lib/loadingOverlay.ts).
            createDraft: () => psychologistApi.createMyTestDraft({ silent: true }),
            saveDraft: (id, data) => psychologistApi.saveMyTestDraft(id, data, { silent: true }),
            publish: psychologistApi.publishMyTest,
            uploadFile: psychologistApi.uploadFile,
          }}
        />
      </div>
    </div>
  );
}
