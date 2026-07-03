"use client";

// ============================================================================
// Psixoloq seans tarixçəsi — tamamlanmış / ləğv edilmiş / rədd edilmiş
// seansların tam siyahısı, aya görə qruplaşmış. Əsas randevu səhifəsindəki
// "Tarixçə" düyməsindən açılır. Buradan seans qeydi yazmaq, yaxın keçmişdəki
// seansı "baş tutmadı" kimi bildirmək və Müştəri 360° səhifəsinə keçmək olur.
// ============================================================================

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { psychologistApi, type AppointmentDetail } from "@/lib/api";
import {
  pad2, fmtTime, avatarColor, initialsOf, STATUS, NO_SHOW_REPORT_WINDOW_MS,
  PSY_APPT_STYLE, IMsg, IAlert, IUser,
  PackageBadge, RowMenu, type MenuItem, DisputeModal, OutcomeModal,
} from "../shared";

const HISTORY_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);
const MONTHS_AZ_FULL = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const PAGE_SIZE = 30;

export default function PsychologistAppointmentHistoryPage() {
  const [items, setItems] = useState<AppointmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFor, setOutcomeFor] = useState<AppointmentDetail | null>(null);
  const [disputeFor, setDisputeFor] = useState<AppointmentDetail | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [now] = useState(() => new Date());

  useEffect(() => {
    psychologistApi.myAppointments()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const history = useMemo(() => {
    return items
      .filter(a => HISTORY_STATUSES.has(a.status))
      .filter(a => a.startAt ?? a.endAt)
      .sort((a, b) => {
        const da = new Date(a.startAt ?? a.endAt ?? 0).getTime();
        const db = new Date(b.startAt ?? b.endAt ?? 0).getTime();
        return db - da;
      });
  }, [items]);

  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; items: AppointmentDetail[] }[] = [];
    let last: typeof groups[number] | null = null;
    for (const a of history.slice(0, limit)) {
      const d = new Date((a.startAt ?? a.endAt)!);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!last || last.key !== key) {
        last = { key, label: `${MONTHS_AZ_FULL[d.getMonth()]} ${d.getFullYear()}`, items: [] };
        groups.push(last);
      }
      last.items.push(a);
    }
    return groups;
  }, [history, limit]);

  return (
    <div className="psy-appt-page" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{PSY_APPT_STYLE}</style>
      <header style={{ marginBottom: 22 }}>
        <Link href="/psycholog/appointments" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Randevulara qayıt
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--oxford)" }}>Seans tarixçəsi</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>
          Keçmiş seanslarınız — seans qeydi yazmaq və problemli seansı bildirmək buradan mümkündür
        </p>
      </header>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : history.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          Hələ tamamlanmış seansınız yoxdur
        </div>
      ) : (
        <>
          {monthGroups.map(g => (
            <section key={g.key} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford-60)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
                {g.label}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "0 8px" }}>
                {g.items.map(a => (
                  <HistoryRow
                    key={a.id}
                    a={a}
                    now={now}
                    onOutcome={() => setOutcomeFor(a)}
                    onDispute={() => setDisputeFor(a)}
                  />
                ))}
              </div>
            </section>
          ))}

          {history.length > limit && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                Daha çox göstər (+{Math.min(PAGE_SIZE, history.length - limit)})
              </button>
            </div>
          )}
        </>
      )}

      {outcomeFor && (
        <OutcomeModal
          appointment={outcomeFor}
          onClose={() => setOutcomeFor(null)}
          onSaved={() => setOutcomeFor(null)}
        />
      )}
      {disputeFor && (
        <DisputeModal
          appointment={disputeFor}
          onClose={() => setDisputeFor(null)}
          onDone={(updated) => {
            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
            setDisputeFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Tarixçə sətri ──────────────────────────────────────────────────────── */

function HistoryRow({
  a, now, onOutcome, onDispute,
}: {
  a: AppointmentDetail;
  now: Date;
  onOutcome: () => void;
  onDispute: () => void;
}) {
  const ref = a.startAt ?? a.endAt;
  if (!ref) return null;
  const d = new Date(ref);
  const status = STATUS[a.status] ?? STATUS.COMPLETED;
  const av = avatarColor(a.patientId ?? a.patientName);
  // Avtomatik tamamlanmış seansı bu pəncərə ərzində "baş tutmadı" kimi bildirmək olar.
  const endMs = a.endAt ? new Date(a.endAt).getTime() : null;
  const reportableNoShow = a.status === "COMPLETED" && endMs != null
    && now.getTime() - endMs < NO_SHOW_REPORT_WINDOW_MS;

  const menu: MenuItem[] = [];
  if (reportableNoShow) menu.push({ label: "Baş tutmadı", onClick: onDispute, icon: <IAlert s={15} c="#5C6B85" /> });
  if (a.patientId) menu.push({ label: "Müştəri 360°", href: `/psycholog/clients/${a.patientId}`, icon: <IUser /> });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderTop: "1px solid #F0F4FA", padding: "13px 12px" }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 100 }}>{pad2(d.getDate())}.{pad2(d.getMonth() + 1)}.{d.getFullYear()} · {fmtTime(d)}</span>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: av, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{initialsOf(a.patientName)}</span>
      <span style={{ flex: 1, minWidth: 150, fontSize: 14, color: "var(--oxford)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        {a.patientName ?? "Pasiyent"}
        {a.patientPackageId != null && <PackageBadge name={a.packageName} />}
      </span>
      <span style={{ background: status.bg, color: status.color, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999 }}>{status.label}</span>
      {a.status === "COMPLETED" && (
        <button type="button" onClick={onOutcome}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#082F6D", border: "1px solid #C7DAF5", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <IMsg c="var(--brand)" />
          Seans qeydi
        </button>
      )}
      {menu.length > 0 && <RowMenu items={menu} size={30} />}
    </div>
  );
}
