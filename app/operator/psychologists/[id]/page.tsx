"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { operatorApi, type OperatorPsychologistStat, type PackageDto, type PackageReq, type PriceChangeLogItem, type PsychologistNote, type PsychologistVacation } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "İyun", "İyul", "Avq", "Sen", "Okt", "Noy", "Dek"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); return `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`; };
const fmtScore = (n?: number | null) => n == null ? "—" : String(Math.round(n * 10) / 10);
const fmtRating = (n?: number | null) => n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1);
const initials = (n: string) => n.replace(/^Dr\.\s*/i, "").split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
function monthLabel(m: string) { const mm = /^(\d{4})-(\d{2})/.exec(m); return mm ? (MONTHS_SHORT[Number(mm[2]) - 1] ?? m) : m; }
function daysLeft(endDate: string) { const d = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000); return d >= 0 ? d : 0; }
function isOngoing(v: PsychologistVacation) { const today = new Date().toISOString().slice(0, 10); return !v.cancelledAt && v.startDate <= today && v.endDate >= today; }

export default function OperatorPsychologistDetailPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [stat, setStat] = useState<OperatorPsychologistStat | null>(null);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceChangeLogItem[]>([]);
  const [vacations, setVacations] = useState<PsychologistVacation[]>([]);
  const [notes, setNotes] = useState<PsychologistNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Qiymət & paket redaktəsi (Operator idarəetməsi — FANUS tip istisna)
  const [priceEditing, setPriceEditing] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pkgForm, setPkgForm] = useState<{ id: number | null; name: string; sessionCount: string; packagePrice: string; active: boolean } | null>(null);
  const [savingPkg, setSavingPkg] = useState(false);
  const [pkgError, setPkgError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError(true); setLoading(false); return; }
    Promise.all([
      operatorApi.psychologistStats(id),
      operatorApi.psychologistPackages(id).catch(() => []),
      operatorApi.psychologistVacations(id).catch(() => []),
      operatorApi.psychologistNotes(id).catch(() => []),
      operatorApi.psychologistPriceHistory(id).catch(() => []),
    ]).then(([s, pkgs, vac, n, hist]) => { setStat(s); setPackages(pkgs); setVacations(vac); setNotes(n); setPriceHistory(hist); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  }, [id]);

  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      const n = await operatorApi.addPsychologistNote(id, text);
      setNotes(prev => [n, ...prev]);
      setNoteText("");
    } catch { /* sakit uğursuzluq — istifadəçi yenidən cəhd edə bilər */ }
    finally { setSavingNote(false); }
  };

  const savePrice = async () => {
    const val = Number(priceInput);
    if (!Number.isFinite(val) || val < 0) { setPriceError("Qiymət düzgün deyil"); return; }
    setPriceError(null); setSavingPrice(true);
    try {
      const r = await operatorApi.setPsychologistPricing(id, val);
      setStat(prev => prev ? { ...prev, individualPrice: r.individualPrice, currency: r.currency } : prev);
      setPriceEditing(false);
      operatorApi.psychologistPriceHistory(id).then(setPriceHistory).catch(() => {});
    } catch (e) { setPriceError((e as Error).message); }
    finally { setSavingPrice(false); }
  };

  const savePkg = async () => {
    if (!pkgForm) return;
    const sessionCount = Number(pkgForm.sessionCount), packagePrice = Number(pkgForm.packagePrice);
    if (!pkgForm.name.trim()) { setPkgError("Ad tələb olunur"); return; }
    if (!Number.isFinite(sessionCount) || sessionCount < 2) { setPkgError("Seans sayı düzgün deyil"); return; }
    if (!Number.isFinite(packagePrice) || packagePrice < 0) { setPkgError("Qiymət düzgün deyil"); return; }
    const data: PackageReq = { name: pkgForm.name.trim(), sessionCount, packagePrice, active: pkgForm.active };
    setPkgError(null); setSavingPkg(true);
    try {
      const saved = pkgForm.id == null
        ? await operatorApi.createPsychologistPackage(id, data)
        : await operatorApi.updatePsychologistPackage(id, pkgForm.id, data);
      setPackages(prev => pkgForm.id == null ? [...prev, saved] : prev.map(p => p.id === saved.id ? saved : p));
      setPkgForm(null);
      operatorApi.psychologistPriceHistory(id).then(setPriceHistory).catch(() => {});
    } catch (e) { setPkgError((e as Error).message); }
    finally { setSavingPkg(false); }
  };

  const deletePkg = async (pkgId: number) => {
    if (!window.confirm("Bu paketi silmək istədiyinizə əminsiniz?")) return;
    try {
      await operatorApi.deletePsychologistPackage(id, pkgId);
      setPackages(prev => prev.filter(p => p.id !== pkgId));
    } catch (e) { alert((e as Error).message); }
  };

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}><div className="op-loading">{t("common.loading")}</div></div>;

  if (error || !stat) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Back />
        <div style={{ ...CARD, padding: "40px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", marginTop: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#FEE2E2", color: "#991B1B", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
            <Ico d={["M12 8v4M12 16h.01"]} extra={<circle cx="12" cy="12" r="10" />} size={25} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 9, color: "var(--oxford)" }}>Profil yüklənmədi</div>
          <Link href="/operator/psychologists" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-700)", textDecoration: "none" }}>← Psixoloqlar</Link>
        </div>
      </div>
    );
  }

  const isFanus = (stat.psychologistType ?? "").toUpperCase() === "FANUS";
  const av = avatarOf(id);
  const completed = stat.completedCount, cancelled = stat.cancelledCount;
  const totalCC = completed + cancelled;
  const completionPct = totalCC > 0 ? Math.round((completed / totalCC) * 100) : 0;
  const currentVacation = vacations.find(isOngoing);
  const highRejection = (stat.rejectionRatePct ?? 0) > 20;

  const kpis = [
    { label: "Ümumi seans", value: String(stat.totalSessions), sub: "bütün vaxt", numColor: "#082F6D", iconColor: "#1051B7", icon: ["M23 7l-7 5 7 5V7z", "M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1z"] },
    { label: "Bu ay seans", value: String(stat.currentMonthSessions), sub: "cari ay", numColor: "#047857", iconColor: "#047857", icon: ["M3 9h18 M3 4h18v16H3z", "M8 2v4M16 2v4"] },
    { label: "Gəlir", value: formatAzn(stat.revenue) || "—", sub: "net (geri qaytarmadan sonra)", numColor: "#047857", iconColor: "#047857", icon: ["M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"] },
    { label: "Orta reytinq", value: fmtRating(stat.averageRating), sub: `${stat.totalReviews} rəy`, numColor: "#374151", iconColor: "#F59E0B", icon: ["M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7.2L12 17.8 5.8 21.4l1.6-7.2L2 9.5l7.1-.6z"] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.ps-num{font-variant-numeric:tabular-nums}`}</style>
      <Back />

      {/* HERO */}
      <div style={{ ...CARD, padding: 20, margin: "16px 0 18px", display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <span style={{ width: 58, height: 58, borderRadius: 16, background: av.bg, color: av.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "none" }}>{initials(stat.name)}</span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 7 }}>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford)" }}>{stat.name}</h1>
            <span style={{ background: isFanus ? "#E4ECFA" : "#F3F4F6", color: isFanus ? "#082F6D" : "#374151", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", padding: "4px 10px", borderRadius: 999 }}>{isFanus ? "FANUS" : "NORMAL"}</span>
            {stat.suspendedAt && <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>Dayandırılıb{stat.suspendReason ? ` — ${stat.suspendReason}` : ""}</span>}
            {currentVacation && <span style={{ background: "#EDE9FE", color: "#5B21B6", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>Məzuniyyətdə — {daysLeft(currentVacation.endDate)} gün qalıb</span>}
            {stat.commissionPercent != null && <span style={{ background: "#F0F4FA", color: "var(--oxford-60)", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>Xüsusi komissiya: {stat.commissionPercent}%</span>}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--oxford-60)", fontWeight: 500, marginBottom: 8 }}>
            {stat.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PhoneIcon />{stat.phone}</span>}
            {stat.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MailIcon />{stat.email}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stat.phone && <a href={`tel:${stat.phone}`} style={actionBtn}><PhoneIcon />Zəng</a>}
            {stat.email && <a href={`mailto:${stat.email}`} style={actionBtn}><MailIcon />Email</a>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", borderLeft: "1px dashed #E9EEF5", paddingLeft: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 4 }}>Reytinq</div>
            <div className="ps-num" style={{ fontSize: 24, fontWeight: 800, color: "var(--oxford)" }}>★ {fmtRating(stat.averageRating)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 4 }}>Tamamlanmış</div>
            <div className="ps-num" style={{ fontSize: 24, fontWeight: 800, color: "var(--oxford)" }}>{completed}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 4 }}>Aktiv pasiyent</div>
            <div className="ps-num" style={{ fontSize: 24, fontWeight: 800, color: "var(--oxford)" }}>{stat.activePatients}</div>
          </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(165px, 100%), 1fr))", gap: 13, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, padding: "15px 17px", position: "relative" }}>
            <span style={{ position: "absolute", top: 15, right: 15, color: k.iconColor }}><Ico d={k.icon} /></span>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>{k.label}</div>
            <div className="ps-num" style={{ fontSize: 21, fontWeight: 800, color: k.numColor, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: "#9DB0CC", fontWeight: 600, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* İKİ SÜTUN */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {/* Tamamlanma + aylıq dinamika */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 15 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>Tamamlanma</div>
              <div className="ps-num" style={{ fontSize: 22, fontWeight: 800, color: "#047857" }}>{completionPct}%</div>
            </div>
            <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", marginBottom: 12, background: "#F3F4F6" }}>
              {completed > 0 && <div style={{ width: `${totalCC > 0 ? (completed / totalCC) * 100 : 0}%`, background: "#10B981" }} />}
              {cancelled > 0 && <div style={{ width: `${totalCC > 0 ? (cancelled / totalCC) * 100 : 0}%`, background: "#DC2626" }} />}
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
              <LegendItem color="#10B981" label="Tamamlandı" value={completed} />
              <LegendItem color="#DC2626" label="Ləğv" value={cancelled} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12, borderTop: "1px solid #F4F7FB", paddingTop: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, flex: 1, color: "var(--oxford)" }}>Aylıq dinamika</div>
              <Leg color="#1051B7" t="Cəmi" /><Leg color="#10B981" t="Tamamlanmış" /><Leg color="#DC2626" t="Ləğv" />
            </div>
            {stat.monthlyDynamics.length === 0 ? (
              <div style={{ height: 130, border: "1px dashed #D6E2F7", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9DB0CC", fontWeight: 600 }}>Aylıq məlumat yoxdur</div>
            ) : (
              <MonthlyChart data={stat.monthlyDynamics} />
            )}
          </div>

          {/* Qiymət & Paketlər */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>Qiymət & Paketlər</div>
              {isFanus && <span style={{ fontSize: 11, color: "#9DB0CC", fontWeight: 600 }}>FANUS — psixoloq özü dəyişə bilmir, operator/admin idarə edir</span>}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 12, padding: "12px 16px", flex: "none", minWidth: 180 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oxford-60)", marginBottom: 6 }}>Fərdi seans</div>
                {priceEditing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input value={priceInput} onChange={e => setPriceInput(e.target.value)} type="number" min={0} step="0.01" autoFocus style={{ width: 90, border: "1px solid #D6E2F7", borderRadius: 8, padding: "6px 8px", fontSize: 13, fontFamily: "inherit" }} />
                    <button type="button" onClick={savePrice} disabled={savingPrice} style={miniActionBtn}>{savingPrice ? "…" : "Saxla"}</button>
                    <button type="button" onClick={() => { setPriceEditing(false); setPriceError(null); }} style={miniGhostBtn}>Ləğv</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {stat.individualPrice != null
                      ? <span className="ps-num" style={{ fontSize: 18, fontWeight: 800, color: "var(--oxford)" }}>{formatAzn(stat.individualPrice)}</span>
                      : <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>Qiymət təyin olunmayıb</span>}
                    <button type="button" onClick={() => { setPriceInput(stat.individualPrice != null ? String(stat.individualPrice) : ""); setPriceEditing(true); }} style={miniGhostBtn}>Dəyiş</button>
                  </div>
                )}
                {priceError && <div style={{ fontSize: 11.5, color: "#991B1B", fontWeight: 600, marginTop: 6 }}>{priceError}</div>}
              </div>
            </div>

            {packages.length === 0 && !pkgForm ? (
              <div style={{ fontSize: 12.5, color: "#9DB0CC", fontWeight: 600, border: "1px dashed #E9EEF5", borderRadius: 10, padding: "14px 12px", textAlign: "center", marginBottom: 12 }}>Paket yoxdur</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {packages.map(pk => (
                  <div key={pk.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)", flex: 1, minWidth: 120 }}>{pk.name}</span>
                    <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{pk.sessionCount} seans</span>
                    <span className="ps-num" style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>{formatAzn(pk.packagePrice)}</span>
                    <span style={{ background: pk.active ? "#ECFDF5" : "#F3F4F6", color: pk.active ? "#047857" : "#6B7280", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>{pk.active ? "Aktiv" : "Deaktiv"}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => setPkgForm({ id: pk.id, name: pk.name, sessionCount: String(pk.sessionCount), packagePrice: String(pk.packagePrice), active: pk.active })} style={miniGhostBtn}>Redaktə</button>
                      <button type="button" onClick={() => deletePkg(pk.id)} style={{ ...miniGhostBtn, color: "#991B1B" }}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(pkgForm ? (
              <div style={{ background: "#F8FAFD", border: "1px solid #D6E2F7", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder="Paket adı" style={{ flex: 1, minWidth: 120, border: "1px solid #D6E2F7", borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit" }} />
                  <input value={pkgForm.sessionCount} onChange={e => setPkgForm({ ...pkgForm, sessionCount: e.target.value })} type="number" min={2} placeholder="Seans sayı" style={{ width: 100, border: "1px solid #D6E2F7", borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit" }} />
                  <input value={pkgForm.packagePrice} onChange={e => setPkgForm({ ...pkgForm, packagePrice: e.target.value })} type="number" min={0} step="0.01" placeholder="Qiymət (AZN)" style={{ width: 120, border: "1px solid #D6E2F7", borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit" }} />
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)" }}>
                    <input type="checkbox" checked={pkgForm.active} onChange={e => setPkgForm({ ...pkgForm, active: e.target.checked })} />Aktiv
                  </label>
                </div>
                {pkgError && <div style={{ fontSize: 11.5, color: "#991B1B", fontWeight: 600 }}>{pkgError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={savePkg} disabled={savingPkg} style={{ ...miniActionBtn, padding: "7px 14px" }}>{savingPkg ? "Saxlanılır…" : "Saxla"}</button>
                  <button type="button" onClick={() => { setPkgForm(null); setPkgError(null); }} style={{ ...miniGhostBtn, padding: "7px 14px" }}>Ləğv</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setPkgForm({ id: null, name: "", sessionCount: "", packagePrice: "", active: true })} style={{ ...miniGhostBtn, padding: "8px 14px", border: "1px dashed #D6E2F7" }}>+ Yeni paket</button>
            ))}

            {priceHistory.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #F4F7FB", paddingTop: 12 }}>
                <button type="button" onClick={() => setHistoryOpen(o => !o)} style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 700, color: "var(--brand-700)", cursor: "pointer", fontFamily: "inherit" }}>
                  Qiymət tarixçəsi {historyOpen ? "▲" : "▼"}
                </button>
                {historyOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {priceHistory.map(h => (
                      <div key={h.id} style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>
                        {h.target === "PACKAGE" ? "Paket" : "Fərdi"}: {h.oldPrice != null ? formatAzn(h.oldPrice) : "—"} → <b style={{ color: "var(--oxford)" }}>{formatAzn(h.newPrice)}</b> · {h.changedByRole} · {fmtDate(h.createdAt)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {/* Qayğı/Risk paneli */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Qayğı paneli</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: highRejection ? 14 : 0 }}>
              <RiskRow label="Rədd faizi (30 gün)" value={stat.rejectionRatePct != null ? `${stat.rejectionRatePct}%` : "—"} warn={highRejection} />
              <RiskRow label="Orta təsdiq vaxtı" value={stat.avgConfirmMinutes != null ? `${Math.round(stat.avgConfirmMinutes)} dəq` : "—"} />
              <RiskRow label="Bu ay ləğv" value={String(cancelled)} />
            </div>
            {highRejection && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#92400E", fontWeight: 600 }}>
                Rədd faizi yüksəkdir — səbəbini soruşmaq üçün zəng edin.
              </div>
            )}
          </div>

          {/* Operator qeydləri */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Operator qeydləri</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, maxHeight: 260, overflowY: "auto" }}>
              {notes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#9DB0CC", fontWeight: 600, border: "1px dashed #E9EEF5", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>Hələ qeyd yoxdur</div>
              ) : notes.map(n => (
                <div key={n.id} style={{ background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, color: "var(--oxford)", fontWeight: 500, marginBottom: 6, whiteSpace: "pre-wrap" }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: "var(--oxford-60)", fontWeight: 600 }}>{n.authorName ?? "Operator"} · {fmtDate(n.createdAt)}</div>
                </div>
              ))}
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Qeyd əlavə et…" style={{ width: "100%", border: "1px solid #D6E2F7", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 8 }} />
            <button type="button" onClick={addNote} disabled={savingNote || !noteText.trim()} style={{ width: "100%", background: "var(--brand)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: savingNote ? "wait" : "pointer", opacity: savingNote || !noteText.trim() ? 0.6 : 1 }}>
              {savingNote ? "Saxlanılır…" : "Qeyd əlavə et"}
            </button>
          </div>

          {/* Əlçatanlıq & Məzuniyyətlər */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--oxford)" }}>Əlçatanlıq & Məzuniyyətlər</div>
            {stat.next7FullnessPct != null && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 6 }}>
                  <span>Növbəti 7 gün</span>
                  <span className="ps-num">{stat.next7Booked}/{stat.next7Booked + stat.next7FreeSlots} slot dolu ({Math.round(stat.next7FullnessPct)}%)</span>
                </div>
                <div style={{ height: 10, background: "#F3F4F6", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, stat.next7FullnessPct)}%`, height: "100%", background: "linear-gradient(90deg,#1051B7,#3A74D6)" }} />
                </div>
              </div>
            )}
            {vacations.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#9DB0CC", fontWeight: 600, border: "1px dashed #E9EEF5", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>Məzuniyyət qeydi yoxdur</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vacations.filter(v => !v.cancelledAt).map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--oxford)" }}>{fmtDate(v.startDate)} – {fmtDate(v.endDate)}</span>
                    {v.reason && <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 500 }}>{v.reason}</span>}
                    {v.notifyPatients && <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: "#047857", background: "#ECFDF5", padding: "3px 8px", borderRadius: 999 }}>Pasiyentlərə bildirilib</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8" };
const actionBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#082F6D", background: "#F0F4FA", border: "1px solid #D6E2F7", borderRadius: 9, padding: "7px 13px", textDecoration: "none" };
const miniActionBtn: React.CSSProperties = { background: "var(--brand)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };
const miniGhostBtn: React.CSSProperties = { background: "#fff", color: "var(--oxford-60)", border: "1px solid #D6E2F7", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };
const AVS = [{ bg: "#E0EBFA", color: "#1E3A8A" }, { bg: "#D1FAE5", color: "#065F46" }, { bg: "#FEF3C7", color: "#92400E" }, { bg: "#EDE9FE", color: "#5B21B6" }, { bg: "#FCE7F3", color: "#9D174D" }];
const avatarOf = (i: number) => AVS[Math.abs(i) % AVS.length];

function Back() {
  return <Link href="/operator/psychologists" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand-700)", textDecoration: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Psixoloqlar</Link>;
}
function PhoneIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>; }
function MailIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>; }
function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--oxford-60)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />{label}: <b style={{ color: "var(--oxford)" }}>{value}</b></span>;
}
function Leg({ color, t }: { color: string; t: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--oxford-60)" }}><span style={{ width: 10, height: 3, borderRadius: 2, background: color }} />{t}</span>;
}
function RiskRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
      <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>{label}</span>
      <span className="ps-num" style={{ fontWeight: 700, color: warn ? "#991B1B" : "var(--oxford)" }}>{value}</span>
    </div>
  );
}

