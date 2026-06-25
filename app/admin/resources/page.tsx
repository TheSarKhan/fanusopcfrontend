"use client";

import { useEffect, useState } from "react";
import { adminApi, type PsychResource } from "@/lib/api";

export default function AdminResourcesPage() {
  const [pending, setPending] = useState<PsychResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.pendingResources().then(setPending).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const approve = async (r: PsychResource) => {
    const note = prompt(`"${r.title}" resursunu təsdiqləyirsiniz. İstəyə bağlı qeyd:`, "") ?? undefined;
    try {
      await adminApi.approveResource(r.id, note || undefined);
      setPending((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) { alert((e as Error).message); }
  };

  const reject = async (r: PsychResource) => {
    const note = prompt(`"${r.title}" resursunu rədd edirsiniz. Səbəb (psixoloqa göndərilir):`, "");
    if (note === null) return;
    try {
      await adminApi.rejectResource(r.id, note || undefined);
      setPending((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Resurs paylaşımları</h1>
          <p className="page-sub">
            Psixoloqların paylaşmaq istədiyi resurslar — təsdiqlədikdən sonra bütün psixoloqlara görünəcək.
          </p>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && pending.length === 0 && (
        <div className="card">
          <div className="card-pad" style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
            Təsdiq gözləyən resurs yoxdur.
          </div>
        </div>
      )}

      {!loading && pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.map((r) => (
            <div key={r.id} className="card">
              <div className="card-pad" style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {r.category} · {r.authorName ?? "Psixoloq"}
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{r.description}</div>
                  )}
                  {r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" rel="noreferrer"
                      style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--ox-800)" }}>
                      Faylı aç →
                    </a>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn sm danger" onClick={() => reject(r)}>Rədd et</button>
                  <button className="btn sm primary" onClick={() => approve(r)}>Təsdiqlə</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
