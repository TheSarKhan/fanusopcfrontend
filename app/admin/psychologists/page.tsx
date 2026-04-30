"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type Psychologist } from "@/lib/api";
import { IconSearch, IconPlus, IconDownload } from "../_components/icons";

type Filter = "all" | "active" | "inactive";

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

export default function PsychologistsPage() {
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Psychologist, "id">; id?: number } | null>(null);
  const [specsInput, setSpecsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getPsychologists().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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
        const hay = `${p.name} ${p.title} ${p.specializations.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filter]);

  const openCreate = () => {
    setSpecsInput("");
    setModal({ open: true, item: { ...EMPTY } });
  };
  const openEdit = (p: Psychologist) => {
    setSpecsInput(p.specializations.join(", "));
    setModal({ open: true, item: { ...p }, id: p.id });
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
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    try {
      await adminApi.deletePsychologist(id);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modal) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadFile(file);
      setModal((m) => (m ? { ...m, item: { ...m.item, photoUrl: url } } : m));
    } catch {
      alert("Yükləmə uğursuz oldu");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Psixoloqlar</h1>
          <p className="page-sub">{counts.all} psixoloq qeydiyyatda, {counts.active} aktiv. Profilləri və statusu idarə edin.</p>
        </div>
        <div className="page-actions">
          <button className="btn">
            <IconDownload size={14} />
            CSV ixrac
          </button>
          <button className="btn primary" onClick={openCreate}>
            <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
            Psixoloq əlavə et
          </button>
        </div>
      </div>

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
            <button key={f.k} className={`filter${filter === f.k ? " active" : ""}`} onClick={() => setFilter(f.k)}>
              {f.label}
            </button>
          ))}
          <div className="toolbar-spacer" />
          <button className="filter">İxtisas</button>
          <button className="filter">Təcrübə</button>
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
            {loading && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Heç bir psixoloq tapılmadı</td></tr>
            )}
            {!loading && filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="row-avatar">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="av" style={{ objectFit: "cover" }} />
                    ) : (
                      <div className="av" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>
                    )}
                    <div>
                      <div className="nm">{p.name}</div>
                    </div>
                  </div>
                </td>
                <td>{p.title}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {p.specializations.slice(0, 2).map((s) => (
                      <span className="pill ox" key={s}>{s}</span>
                    ))}
                    {p.specializations.length > 2 && (
                      <span className="pill muted">+{p.specializations.length - 2}</span>
                    )}
                  </div>
                </td>
                <td>{p.experience}</td>
                <td className="num strong">{p.sessionsCount}</td>
                <td className="num"><strong>{p.rating}</strong></td>
                <td>
                  {p.active ? (
                    <span className="pill sage"><span className="dot" />Aktiv</span>
                  ) : (
                    <span className="pill muted"><span className="dot" />Passiv</span>
                  )}
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
                  {modal.item.photoUrl && (
                    <img src={modal.item.photoUrl} alt="" style={{ marginTop: 8, height: 80, borderRadius: 8 }} />
                  )}
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
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? "Saxlanır…" : "Saxla"}
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