function MonthlyChart({ data }: { data: { month: string; total: number; completed: number; cancelled: number }[] }) {
  const W = 860, H = 190, padL = 30, padR = 12, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = Math.max(1, data.length);
  const max = Math.max(...data.map(d => d.total), 1);
  const x = (i: number) => padL + (n > 1 ? iw * i / (n - 1) : iw / 2);
  const y = (v: number) => padT + ih * (1 - v / max);
  const line = (arr: number[], color: string) => {
    let d = ""; arr.forEach((v, i) => { d += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; });
    return <g><path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />{arr.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />)}</g>;
  };
  const step = data.length > 8 ? Math.ceil(data.length / 8) : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }}>
      {[0, max / 2, max].map((g, k) => <g key={k}><line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#F0F4FA" strokeWidth={1} /><text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize={9} fontWeight={600} fill="#9DB0CC">{Math.round(g)}</text></g>)}
      {line(data.map(d => d.total), "#1051B7")}
      {line(data.map(d => d.completed), "#10B981")}
      {line(data.map(d => d.cancelled), "#DC2626")}
      {data.map((d, i) => i % step === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="#9DB0CC">{monthLabel(d.month)}</text> : null)}
    </svg>
  );
}

function Ico({ d, extra, size = 17 }: { d: string | string[]; extra?: ReactNode; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{extra}{paths.map((p, i) => <path key={i} d={p} />)}</svg>;
}
