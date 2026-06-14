"use client";

import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import PsychTestBuilder from "@/components/PsychTestBuilder";

export default function NewTestPage() {
  const router = useRouter();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Yeni test</h1>
          <p className="page-sub">Sual, variant və bal şkalalarını təyin edin.</p>
        </div>
        <div className="page-actions">
          <a className="btn ghost" href="/admin/tests">← Testlərə qayıt</a>
        </div>
      </div>

      <PsychTestBuilder
        onSubmit={(d) => adminApi.createPsychTest(d).then(() => router.push("/admin/tests"))}
      />
    </div>
  );
}
