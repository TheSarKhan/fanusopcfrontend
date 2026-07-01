"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { patientApi, type TestAssignment } from "@/lib/api";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isDone(a: TestAssignment): boolean {
  return a.status === "COMPLETED" || a.hasResult;
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  ASSIGNED:    { label: "Təyin edilib", bg: "var(--brand-50)", fg: "var(--brand-700)", border: "var(--brand-100)" },
  IN_PROGRESS: { label: "Davam edir",   bg: "#FEF3C7",         fg: "#92400E",          border: "#FDE68A" },
  COMPLETED:   { label: "Tamamlandı",   bg: "#D1FAE5",         fg: "#065F46",          border: "#A7F3D0" },
};

function statusMeta(a: TestAssignment) {
  if (isDone(a)) return STATUS_META.COMPLETED;
  return STATUS_META[a.status] ?? STATUS_META.ASSIGNED;
}

export default function PatientTestsPage() {
  const [items, setItems] = useState<TestAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    patientApi.myTestAssignments()
      .then(setItems)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pgoals">
      <header className="pgoals__head">
        <h1>Testlərim</h1>
        <p>Psixoloqunuzun sizə təyin etdiyi psixoloji testlər. Testi həll edin və nəticənizi dərhal görün.</p>
      </header>

      {loading ? (
        <div className="pgoals__loading">Yüklənir…</div>
      ) : err ? (
        <div className="pgoals__error">{err}</div>
      ) : items.length === 0 ? (
        <div className="pgoals__empty">
          <div className="pgoals__empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z" /><path d="M5 4h2v18a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm14 0h-2v18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
            </svg>
          </div>
          <div className="pgoals__empty-title">Hələ test təyin edilməyib</div>
          <p className="pgoals__empty-body">
            Psixoloqunuz sizə test təyin etdikdə burada görünəcək. Növbəti seansda mövzunu müzakirə edə bilərsiniz.
          </p>
          <Link href="/patient/appointments" className="pgoals__empty-cta">Randevulara bax →</Link>
        </div>
      ) : (
        <section className="pgoals__section">
          <div className="pgoals__section-head">
            <h2>Bütün testlər</h2>
            <span className="pgoals__section-n">{items.length}</span>
          </div>
          <div className="pgoals__list">
            {items.map(a => {
              const meta = statusMeta(a);
              const done = isDone(a);
              return (
                <article key={a.id} className="pgoal-card">
                  <div className="pgoal-card__top">
                    <div className="pgoal-card__title">{a.testTitle}</div>
                    <span className="pgoal-card__status"
                      style={{ background: meta.bg, color: meta.fg, borderColor: meta.border }}>
                      {meta.label}
                    </span>
                  </div>

                  {a.note && <div className="pgoal-card__desc">{a.note}</div>}

                  <div className="pgoal-card__meta">
                    <span className="pgoal-card__date">Təyin edildi: {fmtDate(a.assignedAt)}</span>
                    {done && a.completedAt && (
                      <span style={{ color: "#065F46", fontWeight: 600 }}>
                        Tamamlandı: {fmtDate(a.completedAt)}
                      </span>
                    )}
                    <Link
                      href={`/patient/tests/${a.id}`}
                      className="pgoal-card__action"
                      style={done ? undefined : { color: "#fff", background: "var(--brand)", border: "none", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                      {done ? "Nəticə →" : "Testi həll et →"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
