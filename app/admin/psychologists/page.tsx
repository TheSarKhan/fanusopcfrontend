"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type Psychologist, type UserRecord } from "@/lib/api";
import { IconSearch, IconPlus, IconDownload, IconGrid, IconList, IconEye, IconCheck, IconX, IconAlert, IconChevron } from "../_components/icons";

type Filter = "all" | "active" | "inactive";

const EMPTY: Omit<Psychologist, "id"> = {
  name: "", title: "", specializations: [], experience: "",
  sessionsCount: "", rating: "", photoUrl: "",
  bio: "", phone: "", email: "", languages: "", sessionTypes: "", activityFormat: "",
  university: "", degree: "", graduationYear: "",
  accentColor: "#2f5283", bgColor: "#eef1f7", displayOrder: 0, active: true,
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
  if (!s) return "—";
  const d = new Date(s);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

export default function PsychologistsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // ── Psychologists state ──────────────────────────────────────────────────
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Psychologist, "id">; id?: number } | null>(null);
  const [specsInput, setSpecsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailPsychologist, setDetailPsychologist] = useState<Psychologist | null>(null);

  // ── "From user" modal state ──────────────────────────────────────────────
  const [fromUserOpen, setFromUserOpen] = useState(false);
  const [fromUserList, setFromUserList] = useState<UserRecord[]>([]);
  const [fromUserSearch, setFromUserSearch] = useState("");
  const [fromUserLoading, setFromUserLoading] = useState(false);
  const [fromUserAdding, setFromUserAdding] = useState<number | null>(null);

  // ── Add button dropdown ──────────────────────────────────────────────────
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const loadPsychologists = () => {
    setLoading(true);
    adminApi.getPsychologists().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadPsychologists(); }, []);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  const openFromUser = () => {
    setDropOpen(false);
    setFromUserSearch("");
    setFromUserOpen(true);
    setFromUserLoading(true);
    adminApi.getUsers("PSYCHOLOGIST")
      .then((users) => setFromUserList(users.filter((u) => !u.inPsychologistList)))
      .catch(() => {})
      .finally(() => setFromUserLoading(false));
  };

  const addFromUser = async (u: UserRecord) => {
    setFromUserAdding(u.id);
    try {
      await adminApi.addToPsychologists(u.id);
      setFromUserList((prev) => prev.filter((x) => x.id !== u.id));
      loadPsychologists();
      // Fetch the newly created psychologist profile and open edit modal
      try {
        const profile = await adminApi.getUserPsychologistProfile(u.id);
        setFromUserOpen(false);
        const specs = Array.isArray(profile.specializations) ? profile.specializations.join(", ") : "";
        setSpecsInput(specs);
        setModal({
          open: true,
          item: {
            name: profile.name ?? "",
            title: profile.title ?? "",
            specializations: profile.specializations ?? [],
            experience: profile.experience ?? "",
            sessionsCount: profile.sessionsCount ?? "",
            rating: profile.rating ?? "",
            photoUrl: profile.photoUrl ?? "",
            bio: profile.bio ?? "",
            phone: profile.phone ?? "",
            email: profile.email ?? "",
            languages: profile.languages ?? "",
            sessionTypes: profile.sessionTypes ?? "",
            activityFormat: profile.activityFormat ?? "",
            university: profile.university ?? "",
            degree: profile.degree ?? "",
            graduationYear: profile.graduationYear ?? "",
            accentColor: profile.accentColor ?? "#2f5283",
            bgColor: profile.bgColor ?? "#eef1f7",
            displayOrder: profile.displayOrder ?? 0,
            active: profile.active ?? true,
          },
          id: profile.id,
        });
      } catch {
        // Profile fetch failed — just close modal, list already refreshed
        setFromUserOpen(false);
      }
    } catch (e) { alert((e as Error).message); }
    finally { setFromUserAdding(null); }
  };



  // ── Psychologist filters ─────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: items.length,
    active: items.filter((i) => i.active).length,
    inactive: items.filter((i) => !i.active).length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((p) => {
        if (filter === "active" && !p.active) return false;
        if (filter === "inactive" && p.active) return false;
        if (q) {
          if (!`${p.name} ${p.title} ${p.specializations.join(" ")}`.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [items, search, filter]);

  // ── Psychologist modal actions ───────────────────────────────────────────
  const openCreate = () => { setSpecsInput(""); setModal({ open: true, item: { ...EMPTY } }); };
  const openEdit = (p: Psychologist) => {
    // Normalize all nullable fields so form inputs never receive null
    const item: Omit<Psychologist, "id"> = {
      name: p.name ?? "",
      title: p.title ?? "",
      specializations: Array.isArray(p.specializations) ? p.specializations : [],
      experience: p.experience ?? "",
      sessionsCount: p.sessionsCount ?? "",
      rating: p.rating ?? "",
      photoUrl: p.photoUrl ?? "",
      bio: p.bio ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      languages: p.languages ?? "",
      sessionTypes: p.sessionTypes ?? "",
      activityFormat: p.activityFormat ?? "",
      university: p.university ?? "",
      degree: p.degree ?? "",
      graduationYear: p.graduationYear ?? "",
      accentColor: p.accentColor ?? "#2f5283",
      bgColor: p.bgColor ?? "#eef1f7",
      displayOrder: p.displayOrder ?? 0,
      active: p.active ?? true,
    };
    setSpecsInput(item.specializations.join(", "));
    setModal({ open: true, item, id: p.id });
  };
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

  const updateOrder = async (p: Psychologist, newOrder: number) => {
    try {
      await adminApi.updatePsychologist(p.id, { ...p, displayOrder: newOrder });
      loadPsychologists();
    } catch (e) { alert((e as Error).message); }
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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Psixoloqlar</h1>
          <p className="page-sub">Sistemdə olan bütün psixoloqlar və onların profilləri.</p>
        </div>
        <div className="page-actions">
          <div className="btn-group" style={{ marginRight: 8 }}>
            <button className={`btn icon-only ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")} title="Siyahı görünüşü">
              <IconList size={16} />
            </button>
            <button className={`btn icon-only ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")} title="Kart görünüşü">
              <IconGrid size={16} />
            </button>
          </div>
          <button className="btn"><IconDownload size={14} />CSV ixrac</button>
          <div ref={dropRef} style={{ position: "relative" }}>
            <button className="btn primary" onClick={() => setDropOpen((o) => !o)}>
              <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
              Psixoloq əlavə et
              <span style={{ marginLeft: 4, opacity: 0.8 }}>▾</span>
            </button>
            {dropOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220,
                background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,.12)", zIndex: 50, overflow: "hidden",
              }}>
                <button className="btn ghost" style={{ width: "100%", justifyContent: "flex-start", borderRadius: 0, padding: "10px 16px", fontSize: 13 }}
                  onClick={() => { setDropOpen(false); openCreate(); }}>
                  <IconPlus size={13} /> Yeni psixoloq
                </button>
                <div style={{ height: 1, background: "var(--border)" }} />
                <button className="btn ghost" style={{ width: "100%", justifyContent: "flex-start", borderRadius: 0, padding: "10px 16px", fontSize: 13 }}
                  onClick={openFromUser}>
                  Mövcud istifadəçidən seç
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Psychologists list ─────────────────────────────────────────── */}
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
                <th style={{ width: 60 }}>Sıra</th>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                       <button className="btn ghost sm icon-only" style={{ padding: 2, height: 20, width: 20 }} onClick={() => updateOrder(p, (p.displayOrder ?? 0) - 1)}>
                         <IconChevron size={12} style={{ transform: "rotate(-90deg)" }} />
                       </button>
                       <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{p.displayOrder}</span>
                       <button className="btn ghost sm icon-only" style={{ padding: 2, height: 20, width: 20 }} onClick={() => updateOrder(p, (p.displayOrder ?? 0) + 1)}>
                         <IconChevron size={12} style={{ transform: "rotate(90deg)" }} />
                       </button>
                    </div>
                  </td>
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
                      <button className="btn sm ghost" onClick={() => setDetailPsychologist(p)}>Bax</button>
                      <button className="btn sm ghost" onClick={() => openEdit(p)}>Redaktə</button>
                      <button className="btn sm danger" onClick={() => remove(p.id)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      {viewMode === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginTop: 16 }}>
          {loading && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--muted)" }}>Yüklənir…</div>}
          {!loading && filtered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--muted)" }}>Heç bir psixoloq tapılmadı</div>}
          {!loading && filtered.map((p) => (
            <div key={p.id} className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid var(--border)", transition: "transform 0.2s, box-shadow 0.2s" }}>
              <div style={{ position: "relative", height: 100, background: p.bgColor || "var(--ox-50)" }}>
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
                   <span className={`pill ${p.active ? "sage" : "muted"}`} style={{ fontSize: 10 }}>{p.active ? "Aktiv" : "Passiv"}</span>
                </div>
                <div style={{ position: "absolute", bottom: -30, left: 16 }}>
                  {p.photoUrl 
                    ? <img src={p.photoUrl} alt="" style={{ width: 60, height: 60, borderRadius: 14, border: "3px solid #fff", objectFit: "cover", background: "#fff" }} />
                    : <div style={{ width: 60, height: 60, borderRadius: 14, border: "3px solid #fff", background: avatarColor(p.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>{initials(p.name)}</div>
                  }
                </div>
              </div>
              <div style={{ padding: "36px 16px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ox)" }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>{p.title}</div>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                   {p.specializations.slice(0, 3).map(s => <span key={s} className="pill ox" style={{ fontSize: 10 }}>{s}</span>)}
                   {p.specializations.length > 3 && <span className="pill muted" style={{ fontSize: 10 }}>+{p.specializations.length - 3}</span>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Təcrübə</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.experience}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Reytinq</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>⭐ {p.rating}</div>
                    </div>
                </div>

                <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
                   <button className="btn sm outline" style={{ flex: 1 }} onClick={() => setDetailPsychologist(p)}>Bax</button>
                   <button className="btn sm outline" style={{ flex: 1 }} onClick={() => openEdit(p)}>Redaktə</button>
                   <button className="btn sm danger icon-only" onClick={() => remove(p.id)}>✕</button>
                </div>
              </div>
            </div>
          ))}
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
                <Field label="Telefon">
                  <input className="input" placeholder="+994 50 000 00 00" value={modal.item.phone ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, phone: e.target.value } }))} />
                </Field>
                <Field label="Email">
                  <input className="input" placeholder="psixoloq@fanus.az" value={modal.item.email ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, email: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Bio">
                  <textarea className="input" rows={3} style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                    placeholder="Psixoloq haqqında qısa məlumat..." value={modal.item.bio ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, bio: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Dillər (vergüllə)">
                  <input className="input" placeholder="Azərbaycan, Rus, İngilis" value={modal.item.languages ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, languages: e.target.value } }))} />
                </Field>
                <Field label="Sessiya növləri (vergüllə)">
                  <input className="input" placeholder="Fərdi, Cütlük, Uşaq" value={modal.item.sessionTypes ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, sessionTypes: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Universitet">
                  <input className="input" placeholder="BDU" value={modal.item.university ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, university: e.target.value } }))} />
                </Field>
                <Field label="Dərəcə">
                  <input className="input" placeholder="Magistr" value={modal.item.degree ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, degree: e.target.value } }))} />
                </Field>
                <Field label="Məzun ili">
                  <input className="input" placeholder="2018" value={modal.item.graduationYear ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, graduationYear: e.target.value } }))} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <Field label="Fəaliyyət formatı">
                  <input className="input" placeholder="Onlayn / Əyani / Həm onlayn, həm də əyani" value={modal.item.activityFormat ?? ""}
                    onChange={(e) => setModal((m) => m && ({ ...m, item: { ...m.item, activityFormat: e.target.value } }))} />
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



      {/* ─── Psychologist detail modal ────────────────────────────────────── */}
      {detailPsychologist && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setDetailPsychologist(null); }}>
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-head">
              <div className="modal-title">{detailPsychologist.name}</div>
              <button className="btn ghost icon-only sm" onClick={() => setDetailPsychologist(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
                {detailPsychologist.photoUrl
                  ? <img src={detailPsychologist.photoUrl} alt={detailPsychologist.name} style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 72, height: 72, borderRadius: 10, background: avatarColor(detailPsychologist.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials(detailPsychologist.name)}</div>}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{detailPsychologist.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>{detailPsychologist.title}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    {detailPsychologist.active
                      ? <span className="pill sage"><span className="dot" />Aktiv</span>
                      : <span className="pill muted"><span className="dot" />Passiv</span>}
                    {detailPsychologist.activityFormat && (
                      <span className="pill ox">
                        {detailPsychologist.activityFormat === "BOTH" ? "Həm onlayn, həm də əyani" : 
                         detailPsychologist.activityFormat === "ONLINE" ? "Onlayn" : 
                         detailPsychologist.activityFormat === "IN_PERSON" ? "Əyani" : 
                         detailPsychologist.activityFormat}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <InfoRow label="Təcrübə" value={detailPsychologist.experience || "—"} />
                <InfoRow label="Sessiya sayı" value={detailPsychologist.sessionsCount || "—"} />
                <InfoRow label="Reytinq" value={detailPsychologist.rating || "—"} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <InfoRow label="Telefon" value={detailPsychologist.phone || "—"} />
                <InfoRow label="Email" value={detailPsychologist.email || "—"} />
              </div>

              {detailPsychologist.specializations.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>İxtisaslar</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailPsychologist.specializations.map((s) => <span className="pill ox" key={s}>{s}</span>)}
                  </div>
                </div>
              )}

              {detailPsychologist.sessionTypes && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Sessiya növləri</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailPsychologist.sessionTypes.split(",").map((s) => <span className="pill ox" key={s}>{s.trim()}</span>)}
                  </div>
                </div>
              )}

              {detailPsychologist.languages && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Dillər</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {detailPsychologist.languages.split(",").map((s) => <span className="pill ox" key={s}>{s.trim()}</span>)}
                  </div>
                </div>
              )}

              {detailPsychologist.bio && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Bio</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)" }}>{detailPsychologist.bio}</div>
                </div>
              )}

              {(detailPsychologist.university || detailPsychologist.degree) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Təhsil</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <InfoRow label="Universitet" value={detailPsychologist.university || "—"} />
                    <InfoRow label="Dərəcə" value={detailPsychologist.degree || "—"} />
                    <InfoRow label="Məzun ili" value={detailPsychologist.graduationYear || "—"} />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setDetailPsychologist(null)}>Bağla</button>
              <button className="btn primary" onClick={() => { setDetailPsychologist(null); openEdit(detailPsychologist); }}>Redaktə et</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── From-user modal ──────────────────────────────────────────────── */}
      {fromUserOpen && (
        <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) setFromUserOpen(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div className="modal-title">Mövcud istifadəçidən psixoloq seç</div>
              <button className="btn ghost icon-only sm" onClick={() => setFromUserOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: "12px 20px" }}>
              <input
                className="input" placeholder="Ad, email axtar..."
                value={fromUserSearch} onChange={(e) => setFromUserSearch(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              {fromUserLoading && (
                <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>Yüklənir…</div>
              )}
              {!fromUserLoading && fromUserList.length === 0 && (
                <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>
                  Siyahıya əlavə edilməmiş psixoloq yoxdur
                </div>
              )}
              {!fromUserLoading && (
                <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {fromUserList
                    .filter((u) => {
                      const q = fromUserSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${u.email} ${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(q);
                    })
                    .map((u) => {
                      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
                      const av = name[0]?.toUpperCase() ?? "?";
                      const avColors = ["#7c6f99", "#7c9a86", "#2f5283", "#b58a3c"];
                      const avBg = avColors[Array.from(u.email).reduce((s, c) => s + c.charCodeAt(0), 0) % avColors.length];
                      return (
                        <div key={u.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                          background: "#fff",
                        }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: avBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{av}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email}</div>
                          </div>
                          <button
                            className="btn sm primary"
                            disabled={fromUserAdding === u.id}
                            onClick={() => addFromUser(u)}
                          >
                            {fromUserAdding === u.id ? "…" : "Əlavə et"}
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setFromUserOpen(false)}>Bağla</button>
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
