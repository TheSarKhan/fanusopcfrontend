"use client";

import { useEffect, useState } from "react";
import {
  psychologistApi,
  type PackageDto,
  type PackageStats,
  type PackageReq,
  type PackagePatient,
  type Psychologist,
} from "@/lib/api";
import { formatAzn } from "@/lib/money";
import PageHeader from "@/components/PageHeader";
import { confirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

/* ─── Pasiyent paketi statusu ─────────────────────────────────────────────── */
const STATUS_PT: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: "Aktiv",       bg: "#D1FAE5", color: "#065F46" },
  EXHAUSTED: { label: "Tamamlanıb",  bg: "#F3F4F6", color: "#374151" },
  EXPIRED:   { label: "Vaxtı keçib", bg: "#FEF3C7", color: "#92400E" },
  CANCELLED: { label: "Ləğv",        bg: "#FEE2E2", color: "#991B1B" },
};

const TINTS = [
  { bg: "#E0EBFA", fg: "#1E3A8A" }, { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" }, { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" }, { bg: "#CCFBF1", fg: "#115E59" },
];
function avatarTint(name?: string | null) {
  const s = name ?? "?"; let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}
function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/* ═══ Page ════════════════════════════════════════════════════════════════ */

export default function PsychologPackagesPage() {
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [statsById, setStatsById] = useState<Record<number, PackageStats>>({});
  const [statsReady, setStatsReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    ]).then(([c, s, p, m]) => {
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

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <style>{`@keyframes pkFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .pk-icobtn:hover{border-color:var(--brand)!important;color:var(--brand)!important}
        .pk-del:hover{background:#FEE2E2!important}
        .pk-menu-item:hover{background:#F2F6FD!important}
        .pk-menu-item--danger:hover{background:#FEE2E2!important}`}</style>

      {/* Header */}
      <PageHeader
        title="Qiymətlər & Paketlər"
        subtitle="Paket təklifləriniz, satış və istifadə statistikası"
        actions={!isFanus && (
          <button onClick={() => setNewOpen(o => !o)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 17px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 14px rgba(16,81,183,.25)" }}>
            <IPlus />Yeni paket
          </button>
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

      {/* Summary stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px, 100%), 1fr))", gap: 13, marginBottom: 20 }}>
        <StatCard bg="#E4ECFA" color="#1051B7" icon={<ICube s={19} />} value={String(catalog.length)} label="Cəmi paket" />
        <StatCard bg="#E4ECFA" color="#1051B7" icon={<ICart s={19} />} value={statsReady ? String(sold) : "—"} label="Satılıb" />
        <StatCard bg="#D1FAE5" color="#065F46" icon={<ICheckCircle s={19} c="#065F46" />} value={statsReady ? String(active) : "—"} label="Aktiv" />
        <StatCard bg="#E4ECFA" color="#082F6D" icon={<IDollar s={19} c="#082F6D" />} value={statsReady ? formatAzn(revenue) : "—"} label="Ümumi gəlir" valueColor="#082F6D" />
      </div>

      {!statsReady && !loading && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 13px", marginBottom: 16 }}>
          Statistika hələ hazır deyil — backend yenilənməsindən sonra satış/istifadə rəqəmləri görünəcək. Paketləri indidən idarə edə bilərsiniz.
        </div>
      )}

      {/* New package form */}
      {newOpen && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #C7DBF6", borderTop: "3px solid var(--brand)", padding: 20, marginBottom: 18, animation: "pkFade .2s ease" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: "var(--oxford)" }}>Yeni paket təklifi</div>
          <PackageForm busy={busy} onSave={create} onCancel={() => setNewOpen(false)} />
        </div>
      )}

      {loading ? (
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {catalog.map(p => (
            <PackageCard key={p.id} pkg={p} stats={statsById[p.id]} busy={busy} readOnly={isFanus}
              onUpdate={update} onDelete={remove} onToggleActive={toggleActive} />
          ))}
        </div>
      )}
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const deaktiv = !pkg.active;
  const s = stats;
  const patientCount = s?.patients.length ?? 0;

  const save = (req: PackageReq) => { onUpdate(pkg.id, req); setEditing(false); };

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20, opacity: deaktiv ? 0.96 : 1 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 7 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: deaktiv ? "#F3F4F6" : "#E4ECFA", color: deaktiv ? "#6B7280" : "#082F6D", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 7 }}><ICube s={12} />Paket</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: deaktiv ? "var(--oxford-60)" : "var(--oxford)" }}>{pkg.name}</span>
            <span style={{ background: deaktiv ? "#F3F4F6" : "#D1FAE5", color: deaktiv ? "#6B7280" : "#065F46", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{deaktiv ? "Deaktiv" : "Aktiv"}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>
            {pkg.sessionCount} seans · {formatAzn(pkg.packagePrice)} · seans başına ≈ {formatAzn(pkg.perSessionPrice)}
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
            <button onClick={() => setEditing(e => !e)} title="Redaktə" className="pk-icobtn"
              style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: editing ? "#F2F6FD" : "#fff", color: editing ? "var(--brand)" : "var(--oxford-60)", border: `1px solid ${editing ? "#C7DBF6" : "#D6E2F7"}`, borderRadius: 9, cursor: "pointer" }}><IEdit /></button>
            <button onClick={() => onDelete(pkg)} title="Sil" className="pk-del"
              style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#991B1B", border: "1px solid #F3D6D6", borderRadius: 9, cursor: "pointer" }}><ITrash /></button>
          </div>
        )}
      </div>

      {/* inline edit */}
      {editing && !readOnly && (
        <div style={{ background: "#F2F6FD", border: "1px solid #D6E2F7", borderRadius: 12, padding: 15, marginBottom: 14, animation: "pkFade .2s ease" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#082F6D", marginBottom: 11 }}>Paketi redaktə et</div>
          <PackageForm compact busy={busy} initial={{ name: pkg.name, sessionCount: pkg.sessionCount, packagePrice: pkg.packagePrice, active: pkg.active }} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}

      {/* stats row */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", padding: "13px 0", borderTop: "1px solid #EDF1F8", borderBottom: "1px solid #EDF1F8", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Stat label="Satılıb" value={s ? String(s.sold) : "—"} />
          <Stat label="Aktiv" value={s ? String(s.active) : "—"} color="#065F46" />
          <Stat label="Tamamlanıb" value={s ? String(s.completed) : "—"} />
          {(!s || s.cancelled > 0) && <Stat label="Ləğv" value={s ? String(s.cancelled) : "—"} color="#991B1B" />}
          <Stat label="Gəlir" value={s ? formatAzn(s.revenue) : "—"} color="#082F6D" />
        </div>
        <CompletionRing pct={s?.completionPct ?? 0} />
      </div>

      {/* detail toggle */}
      <button onClick={() => setDetailOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#082F6D" }}>Bu paketi alan pasiyentlər ({patientCount})</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C6B85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: detailOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {detailOpen && (
        patientCount === 0 ? (
          <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "#9DB0CC", fontWeight: 600, background: "#F8FAFD", border: "1px dashed #D6E2F7", borderRadius: 11, padding: 20, animation: "pkFade .2s ease" }}>Hələ bu paketi alan yoxdur</div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9, animation: "pkFade .2s ease" }}>
            {s!.patients.map((pt, i) => <PatientRow key={i} p={pt} />)}
          </div>
        )
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color ?? "var(--oxford)" }}>{value}</div>
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

function PatientRow({ p }: { p: PackagePatient }) {
  const st = STATUS_PT[p.status] ?? STATUS_PT.ACTIVE;
  const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
  const tint = avatarTint(p.patientName);
  const done = p.status === "EXHAUSTED";
  const fill = p.status === "CANCELLED" ? "#EF4444" : done ? "#10B981" : "linear-gradient(90deg,#1051B7,#3A74D6)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: "11px 13px", flexWrap: "wrap" }}>
      <span style={{ width: 36, height: 36, borderRadius: 11, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(p.patientName)}</span>
      <div style={{ flex: 1, minWidth: 130 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{p.patientName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, maxWidth: 120, height: 6, background: done ? "#D1FAE5" : "#E4ECFA", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: fill, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)" }}>{p.completed}/{p.total}</span>
        </div>
      </div>
      <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{st.label}</span>
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
