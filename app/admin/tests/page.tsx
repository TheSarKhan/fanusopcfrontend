"use client";

import { useEffect, useState } from "react";
import { adminApi, type PsyTestSummary } from "@/lib/api";
import { IconPlus } from "../_components/icons";

export default function TestsPage() {
  const [items, setItems] = useState<PsyTestSummary[]>([]);
  const [pending, setPending] = useState<PsyTestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.getPsychTests().catch(() => [] as PsyTestSummary[]),
      adminApi.pendingTestShares().catch(() => [] as PsyTestSummary[]),
    ])
      .then(([all, pend]) => { setItems(all); setPending(pend); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const approveShare = async (t: PsyTestSummary) => {
    const note = prompt(`"${t.title}" testini təsdiqləyirsiniz. İstəyə bağlı qeyd:`, "") ?? undefined;
    try {
      await adminApi.approveTestShare(t.id, note || undefined);
      setPending((prev) => prev.filter((x) => x.id !== t.id));
      load();
    } catch (e) { alert((e as Error).message); }
  };

  const rejectShare = async (t: PsyTestSummary) => {
    const note = prompt(`"${t.title}" testini rədd edirsiniz. Səbəb (psixoloqa göndərilir):`, "");
    if (note === null) return;
    try {
      await adminApi.rejectTestShare(t.id, note || undefined);
      setPending((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) { alert((e as Error).message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu testi silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.")) return;
    try {
      await adminApi.deletePsychTest(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Psixoloji testlər</h1>
          <p className="page-sub">Sual-cavablı psixoloji testlər və bal şkalalarını idarə edin.</p>
        </div>
        <div className="page-actions">
          <a className="btn primary" href="/admin/tests/new">
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Yeni test
          </a>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && pending.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: "#FDE68A" }}>
          <div className="card-pad">
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
              Paylaşım istəkləri ({pending.length})
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
              Psixoloqların yaratdığı testlər — təsdiqlədikdən sonra bütün psixoloqlara görünəcək.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pending.map((t) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  padding: "10px 12px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--line)",
                }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      {t.questionCount} sual · {t.scaleCount} şkala
                    </div>
                  </div>
                  <a className="btn sm ghost" href={`/admin/tests/${t.id}/edit`}>Bax</a>
                  <button className="btn sm danger" onClick={() => rejectShare(t)}>Rədd et</button>
                  <button className="btn sm primary" onClick={() => approveShare(t)}>Təsdiqlə</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Başlıq</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 100, textAlign: "right" }}>Suallar</th>
                <th style={{ width: 100, textAlign: "right" }}>Şkalalar</th>
                <th style={{ width: 160, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                      Hələ test yoxdur
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
                      İlk psixoloji testi yaradın
                    </div>
                    <a className="btn primary" href="/admin/tests/new" style={{ display: "inline-flex" }}>
                      <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
                      Yeni test
                    </a>
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id}>
                    <td className="strong">{t.title || "Başlıqsız"}</td>
                    <td>
                      {t.published ? (
                        <span className="pill sage"><span className="dot" />Yayımlanıb</span>
                      ) : (
                        <span className="pill gold"><span className="dot" />Qaralama</span>
                      )}
                    </td>
                    <td className="num">{t.questionCount}</td>
                    <td className="num">{t.scaleCount}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                        <a className="btn sm ghost" href={`/admin/tests/${t.id}/edit`}>Redaktə</a>
                        <button className="btn sm danger" onClick={() => remove(t.id)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
