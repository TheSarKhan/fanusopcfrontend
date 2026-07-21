"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  psychologistApi,
  type CustomPackageSale,
  type PackageDto,
  type PackageStats,
  type PackageReq,
  type Psychologist,
  type PsychologistEarnings,
  type PsychologistEarningRow,
} from "@/lib/api";
import { DataTable, PaymentStatus, SectionTitle, Status, Tabs, type Column } from "@/components/ui";
import { azFormatDate } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";
import PageHeader from "@/components/PageHeader";
import { confirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

/* ═══ Page ════════════════════════════════════════════════════════════════ */

/** Faiz təyin olunmayıbsa komissiya hesablanmır — bunu "0%" yazmaq yanıldıcı olardı. */
function pct(value: number | null | undefined) {
  return value == null ? "—" : `${value}%`;
}

export default function PsychologPackagesPage() {
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [statsById, setStatsById] = useState<Record<number, PackageStats>>({});
  const [statsReady, setStatsReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Kataloqda qarşılığı olmayan satışlar — ayrıca siyahıda göstərilir. */
  const [customSales, setCustomSales] = useState<CustomPackageSale[]>([]);
  /** Platformanın tutduğu pay — qiymətin bir hissəsi olduğu üçün bu səhifədədir. */
  const [earnings, setEarnings] = useState<PsychologistEarnings | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");
  const hasCustom = customSales.length > 0;
  const [indivPrice, setIndivPrice] = useState<number | null>(null);
  const [priceEditing, setPriceEditing] = useState(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const [me, setMe] = useState<Psychologist | null>(null);

  // FANUS psixoloqlar öz qiymət/paketlərini redaktə edə bilmir (backend requireNotFanus
  // gate-i ilə eyni qayda) — yalnız statistikanı görürlər, dəyişikliyi operator/admin edir.
  const isFanus = (me?.psychologistType ?? "").toUpperCase() === "FANUS";

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      psychologistApi.myPackages(),
      psychologistApi.myPackageStats(),
      psychologistApi.myPricing(),
      psychologistApi.me(),
      psychologistApi.myCustomPackageSales(),
      psychologistApi.myEarnings(),
    ]).then(([c, s, p, m, cs, e]) => {
      if (cs.status === "fulfilled") setCustomSales(cs.value);
      if (e.status === "fulfilled") setEarnings(e.value);
      if (c.status === "fulfilled") setCatalog(c.value);
      if (s.status === "fulfilled") {
        const map: Record<number, PackageStats> = {};
        for (const st of s.value) map[st.packageId] = st;
        setStatsById(map);
        setStatsReady(true);
      } else {
        setStatsReady(false);
      }
      if (p.status === "fulfilled") setIndivPrice(p.value.individualPrice ?? null);
      if (m.status === "fulfilled") setMe(m.value);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveIndivPrice = async (price: number) => {
    setPriceBusy(true);
    try {
      const res = await psychologistApi.updateMyPricing(price);
      setIndivPrice(res.individualPrice ?? null);
      setPriceEditing(false);
      toast("Tək seans qiyməti yeniləndi", "success");
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setPriceBusy(false); }
  };

  const all = Object.values(statsById);
  const sold = all.reduce((n, s) => n + s.sold, 0);
  const active = all.reduce((n, s) => n + s.active, 0);
  const revenue = all.reduce((n, s) => n + s.revenue, 0);

  const create = async (req: PackageReq) => {
    setBusy(true);
    try { await psychologistApi.createMyPackage(req); setNewOpen(false); load(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };
  const update = async (id: number, req: PackageReq) => {
    setBusy(true);
    try { await psychologistApi.updateMyPackage(id, req); load(); }
    catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };
  const remove = async (p: PackageDto) => {
    if (!(await confirmDialog({ title: "Paketi sil", message: `«${p.name}» paketini silmək istəyirsiniz?`, confirmLabel: "Sil", danger: true }))) return;
    try { await psychologistApi.deleteMyPackage(p.id); load(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const toggleActive = (p: PackageDto) =>
    update(p.id, { name: p.name, sessionCount: p.sessionCount, packagePrice: p.packagePrice, active: !p.active });

  // Xüsusi satış cədvəli — paket kartları ilə eyni məlumatı, sətir formasında.
  const customColumns: Column<CustomPackageSale>[] = [
    { key: "patient", header: "Müştəri", cell: r => r.patientName },
    { key: "name", header: "Paket", cell: r => r.packageName },
    {
      key: "progress",
      header: "Gedişat",
      cell: r => `${r.completed}/${r.total} keçirilib`,
    },
    {
      // Psixoloqa satış qiyməti deyil, platforma payı çıxıldıqdan sonra ona
      // qalan məbləğ göstərilir — panelin qalanı ilə eyni məntiq.
      key: "price",
      header: "Qazancınız",
      numeric: true,
      cell: r => (r.netAmount != null ? formatAzn(r.netAmount) : "—"),
    },
    {
      key: "status",
      header: "Vəziyyət",
      cell: r => (
        <Status tone={r.status === "PENDING_PAYMENT" ? "wait" : r.status === "CANCELLED" ? "risk" : "neutral"}>
          {r.status === "PENDING_PAYMENT" ? "Ödəniş gözlənilir"
            : r.status === "ACTIVE" ? "Davam edir"
            : r.status === "EXHAUSTED" ? "Tamamlanıb"
            : r.status === "CANCELLED" ? "Ləğv edilib" : r.status}
        </Status>
      ),
    },
    {
      key: "purchasedAt",
      header: "Satılıb",
      cell: r => azFormatDate(r.purchasedAt),
      hideOnMobile: true,
    },
  ];

  // Qazanc sətirləri — hər ödənişdə platformanın payı və psixoloqa qalan.
  const earningColumns: Column<PsychologistEarningRow>[] = [
    {
      key: "patient",
      header: "Müştəri",
      cell: r => r.patientName ?? "—",
    },
    {
      key: "kind",
      header: "Nəyə görə",
      cell: r => (r.kind === "PACKAGE" ? (r.packageName ?? "Paket") : "Tək seans"),
      hideOnMobile: true,
    },
    {
      key: "date",
      header: "Tarix",
      cell: r => azFormatDate(r.paidAt ?? r.createdAt),
      sortable: true,
      sortValue: r => r.paidAt ?? r.createdAt,
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: "Müştəri ödəyib",
      numeric: true,
      sortable: true,
      sortValue: r => r.amount,
      cell: r => formatAzn(r.amount),
    },
    {
      key: "commission",
      header: "Platforma payı",
      numeric: true,
      cell: r => formatAzn(r.commissionAmount),
    },
    {
      key: "net",
      header: "Qazancınız",
      numeric: true,
      sortable: true,
      sortValue: r => r.net,
      cell: r => formatAzn(r.net),
    },
    {
      key: "status",
      header: "Vəziyyət",
      cell: r => <PaymentStatus value={r.status} />,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="panel-page">
      <style>{`@keyframes pkFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .pk-icobtn:hover{border-color:var(--brand)!important;color:var(--brand)!important}
        .pk-del:hover{background:#FEE2E2!important}
        .pk-menu-item:hover{background:#F2F6FD!important}
        .pk-menu-item--danger:hover{background:#FEE2E2!important}
        .pk-patients-link:hover .pk-arrow{transform:translateX(3px)}
        .pk-arrow{transition:transform .16s ease}`}</style>

      {/* Header */}
      <PageHeader
        title="Qiymətlər & Paketlər"
        subtitle="Paket təklifləriniz, satış və istifadə statistikası"
        actions={(
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {earnings && (
              <button onClick={() => setShareOpen(true)} className="pk-icobtn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "var(--oxford)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "11px 17px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                <IDollar s={16} />Platforma payı
              </button>
            )}
            {!isFanus && (
              <button onClick={() => setNewOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 17px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
                <IPlus />Yeni paket
              </button>
            )}
          </div>
        )}
      />

      {isFanus && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 12, padding: "13px 16px", marginBottom: 20 }}>
          <span style={{ color: "#1051B7", flex: "none", marginTop: 1 }}><IDollar s={16} c="#1051B7" /></span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--oxford)", lineHeight: 1.5 }}>
            FANUS psixoloqu olduğunuz üçün qiymət və paketlər mərkəzi idarə olunur — özünüz redaktə edə bilmirsiniz.
            Dəyişiklik üçün operator və ya admin ilə əlaqə saxlayın. Aşağıda yalnız statistikanı görürsünüz.
          </span>
        </div>
      )}

      {/* Tək seans qiymət kartı */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: "#E4ECFA", color: "#1051B7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <IDollar s={19} c="#1051B7" />
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 3 }}>Tək seans qiyməti</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "var(--oxford)", lineHeight: 1 }}>
                {indivPrice != null
                  ? formatAzn(indivPrice)
                  : <span style={{ fontSize: 14, fontWeight: 600, color: "#9DB0CC" }}>Təyin edilməyib</span>}
              </div>
            </div>
          </div>
          {!priceEditing && !isFanus && (
            <button onClick={() => setPriceEditing(true)} title="Redaktə" className="pk-icobtn"
              style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, cursor: "pointer", flex: "none" }}>
              <IEdit />
            </button>
          )}
        </div>
        {priceEditing && !isFanus && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #EDF1F8", animation: "pkFade .2s ease" }}>
            <IndivPriceForm current={indivPrice} busy={priceBusy} onSave={saveIndivPrice} onCancel={() => setPriceEditing(false)} />
          </div>
        )}
      </div>

      {/* Platforma payı bütövlükdə popup-dadır — səhifənin əsas işi qiymət və
          paket idarəsidir, komissiya isə arabir baxılan məlumatdır. */}
      {shareOpen && earnings && (
        <PlatformShareModal data={earnings} columns={earningColumns} onClose={() => setShareOpen(false)} />
      )}

      {/* Summary stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px, 100%), 1fr))", gap: 13, marginBottom: 20 }}>
        <StatCard bg="#E4ECFA" color="#1051B7" icon={<ICube s={19} />} value={String(catalog.length)} label="Cəmi paket" />
        <StatCard bg="#E4ECFA" color="#1051B7" icon={<ICart s={19} />} value={statsReady ? String(sold) : "—"} label="Satılıb" />
        <StatCard bg="#D1FAE5" color="#065F46" icon={<ICheckCircle s={19} c="#065F46" />} value={statsReady ? String(active) : "—"} label="Davam edən" />
        <StatCard bg="#E4ECFA" color="#082F6D" icon={<IDollar s={19} c="#082F6D" />} value={statsReady ? formatAzn(revenue) : "—"} label="Qazancınız" valueColor="#082F6D" />
      </div>

      {!statsReady && !loading && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 13px", marginBottom: 16 }}>
          Statistika hələ hazır deyil — backend yenilənməsindən sonra satış/istifadə rəqəmləri görünəcək. Paketləri indidən idarə edə bilərsiniz.
        </div>
      )}

      {/* New package modal */}
      {newOpen && (
        <PackageFormModal busy={busy} onSave={create} onClose={() => setNewOpen(false)} />
      )}

      {/* Xüsusi satış tab-ı yalnız belə satış varsa görünür — yoxdursa səhifə
          tək siyahılı qalır, boş tab əlavə etmirik. */}
      {hasCustom && (
        <div style={{ marginBottom: 18 }}>
          <Tabs
            items={[
              { key: "catalog", label: "Paketlər", count: catalog.length },
              { key: "custom", label: "Xüsusi satılan paketlər", count: customSales.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      )}

      {tab === "custom" && hasCustom ? (
        <DataTable
          rows={customSales}
          columns={customColumns}
          rowKey={r => r.id}
          empty={{ title: "Xüsusi satış yoxdur" }}
        />
      ) : loading ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EDF1F8", padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>
      ) : catalog.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EDF1F8", boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: "44px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Hələ paket təklifiniz yoxdur</div>
          <p style={{ fontSize: 13, color: "var(--oxford-60)", margin: "0 0 16px" }}>{isFanus ? "Paketləriniz operator/admin tərəfindən əlavə ediləndə burada görünəcək." : "İlk paketinizi yaradın — pasiyentlərə endirimli seans dəstləri təklif edin."}</p>
          {!isFanus && (
            <button onClick={() => setNewOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}><IPlus />İlk paketi yarat</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {catalog.map(p => (
            <div key={p.id} style={{ width: "100%", maxWidth: 420 }}>
              <PackageCard pkg={p} stats={statsById[p.id]} busy={busy} readOnly={isFanus}
                onUpdate={update} onDelete={remove} onToggleActive={toggleActive} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Platforma payı popup-u ──────────────────────────────────────────────── */
function PlatformShareModal({ data, columns, onClose }: {
  data: PsychologistEarnings;
  columns: Column<PsychologistEarningRow>[];
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,47,109,.45)", backdropFilter: "blur(4px)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "pkFade .18s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(880px, 100%)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 70px rgba(8,47,109,.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 22px 16px", borderBottom: "1px solid #F0F4FA" }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "#E4ECFA", color: "#1051B7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <IDollar s={19} c="#1051B7" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--oxford)" }}>Platforma payı</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--oxford-60)", marginTop: 2 }}>
              Müştərinin ödədiyi qiymət dəyişmir — pay yalnız sizə keçən məbləğdən tutulur.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla"
            style={{ width: 34, height: 34, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F2F6FD", border: "none", borderRadius: 9, color: "var(--oxford-60)", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ padding: "18px 22px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(160px, 100%), 1fr))", gap: 13, marginBottom: 16 }}>
            <MiniStat label="Müştərilərin ödədiyi" value={formatAzn(data.grossTotal)} />
            <MiniStat label="Platforma payı" value={formatAzn(data.commissionTotal)} />
            <MiniStat label="Qazancınız" value={formatAzn(data.netTotal)} color="#082F6D" />
            <MiniStat label="Ödənilməmiş qalıq" value={formatAzn(data.balance)} />
          </div>

          <div style={{ display: "grid", gap: 6, background: "#F6FAFF", border: "1px solid #E9F1FC", borderRadius: 12, padding: "13px 16px", fontSize: 12.5, fontWeight: 500, color: "var(--oxford-60)", lineHeight: 1.6, marginBottom: 18 }}>
            <div>Müştəri sizi özü seçəndə tutulan pay: <b style={{ color: "var(--oxford)" }}>{pct(data.directCommissionPercent)}</b></div>
            <div>Fanus sizi təyin edəndə tutulan pay: <b style={{ color: "var(--oxford)" }}>{pct(data.currentCommissionPercent)}</b></div>
            <div>Faiz ödəniş təsdiqlənən anda möhürlənir — qayda sonradan dəyişsə, keçmiş ödənişlər toxunulmaz qalır.</div>
            <div>Cəmlərə yalnız təsdiqlənmiş ödənişlər daxildir. Artıq ödənilib: <b style={{ color: "var(--oxford)" }}>{formatAzn(data.paidOut)}</b></div>
          </div>

          <SectionTitle>Ödəniş sətirləri</SectionTitle>
          <DataTable
            rows={data.rows}
            columns={columns}
            rowKey={r => r.paymentId}
            empty={{ title: "Hələ ödəniş yoxdur", body: "Seanslarınız ödənildikcə burada görünəcək." }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Komissiya kartının kiçik rəqəmi ─────────────────────────────────────── */
function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#F6FAFF", border: "1px solid #E9F1FC", borderRadius: 11, padding: "11px 13px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: color ?? "var(--oxford)", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

/* ─── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ bg, color, icon, value, label, valueColor }: {
  bg: string; color: string; icon: React.ReactNode; value: string; label: string; valueColor?: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: "15px 17px", display: "flex", alignItems: "center", gap: 13 }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: bg, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{icon}</span>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: valueColor ?? "var(--oxford)" }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── Package card ────────────────────────────────────────────────────────── */
function PackageCard({ pkg, stats, busy, onUpdate, onDelete, onToggleActive, readOnly }: {
  pkg: PackageDto;
  stats: PackageStats | undefined;
  busy: boolean;
  onUpdate: (id: number, req: PackageReq) => void;
  onDelete: (p: PackageDto) => void;
  onToggleActive: (p: PackageDto) => void;
  /** FANUS psixoloq — statistikanı görür, redaktə/sil/aktiv-et əlçatan deyil. */
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const deaktiv = !pkg.active;
  const s = stats;
  const patientCount = s?.patients.length ?? 0;

  const save = (req: PackageReq) => { onUpdate(pkg.id, req); setEditing(false); };

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20, opacity: deaktiv ? 0.96 : 1 }}>
      {/* header — kimlik + əməliyyatlar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: deaktiv ? "#F3F4F6" : "#EAF1FC", color: deaktiv ? "#9AA7BD" : "#1051B7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <ICube s={21} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: deaktiv ? "var(--oxford-60)" : "var(--oxford)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pkg.name}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 11.5, fontWeight: 700, color: deaktiv ? "#9AA7BD" : "#059669" }}>
              {deaktiv ? <IPause s={12} c="#9AA7BD" /> : <ICheckCircle s={12} c="#059669" />}
              {deaktiv ? "Deaktiv" : "Aktiv"}
            </span>
          </div>
        </div>
        {readOnly ? null : deaktiv ? (
          <div style={{ position: "relative", flex: "none" }}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Əməliyyatlar" className="pk-icobtn"
              style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, cursor: "pointer" }}><IDots /></button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} aria-hidden />
                <div style={{ position: "absolute", right: 0, top: 40, zIndex: 20, width: 180, background: "#fff", border: "1px solid #E1E9F5", borderRadius: 11, boxShadow: "0 12px 40px rgba(8,47,109,.18)", padding: 6, animation: "pkFade .16s ease" }}>
                  <MenuBtn onClick={() => { setMenuOpen(false); onToggleActive(pkg); }} icon={<ICheckCircle s={15} c="#5C6B85" />}>Aktiv et</MenuBtn>
                  <MenuBtn onClick={() => { setMenuOpen(false); setEditing(true); }} icon={<IEdit s={15} c="#5C6B85" />}>Redaktə</MenuBtn>
                  <div style={{ height: 1, background: "#F0F4FA", margin: "4px 6px" }} />
                  <MenuBtn danger onClick={() => { setMenuOpen(false); onDelete(pkg); }} icon={<ITrash s={15} c="#991B1B" />}>Sil</MenuBtn>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 7, flex: "none" }}>
            <button onClick={() => setEditing(true)} title="Redaktə" className="pk-icobtn"
              style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, cursor: "pointer" }}><IEdit /></button>
            <button onClick={() => onDelete(pkg)} title="Sil" className="pk-del"
              style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#991B1B", border: "1px solid #F3D6D6", borderRadius: 9, cursor: "pointer" }}><ITrash /></button>
          </div>
        )}
      </div>

      {/* edit modal */}
      {editing && !readOnly && (
        <PackageFormModal busy={busy}
          initial={{ name: pkg.name, sessionCount: pkg.sessionCount, packagePrice: pkg.packagePrice, active: pkg.active }}
          onSave={save} onClose={() => setEditing(false)} />
      )}

      {/* təklif zolağı — qiymət hero, seans sayı dəstəkləyici */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#F6FAFF", border: "1px solid #E9F1FC", borderRadius: 12, padding: "13px 16px", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9AA7BD", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Paket qiyməti</div>
          <div style={{ fontSize: 23, fontWeight: 800, color: "var(--oxford)", lineHeight: 1, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{formatAzn(pkg.packagePrice)}</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 800, color: "var(--oxford)", whiteSpace: "nowrap" }}>
            <ICalendar s={14} c="#1051B7" />{pkg.sessionCount} seans
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--oxford-60)", marginTop: 3, whiteSpace: "nowrap" }}>≈ {formatAzn(pkg.perSessionPrice)} / seans</div>
        </div>
      </div>

      {/* satış statistikası */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 180, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Stat label="Satılıb" value={s ? String(s.sold) : "—"} />
          <Stat label="Davam edən" value={s ? String(s.active) : "—"} color="#059669" />
          <Stat label="Tamamlanıb" value={s ? String(s.completed) : "—"} />
          {(!s || s.cancelled > 0) && <Stat label="Ləğv" value={s ? String(s.cancelled) : "—"} color="#991B1B" />}
          <Stat label="Qazancınız" value={s ? formatAzn(s.revenue) : "—"} color="#1051B7" />
        </div>
        <CompletionRing pct={s?.completionPct ?? 0} />
      </div>

      {/* patient list link */}
      {patientCount === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#9DB0CC", borderTop: "1px solid #EDF1F8", paddingTop: 14 }}>
          <IUsers s={16} c="#9DB0CC" />Hələ bu paketi alan yoxdur
        </div>
      ) : (
        <Link href={`/psycholog/packages/${pkg.id}/patients`}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textDecoration: "none", borderTop: "1px solid #EDF1F8", paddingTop: 14 }}
          className="pk-patients-link">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#082F6D" }}>
            <IUsers s={16} c="#082F6D" />Bu paketi alan pasiyentlər ({patientCount})
          </span>
          <svg className="pk-arrow" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color ?? "var(--oxford)", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function CompletionRing({ pct }: { pct: number }) {
  const r = 25, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - v / 100);
  return (
    <div style={{ position: "relative", width: 60, height: 60, flex: "none" }}>
      <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="#F2F6FD" strokeWidth="6" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="#10B981" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#065F46", lineHeight: 1 }}>{v}%</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: "#8AAABF" }}>tamam.</span>
      </div>
    </div>
  );
}

/* ─── Individual price inline form ───────────────────────────────────────── */
function IndivPriceForm({ current, busy, onSave, onCancel }: {
  current: number | null;
  busy: boolean;
  onSave: (price: number) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const n = Number(val);
    if (!val.trim() || !Number.isFinite(n) || n < 0) { setErr("Düzgün qiymət daxil edin (0 və ya daha böyük)"); return; }
    onSave(n);
  };

  const field: React.CSSProperties = {
    border: "1px solid #D6E2F7", background: "#fff", borderRadius: 9,
    padding: "10px 12px", fontSize: 13.5, fontWeight: 600,
    color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box", width: "100%",
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
      <div style={{ flex: "0 0 180px" }}>
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 5 }}>Yeni qiymət (₼)</span>
          <input type="number" min={0} step="0.01" value={val} onChange={e => { setVal(e.target.value); setErr(null); }} placeholder="Məs. 80" style={field} />
        </label>
        {err && <div style={{ fontSize: 11.5, color: "#991B1B", marginTop: 5 }}>{err}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingBottom: 0, marginTop: 22 }}>
        <button onClick={submit} disabled={busy} style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>Saxla</button>
        <button onClick={onCancel} style={{ background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
      </div>
    </div>
  );
}

/* ─── Paket yaratma/redaktə popup-u — həm "Yeni paket", həm "Redaktə" bunu paylaşır ── */
function PackageFormModal({ initial, busy, onSave, onClose }: {
  initial?: { name: string; sessionCount: number; packagePrice: number; active?: boolean };
  busy: boolean;
  onSave: (req: PackageReq) => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,47,109,.45)", backdropFilter: "blur(4px)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "pkFade .18s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(520px, 100%)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 70px rgba(8,47,109,.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 22px 16px", borderBottom: "1px solid #F0F4FA" }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "#E4ECFA", color: "#1051B7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <ICube s={19} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--oxford-60)" }}>{initial ? "Paket" : "Yeni paket"}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--oxford)" }}>{initial ? "Paketi redaktə et" : "Paket təklifi yarat"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla"
            style={{ width: 34, height: 34, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F2F6FD", border: "none", borderRadius: 9, color: "var(--oxford-60)", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px 22px" }}>
          <PackageForm initial={initial} busy={busy} onSave={onSave} onCancel={onClose} />
        </div>
      </div>
    </div>
  );
}

/* ─── Reusable add/edit form ──────────────────────────────────────────────── */
function PackageForm({ initial, onSave, onCancel, busy, compact }: {
  initial?: { name: string; sessionCount: number; packagePrice: number; active?: boolean };
  onSave: (req: PackageReq) => void;
  onCancel: () => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sessions, setSessions] = useState(initial ? String(initial.sessionCount) : "");
  const [price, setPrice] = useState(initial ? String(initial.packagePrice) : "");
  const [active, setActive] = useState(initial?.active ?? true);

  const submit = () => {
    const sc = Number(sessions), pp = Number(price);
    if (!name.trim()) { toast("Ad lazımdır", "error"); return; }
    if (!Number.isFinite(sc) || sc < 1) { toast("Seans sayı düzgün deyil", "error"); return; }
    if (!Number.isFinite(pp) || pp < 0) { toast("Qiymət düzgün deyil", "error"); return; }
    onSave({ name: name.trim(), sessionCount: sc, packagePrice: pp, active });
  };

  const field: React.CSSProperties = {
    width: "100%", border: "1px solid #D6E2F7", background: "#fff", borderRadius: compact ? 9 : 10,
    padding: compact ? "10px 12px" : "11px 13px", fontSize: compact ? 13.5 : 14, fontWeight: 600,
    color: "var(--oxford)", fontFamily: "inherit", boxSizing: "border-box",
  };
  const lab: React.CSSProperties = { display: "block", fontSize: compact ? 11 : 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: compact ? 5 : 6 };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: compact ? 11 : 12, marginBottom: 12 }}>
        <label><span style={lab}>Ad</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Məs. 10 seanslıq proqram" style={field} /></label>
        <label><span style={lab}>Seans</span><input type="number" min={1} value={sessions} onChange={e => setSessions(e.target.value)} placeholder="10" style={field} /></label>
        <label><span style={lab}>Qiymət (₼)</span><input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="450" style={field} /></label>
      </div>
      {initial && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--oxford)" }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--brand)" }} />
          Aktiv (satışda göstərilsin)
        </label>
      )}
      <div style={{ display: "flex", gap: compact ? 9 : 10 }}>
        <button onClick={submit} disabled={busy} style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: compact ? 9 : 10, padding: compact ? "10px 16px" : "11px 18px", fontSize: compact ? 13.5 : 14, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer" }}>{initial ? "Saxla" : "Əlavə et"}</button>
        <button onClick={onCancel} style={{ background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: compact ? 9 : 10, padding: compact ? "10px 16px" : "11px 18px", fontSize: compact ? 13.5 : 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ləğv</button>
      </div>
    </>
  );
}

function MenuBtn({ children, onClick, icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`pk-menu-item${danger ? " pk-menu-item--danger" : ""}`}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontWeight: 600, color: danger ? "#991B1B" : "var(--oxford)", cursor: "pointer", fontFamily: "inherit" }}>
      {icon}{children}
    </button>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */
type Ico = { s?: number; c?: string };
const sw = (s: number, c: string) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
function ICube({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /></svg>; }
function ICart({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.3a1 1 0 0 0 .9 1.7H17" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></svg>; }
function ICheckCircle({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>; }
function IDollar({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>; }
function IEdit({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>; }
function ITrash({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>; }
function IPlus({ s = 17, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M12 5v14M5 12h14" /></svg>; }
function IDots({ s = 16 }: Ico) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>; }
function IUsers({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IPause({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><circle cx="12" cy="12" r="9" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></svg>; }
function ICalendar({ s = 16, c = "currentColor" }: Ico) { return <svg {...sw(s, c)} aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>; }
