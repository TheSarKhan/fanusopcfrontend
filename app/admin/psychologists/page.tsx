"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type Psychologist, type PsychologistApplication } from "@/lib/api";
import { IconSearch, IconPlus, IconDownload } from "../_components/icons";

type MainTab = "psychologists" | "applications";
type Filter = "all" | "active" | "inactive";
type AppFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

const EMPTY: Omit<Psychologist, "id"> = {
  name: "", title: "", specializations: [], experience: "",
  sessionsCount: "", rating: "", photoUrl: "", accentColor: "#2f5283",
  bgColor: "#eef1f7", displayOrder: 0, active: true,
};

const AV_COLORS = ["#7c6f99", "#7c9a86", "#b58a3c", "#2f5283", "#0a2d59", "#5d6b85"];

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  const hash = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0);
  return AV_COLORS[hash % AV_COLORS.length];
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric" });
}

export default function PsychologistsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("psychologists");

  // ── Psychologists state ──────────────────────────────────────────────────
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Psychologist, "id">; id?: number } | null>(null);
  const [specsInput, setSpecsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── Applications state ───────────────────────────────────────────────────
  const [apps, setApps] = useState<PsychologistApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appFilter, setAppFilter] = useState<AppFilter>("PENDING");
  const [appSearch, setAppSearch] = useState("");
  const [detailApp, setDetailApp] = useState<PsychologistApplication | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; firstName: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadPsychologists = () => {
    setLoading(true);
    adminApi.getPsychologists().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  const loadApplications = () => {
    setAppsLoading(true);
    adminApi.getApplications().then(setApps).catch(() => {}).finally(() => setAppsLoading(false));
  };

  useEffect(() => { loadPsychologists(); loadApplications(); }, []);

  const pendingCount = useMemo(() => apps.filter((a) => a.status === "PENDING").length, [apps]);

  // ── Psychologist filters ─────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: items.length,
    active: items.filter((i) => i.active).length,
    inactive: items.filter((i) => !i.active).length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (filter === "active" && !p.active) return false;
      if (filter === "inactive" && p.active) return false;
      if (q) {
        if (!`${p.name} ${p.title} ${p.specializations.join(" ")}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filter]);

  // ── Application filters ──────────────────────────────────────────────────
  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return apps.filter((a) => {
      if (appFilter !== "all" && a.status !== appFilter) return false;
      if (q) {
        if (!`${a.firstName} ${a.lastName} ${a.email} ${a.specializations ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [apps, appFilter, appSearch]);

  const appCounts = useMemo(() => ({
    all: apps.length,
    PENDING: apps.filter((a) => a.status === "PENDING").length,
    APPROVED: apps.filter((a) => a.status === "APPROVED").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
  }), [apps]);

  // ── Psychologist modal actions ───────────────────────────────────────────
  const openCreate = () => { setSpecsInput(""); setModal({ open: true, item: { ...EMPTY } }); };
  const openEdit = (p: Psychologist) => { setSpecsInput(p.specializations.join(", ")); setModal({ open: true, item: { ...p }, id: p.id }); };
  const close = () => setModal(null);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    const data = { ...modal.item, specializations: specsInput.split(",").map((s) => s.trim()).filter(Boolean) };
    try {
      if (modal.id) await adminApi.updatePsychologist(modal.id, data);
      else await adminApi.createPsychologist(data);
      close();
      loadPsychologists();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    try { await adminApi.deletePsychologist(id); loadPsychologists(); }
    catch (e) { alert((e as Error).message); }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modal) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadFile(file);
      setModal((m) => (m ? { ...m, item: { ...m.item, photoUrl: url } } : m));
    } catch { alert("Yükləmə uğursuz oldu"); }
    finally { setUploading(false); }
  };

  // ── Application actions ──────────────────────────────────────────────────
  const approve = async (id: number) => {
    if (!confirm("Bu müraciəti təsdiqləyirsiniz? Psixoloqun hesabı aktiv olacaq.")) return;
    setActionLoading(true);
    try {
      await adminApi.approveApplication(id);
      loadApplications();
      loadPsychologists();
      setDetailApp(null);
    } catch (e) { alert((e as Error).message); }
    finally { setActionLoading(false); }
  };

  const openReject = (id: number, firstName: string) => { setRejectNote(""); setRejectModal({ id, firstName }); };
  const confirmReject = async () => {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      await adminApi.rejectApplication(rejectModal.id, rejectNote || undefined);
      setRejectModal(null);
      loadApplications();
      setDetailApp(null);
    } catch (e) { alert((e as Error).message); }
    finally { setActionLoading(false); }
  };

  const statusPill = (status: string) => {
    if (status === "PENDING") return <span className="pill gold"><span className="dot" />Gözləyir</span>;
    if (status === "APPROVED") return <span className="pill sage"><span className="dot" />Təsdiqləndi</span>;
    return <span className="pill muted"><span className="dot" />Rədd edildi</span>;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Psixoloqlar</h1>
          <p className="page-sub">{counts.all} psixoloq qeydiyyatda, {counts.active} aktiv.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><IconDownload size={14} />CSV ixrac</button>
          <button className="btn primary" onClick={openCreate}>
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Psixoloq əlavə et
          </button>
        </div>
      </div>

      {/* Main tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${mainTab === "psychologists" ? " active" : ""}`} onClick={() => setMainTab("psychologists")}>
          Psixoloqlar ({counts.all})
        </button>
        <button className={`tab${mainTab === "applications" ? " active" : ""}`} onClick={() => setMainTab("applications")}>
          Müraciətlər
          {pendingCount > 0 && <span className="badge" style={{ marginLeft: 6 }}>{pendingCount}</span>}
        </button>
      </div>

      {/* ─── Psychologists tab ─────────────────────────────────────────── */}
      {mainTab === "psychologists" && (
        <div className="table-wrap">
          <div className="toolbar">
            <div className="search">
              <IconSearch size={13} style={{ color: "var(--muted)" }} />
              <input placeholder="Ad, ixtisas..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {([
              { k: "all", label: `Hamısı (${counts.all})` },
              { k: "active", label: `Aktiv (${counts.active})` },
              { k: "inactive", label: `Passiv (${counts.inactive})` },
            ] as const).map((f) => (
              <button key={f.k} className={`filter${filter === f.k ? " active" : ""}`} onClick={() => setFilter(f.k)}>{f.label}</button>
            ))}
            <div className="toolbar-spacer" />
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>Psixoloq</th>
                <th>Vəzifə</th>
                <th>İxtisas</th>
                <th>Təcrübə</th>
                <th className="num">Sessiya</th>
                <th className="num">Reytinq</th>
                <th>Status</th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Heç bir psixoloq tapılmadı</td></tr>}
              {!loading && filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="row-avatar">
                      {p.photoUrl
                        ? <img src={p.photoUrl} alt={p.name} className="av" style={{ objectFit: "cover" }} />
                        : <div className="av" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>}
                      <div><div className="nm">{p.name}</div></div>
                    </div>
                  </td>
                  <td>{p.title}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.specializations.slice(0, 2).map((s) => <span className="pill ox" key={s}>{s}</span>)}
                      {p.specializations.length > 2 && <span className="pill muted">+{p.specializations.length - 2}</span>}
                    </div>
                  </td>
                  <td>{p.experience}</td>
                  <td className="num strong">{p.sessionsCount}</td>
                  <td className="num"><strong>{p.rating}</strong></td>
                  <td>
                    {p.active
                      ? <span className="pill sage"><span className="dot" />Aktiv</span>
                      : <span className="pill muted"><span className="dot" />Passiv</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn sm ghost" onClick={() => openEdit(p)}>Redaktə</button>
                      <button className="btn sm danger" onClick={() => remove(p.id)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Applications tab ──────────────────────────────────────────── */}
      {mainTab === "applications" && (
        <div className="table-wrap">
          <div className="toolbar">
            <div className="search">
              <IconSearch size={13} style={{ color: "var(--muted)" }} />
              <input placeholder="Ad, email, ixtisas..." value={appSearch} onChange={(e) => setAppSearch(e.target.value)} />
            </div>
            {([
              { k: "PENDING", label: `Gözləyir (${appCounts.PENDING})` },
              { k: "APPROVED", label: `Təsdiqləndi (${appCounts.APPROVED})` },
              { k: "REJECTED", label: `Rədd edildi (${appCounts.REJECTED})` },
              { k: "all", label: `Hamısı (${appCounts.all})` },
            ] as const).map((f) => (
              <button key={f.k} className={`filter${appFilter === f.k ? " active" : ""}`} onClick={() => setAppFilter(f.k)}>{f.label}</button>
            ))}
            <div className="toolbar-spacer" />
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>Müraciətçi</th>
                <th>Universitet</th>
                <th>İxtisas</th>
                <th>Təcrübə</th>
                <th>Tarix</th>
                <th>Status</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {appsLoading && <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</td></tr>}
              {!appsLoading && filteredApps.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                  {appFilter === "PENDING" ? "Gözləyən müraciət yoxdur" : "Müraciət tapılmadı"}
                </td></tr>
              )}
              {!appsLoading && filteredApps.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="row-avatar">
                      <div className="av" style={{ background: avatarColor(a.firstName + a.lastName) }}>
                        {initials(a.firstName + " " + a.lastName)}
                      </div>
                      <div>
                        <div className="nm">{a.firstName} {a.lastName}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{a.university}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.degree} · {a.graduationYear}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {a.specializations?.split(",").slice(0, 2).map((s) => <span className="pill ox" key={s}>{s.trim()}</span>)}
                      {(a.specializations?.split(",").length ?? 0) > 2 && (
                        <span className="pill muted">+{(a.specializations?.split(",").length ?? 2) - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>{a.experienceYears ? `${a.experienceYears} il` : "—"}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{fmtDate(a.createdAt)}</td>
                  <td>{statusPill(a.status)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn sm ghost" onClick={() => setDetailApp(a)}>Bax</button>
                      {a.status === "PENDING" && (
                        <>
                          <button className="btn sm" style={{ background: "var(--sage)", color: "#fff", border: "none" }}
                            disabled={actionLoading} onClick={() => approve(a.id)}>
                            Təsdiqlə
                          </button>
                          <button className="btn sm danger" disabled={actionLoading}
                            onClick={() => openReject(a.id, a.firstName)}>
                            Rədd et
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Psychologist edit/create modal ───────────────────────────────── */}
      {modal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal">
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Psixoloqu redaktə et" : "Yeni psixoloq əlavə et"}</div>
              <button className="btn ghost icon-only sm" onClick={close}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Ad Soyad">
                  <input className="input" placeholder="Leyla Hüseynova" value={modal.item.name}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, name: e.target.value } }))} />
                </Field>
                <Field label="Vəzifə / titul">
                  <input className="input" placeholder="Klinik Psixoloq" value={modal.item.title}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, title: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Təcrübə">
                  <input className="input" placeholder="8 il" value={modal.item.experience}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, experience: e.target.value } }))} />
                </Field>
                <Field label="Sessiya sayı">
                  <input className="input" placeholder="400+" value={modal.item.sessionsCount}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, sessionsCount: e.target.value } }))} />
                </Field>
                <Field label="Reytinq">
                  <input className="input" placeholder="4.9" value={modal.item.rating}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, rating: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="İxtisaslar (vergüllə)">
                  <input className="input" placeholder="Anksiyete, depressiya, münasibətlər" value={specsInput}
                    onChange={(e) => setSpecsInput(e.target.value)} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Accent rəngi">
                  <input className="input mono" value={modal.item.accentColor}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, accentColor: e.target.value } }))} />
                </Field>
                <Field label="Arxa plan rəngi">
                  <input className="input mono" value={modal.item.bgColor}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, bgColor: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Foto">
                  <input type="file" accept="image/*" onChange={upload} style={{ fontSize: 12 }} />
                  {uploading && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Yüklənir…</div>}
                  {modal.item.photoUrl && <img src={modal.item.photoUrl} alt="" style={{ marginTop: 8, height: 80, borderRadius: 8 }} />}
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12, alignItems: "center" }}>
                <Field label="Sıra nömrəsi">
                  <input type="number" className="input" value={modal.item.displayOrder}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, displayOrder: Number(e.target.value) } }))} />
                </Field>
                <div className="row" style={{ marginTop: 22, gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Aktiv</span>
                  <button className={`switch${modal.item.active ? " on" : ""}`}
                    onClick={() => setModal((m) => m && ({ ...m, item: { ...m.item, active: !m.item.active } }))} />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={close}>Ləğv et</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saxlanır…" : "Saxla"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Application detail modal ──────────────────────────────────────── */}
      {detailApp && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setDetailApp(null); }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <div className="modal-title">Müraciət — {detailApp.firstName} {detailApp.lastName}</div>
              <button className="btn ghost icon-only sm" onClick={() => setDetailApp(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InfoRow label="Ad Soyad" value={`${detailApp.firstName} ${detailApp.lastName}`} />
                <InfoRow label="Email" value={detailApp.email} />
                <InfoRow label="Telefon" value={detailApp.phone ?? "—"} />
                <InfoRow label="Müraciət tarixi" value={fmtDate(detailApp.createdAt)} />
                <InfoRow label="Universitet" value={detailApp.university} />
                <InfoRow label="Dərəcə" value={`${detailApp.degree}, ${detailApp.graduationYear}`} />
                <InfoRow label="Təcrübə" value={detailApp.experienceYears ? `${detailApp.experienceYears} il` : "—"} />
                <InfoRow label="Fəaliyyət formatı" value={detailApp.activityFormat ?? "—"} />
              </div>
              {detailApp.specializations && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>İxtisaslar</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailApp.specializations.split(",").map((s) => <span className="pill ox" key={s}>{s.trim()}</span>)}
                  </div>
                </div>
              )}
              {detailApp.sessionTypes && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Sessiya növləri</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailApp.sessionTypes.split(",").map((s) => <span className="pill ox" key={s}>{s.trim()}</span>)}
                  </div>
                </div>
              )}
              {detailApp.languages && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Dillər</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailApp.languages.split(",").map((s) => <span className="pill ox" key={s}>{s.trim()}</span>)}
                  </div>
                </div>
              )}
              {detailApp.bio && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Bio</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>{detailApp.bio}</div>
                </div>
              )}
              {detailApp.diplomaFileUrl && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Diplom</div>
                  <a href={detailApp.diplomaFileUrl} target="_blank" rel="noreferrer" className="btn sm ghost">
                    Diplom faylını aç
                  </a>
                </div>
              )}
              {detailApp.adminNote && (
                <div style={{ marginTop: 12, background: "var(--ox-50)", borderRadius: 6, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Admin qeydi</div>
                  <div style={{ fontSize: 13 }}>{detailApp.adminNote}</div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {statusPill(detailApp.status)}
                {detailApp.reviewedAt && (
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDate(detailApp.reviewedAt)}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setDetailApp(null)}>Bağla</button>
                {detailApp.status === "PENDING" && (
                  <>
                    <button className="btn danger" disabled={actionLoading}
                      onClick={() => openReject(detailApp.id, detailApp.firstName)}>
                      Rədd et
                    </button>
                    <button className="btn primary" disabled={actionLoading}
                      onClick={() => approve(detailApp.id)}>
                      {actionLoading ? "…" : "Təsdiqlə"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject modal ─────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <div className="modal-title">Müraciəti rədd et</div>
              <button className="btn ghost icon-only sm" onClick={() => setRejectModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--ink)", marginBottom: 14 }}>
                <strong>{rejectModal.firstName}</strong> adlı müraciətçiyə rədd bildirişi göndəriləcək.
              </p>
              <Field label="Rədd səbəbi (ixtiyari — müraciətçiyə göndəriləcək)">
                <textarea className="input" rows={4} style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                  placeholder="Sənədlər natamam, ixtisas uyğun gəlmir..." value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)} />
              </Field>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setRejectModal(null)}>Ləğv et</button>
              <button className="btn danger" disabled={actionLoading} onClick={confirmReject}>
                {actionLoading ? "Göndərilir…" : "Rədd et"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
