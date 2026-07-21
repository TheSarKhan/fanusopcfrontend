"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type PsyTestSummary } from "@/lib/api";
import { toast } from "@/components/Toast";
import { Button, ButtonLink, DataTable, Status, type Column } from "@/components/ui";
import { IconPlus } from "../_components/icons";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function TestsPage() {
  const [items, setItems] = useState<PsyTestSummary[]>([]);
  const [pending, setPending] = useState<PsyTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // Cədvəlin öz yükləmə xətası — toast-a yox, cədvəlin içindəki qutuya gedir.
  const [tableError, setTableError] = useState<string | null>(null);

  // Serverdə səhifələnir: backend 0-dan sayır.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setLoading(true);
    setTableError(null);
    adminApi.getPsychTestsPaged({ page, size })
      .then((res) => { setItems(res.content); setTotal(res.totalElements); })
      .catch((e) => setTableError((e as Error).message || "Testlər yüklənmədi"))
      .finally(() => setLoading(false));
  }, [page, size, nonce]);

  // Paylaşım istəkləri ayrıca kart siyahısıdır — cədvəl deyil, səhifələnmir.
  useEffect(() => {
    adminApi.pendingTestShares()
      .then(setPending)
      .catch(() => setPending([]));
  }, [nonce]);

  const reload = () => setNonce((n) => n + 1);
  const pageCount = Math.max(1, Math.ceil(total / size));

  const approveShare = async (t: PsyTestSummary) => {
    const note = prompt(`"${t.title}" testini təsdiqləyirsiniz. İstəyə bağlı qeyd:`, "") ?? undefined;
    try {
      await adminApi.approveTestShare(t.id, note || undefined);
      setPending((prev) => prev.filter((x) => x.id !== t.id));
      reload();
    } catch (e) { toast((e as Error).message || "Test təsdiqlənmədi", "error"); }
  };

  const rejectShare = async (t: PsyTestSummary) => {
    const note = prompt(`"${t.title}" testini rədd edirsiniz. Səbəb (psixoloqa göndərilir):`, "");
    if (note === null) return;
    try {
      await adminApi.rejectTestShare(t.id, note || undefined);
      setPending((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) { toast((e as Error).message || "Test rədd edilmədi", "error"); }
  };

  const remove = async (id: number) => {
    if (!confirm("Bu testi silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.")) return;
    try {
      await adminApi.deletePsychTest(id);
      reload();
    } catch (e) {
      toast((e as Error).message || "Test silinmədi", "error");
    }
  };

  const columns: Column<PsyTestSummary>[] = useMemo(() => [
    {
      key: "title",
      header: "Başlıq",
      cell: (t) => <span style={{ fontWeight: 600 }}>{t.title || "Başlıqsız"}</span>,
    },
    {
      key: "published",
      header: "Status",
      width: 120,
      cell: (t) => (t.published ? <Status tone="positive">Yayımlanıb</Status> : <Status tone="wait">Qaralama</Status>),
    },
    {
      key: "questionCount",
      header: "Suallar",
      numeric: true,
      width: 100,
      cell: (t) => t.questionCount,
    },
    {
      key: "scaleCount",
      header: "Şkalalar",
      numeric: true,
      width: 100,
      cell: (t) => t.scaleCount,
    },
  ], []);

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

      {pending.length > 0 && (
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      <span>{t.questionCount} sual</span>
                      <span>{t.scaleCount} şkala</span>
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

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(t) => t.id}
        loading={loading}
        error={tableError}
        onRetry={reload}
        minWidth={720}
        empty={{
          title: "Hələ test yoxdur",
          body: "İlk psixoloji testi yaradın.",
          actions: <ButtonLink variant="primary" size="sm" href="/admin/tests/new">Yeni test</ButtonLink>,
        }}
        actionsHeader="Əməliyyatlar"
        actions={(t) => (
          <>
            <ButtonLink variant="ghost" size="sm" href={`/admin/tests/${t.id}/edit`}>Redaktə</ButtonLink>
            <Button variant="dangerGhost" size="sm" onClick={() => remove(t.id)}>Sil</Button>
          </>
        )}
        // Backend 0-dan sayır, Pagination 1-dən — çevirmə burada aparılır.
        pagination={{
          page: page + 1,
          pageCount,
          onChange: (p) => setPage(p - 1),
          pageSize: size,
          onPageSizeChange: (n) => { setSize(n); setPage(0); },
          pageSizeOptions: PAGE_SIZE_OPTIONS,
        }}
        totalLabel={`${total ? page * size + 1 : 0}–${Math.min(total, (page + 1) * size)} / ${total}`}
      />
    </div>
  );
}
