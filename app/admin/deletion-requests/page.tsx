"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, type DeletionRequest } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";

/** MODUL 3B — GDPR silinmə istəkləri (V33): approve = dərhal anonimləşdirmə,
 *  reject = istək ləğv olunur + pasiyentə səbəblə bildiriş. */
export default function DeletionRequestsPage() {
  const [items, setItems] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.getDeletionRequests().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const approve = async (r: DeletionRequest) => {
    if (!window.confirm(
      `${r.email} hesabı ANONİMLƏŞDİRİLƏCƏK: ad/email/telefon silinir, sessiyalar bağlanır, ` +
      `statistik qeydlər (randevular) anonim qalır. Bu əməliyyat geri qaytarıla bilməz. Davam?`)) return;
    setBusyId(r.userId);
    try {
      await adminApi.approveDeletionRequest(r.userId);
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  const reject = async (r: DeletionRequest) => {
    const reason = window.prompt("Rədd səbəbi (pasiyentə bildiriş gedəcək):", "") ?? undefined;
    setBusyId(r.userId);
    try {
      await adminApi.rejectDeletionRequest(r.userId, reason);
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Silinmə istəkləri (GDPR)</h1>
          <p className="page-sub">
            30 günlük pəncərə ərzində emal edin — pəncərə bitəndə purge job hesabı avtomatik hard-delete edir.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}>Yenilə</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Gözləyən silinmə istəyi yoxdur
        </div>
      ) : (
        <div className="card">
          {items.map((r) => (
            <div className="list-item" key={r.userId}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="li-title">
                  <Link href={`/admin/users/${r.userId}`}>{(r.firstName ?? "") + " " + (r.lastName ?? "")}</Link>
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {r.email}</span>
                  <span className="pill ox" style={{ marginLeft: 8 }}>{r.role}</span>
                  {r.blocked && <span className="pill rose" style={{ marginLeft: 4 }}>bloklu</span>}
                </div>
                <div className="li-meta">
                  İstək: {azFormatDateTime(r.requestedAt)} ·
                  <span style={{ color: r.daysLeft <= 5 ? "#991B1B" : undefined, fontWeight: 600 }}>
                    {" "}avtomatik silinməyə {r.daysLeft} gün qalıb
                  </span>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn danger sm" disabled={busyId === r.userId} onClick={() => approve(r)}>
                  {busyId === r.userId ? "…" : "Təsdiqlə (anonimləşdir)"}
                </button>
                <button className="btn sm" disabled={busyId === r.userId} onClick={() => reject(r)}>
                  Rədd et
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
