"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type Psychologist, type UserRecord } from "@/lib/api";
import { IconSearch, IconPlus, IconDownload, IconChevron } from "../_components/icons";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AV_COLORS = ["#7c6f99", "#7c9a86", "#b58a3c", "#2f5283", "#0a2d59", "#5d6b85"];

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  const hash = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0);
  return AV_COLORS[hash % AV_COLORS.length];
}
function parseRating(r: string): number {
  const n = parseFloat(r);
  return isNaN(n) ? 0 : n;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "#1A2535", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#8AAABF", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function RatingStars({ value }: { value: string }) {
  const n = parseRating(value);
  if (!n) return <span style={{ fontSize: 12, color: "#C0D2E6" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 13, color: "#F59E0B" }}>★</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#1A2535" }}>{value}</span>
    </div>
  );
}

function ActiveToggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={active ? "Passiv et" : "Aktiv et"}
      style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative",
        background: active ? "#002147" : "#D1D5DB", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: active ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

function ProfileModal({ p, onClose, onEdit }: { p: Psychologist; onClose: () => void; onEdit: () => void }) {
  const color = avatarColor(p.name);
  const fmt = (v?: string | null) => v || "—";

  return (
    <div className="admin-shell-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 620, padding: 0, overflow: "hidden" }}>
        {/* Cover */}
        <div style={{ height: 88, background: p.bgColor || "#EEF1F7", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 8, border: "none", background: "rgba(0,0,0,0.12)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
        </div>

        {/* Avatar + name row */}
        <div style={{ padding: "0 28px 20px", marginTop: -36 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
              {p.photoUrl
                ? <img src={p.photoUrl} alt={p.name} style={{ width: 72, height: 72, borderRadius: 14, border: "3px solid #fff", objectFit: "cover", background: "#fff" }} />
                : <div style={{ width: 72, height: 72, borderRadius: 14, border: "3px solid #fff", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>{initials(p.name)}</div>}
              <div style={{ paddingBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#1A2535" }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "#52718F", marginTop: 2 }}>{p.title}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: p.active ? "#DCFCE7" : "#F1F5F9", color: p.active ? "#166534" : "#6B7280" }}>
                {p.active ? "Aktiv" : "Passiv"}
              </span>
              {p.activityFormat && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: "#EEF5FF", color: "#002147" }}>
                  {p.activityFormat === "BOTH" ? "Onlayn & Əyani" : p.activityFormat === "ONLINE" ? "Onlayn" : p.activityFormat === "IN_PERSON" ? "Əyani" : p.activityFormat}
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Təcrübə", value: fmt(p.experience) },
              { label: "Sessiya", value: fmt(p.sessionsCount) },
              { label: "Reytinq", value: p.rating ? `⭐ ${p.rating}` : "—" },
            ].map(s => (
              <div key={s.label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 14px", border: "1px solid #E4EDF6" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1A2535" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Contact */}
          {(p.phone || p.email) && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {p.phone && <a href={`tel:${p.phone}`} style={{ fontSize: 12, color: "#002147", fontWeight: 600, textDecoration: "none", background: "#EEF5FF", padding: "5px 12px", borderRadius: 20 }}>📞 {p.phone}</a>}
              {p.email && <a href={`mailto:${p.email}`} style={{ fontSize: 12, color: "#002147", fontWeight: 600, textDecoration: "none", background: "#EEF5FF", padding: "5px 12px", borderRadius: 20 }}>✉️ {p.email}</a>}
            </div>
          )}

          {/* Specializations */}
          {p.specializations.length > 0 && (
            <Section label="İxtisaslar">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {p.specializations.map(s => <span className="pill ox" key={s}>{s}</span>)}
              </div>
            </Section>
          )}

          {/* Languages + Session types */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {p.languages && (
              <Section label="Dillər">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.languages.split(",").map(s => <span className="pill ox" key={s} style={{ fontSize: 11 }}>{s.trim()}</span>)}
                </div>
              </Section>
            )}
            {p.sessionTypes && (
              <Section label="Sessiya növləri">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.sessionTypes.split(",").map(s => <span className="pill ox" key={s} style={{ fontSize: 11 }}>{s.trim()}</span>)}
                </div>
              </Section>
            )}
          </div>

          {/* Education */}
          {(p.university || p.degree) && (
            <Section label="Təhsil">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.degree && <span className="pill muted">{p.degree}</span>}
                {p.university && <span className="pill muted">{p.university}</span>}
                {p.graduationYear && <span className="pill muted">{p.graduationYear}</span>}
              </div>
            </Section>
          )}

          {/* Bio */}
          {p.bio && (
            <Section label="Bio">
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{p.bio}</p>
            </Section>
          )}
        </div>

        <div style={{ padding: "16px 28px", borderTop: "1px solid #E4EDF6", display: "flex", gap: 10, justifyContent: "flex-end", background: "#F8FAFC" }}>
          <button className="btn" onClick={onClose}>Bağla</button>
          <button className="btn primary" onClick={() => { onClose(); onEdit(); }}>Redaktə et</button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Default form values ───────────────────────────────────────────────────────

const EMPTY: Omit<Psychologist, "id"> = {
  name: "", title: "", specializations: [], experience: "",
  sessionsCount: "", rating: "", photoUrl: "",
  bio: "", phone: "", email: "", languages: "", sessionTypes: "", activityFormat: "",
  university: "", degree: "", graduationYear: "",
  accentColor: "#2f5283", bgColor: "#eef1f7", displayOrder: 0, active: true,
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PsychologistsPage() {
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [modal, setModal] = useState<{ item: Omit<Psychologist, "id">; id?: number } | null>(null);
  const [specsInput, setSpecsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailItem, setDetailItem] = useState<Psychologist | null>(null);
  const [fromUserOpen, setFromUserOpen] = useState(false);
  const [fromUserList, setFromUserList] = useState<UserRecord[]>([]);
  const [fromUserSearch, setFromUserSearch] = useState("");
  const [fromUserLoading, setFromUserLoading] = useState(false);
  const [fromUserAdding, setFromUserAdding] = useState<number | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    adminApi.getPsychologists().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = items.filter(p => p.active).length;
    const ratings = items.map(p => parseRating(p.rating)).filter(Boolean);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
    return { total: items.length, active, inactive: items.length - active, avgRating };
  }, [items]);

  // ── Filtered ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(p => {
        if (filter === "active" && !p.active) return false;
        if (filter === "inactive" && p.active) return false;
        if (q && !`${p.name} ${p.title} ${p.specializations.join(" ")} ${p.email ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [items, search, filter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleActive = async (p: Psychologist) => {
    try {
      await adminApi.updatePsychologist(p.id, { ...p, active: !p.active });
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
    } catch { /* silent */ }
  };

  const openCreate = () => { setSpecsInput(""); setModal({ item: { ...EMPTY } }); };
  const openEdit = (p: Psychologist) => {
    setSpecsInput(Array.isArray(p.specializations) ? p.specializations.join(", ") : "");
    setModal({
      item: {
        name: p.name ?? "", title: p.title ?? "",
        specializations: p.specializations ?? [],
        experience: p.experience ?? "", sessionsCount: p.sessionsCount ?? "",
        rating: p.rating ?? "", photoUrl: p.photoUrl ?? "",
        bio: p.bio ?? "", phone: p.phone ?? "", email: p.email ?? "",
        languages: p.languages ?? "", sessionTypes: p.sessionTypes ?? "",
        activityFormat: p.activityFormat ?? "", university: p.university ?? "",
        degree: p.degree ?? "", graduationYear: p.graduationYear ?? "",
        accentColor: p.accentColor ?? "#2f5283", bgColor: p.bgColor ?? "#eef1f7",
        displayOrder: p.displayOrder ?? 0, active: p.active ?? true,
      },
      id: p.id,
    });
  };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const data = { ...modal.item, specializations: specsInput.split(",").map(s => s.trim()).filter(Boolean) };
      if (modal.id) await adminApi.updatePsychologist(modal.id, data);
      else await adminApi.createPsychologist(data);
      setModal(null);
      load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    try { await adminApi.deletePsychologist(id); load(); }
    catch (e) { alert((e as Error).message); }
  };

  const updateOrder = async (p: Psychologist, newOrder: number) => {
    try {
      await adminApi.updatePsychologist(p.id, { ...p, displayOrder: newOrder });
      load();
    } catch { /* silent */ }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modal) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadFile(file);
      setModal(m => m ? { ...m, item: { ...m.item, photoUrl: url } } : m);
    } catch { alert("Yükləmə uğursuz oldu"); }
    finally { setUploading(false); }
  };

  const openFromUser = () => {
    setDropOpen(false);
    setFromUserSearch("");
    setFromUserOpen(true);
    setFromUserLoading(true);
    adminApi.getUsers({ role: "PSYCHOLOGIST" })
      .then(res => setFromUserList(res.content.filter(u => !u.inPsychologistList)))
      .catch(() => {})
      .finally(() => setFromUserLoading(false));
  };

  const addFromUser = async (u: UserRecord) => {
    setFromUserAdding(u.id);
    try {
      await adminApi.addToPsychologists(u.id);
      setFromUserList(prev => prev.filter(x => x.id !== u.id));
      load();
      try {
        const profile = await adminApi.getUserPsychologistProfile(u.id);
        setFromUserOpen(false);
        openEdit(profile);
      } catch { setFromUserOpen(false); }
    } catch (e) { alert((e as Error).message); }
    finally { setFromUserAdding(null); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1A2535", margin: 0 }}>Psixoloqlar</h1>
          <p style={{ fontSize: 13, color: "#8AAABF", marginTop: 3, marginBottom: 0 }}>Psixoloq profilləri, statistika və idarəetmə</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <IconDownload size={14} /> CSV ixrac
          </button>
          <div ref={dropRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropOpen(o => !o)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              <IconPlus size={14} style={{ stroke: "#fff" } as React.CSSProperties} />
              Psixoloq əlavə et
              <span style={{ opacity: 0.7, fontSize: 10 }}>▾</span>
            </button>
            {dropOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220, background: "#fff", border: "1px solid #E4EDF6", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 50, overflow: "hidden" }}>
                <button onClick={() => { setDropOpen(false); openCreate(); }} style={{ width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontWeight: 600, color: "#1A2535", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <IconPlus size={13} /> Yeni psixoloq
                </button>
                <div style={{ height: 1, background: "#E4EDF6" }} />
                <button onClick={openFromUser} style={{ width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontWeight: 600, color: "#1A2535", cursor: "pointer" }}>
                  Mövcud istifadəçidən seç
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        <StatCard label="Ümumi" value={stats.total} sub="psixoloq" />
        <StatCard label="Aktiv" value={stats.active} sub="hal-hazırda aktiv" accent="#166534" />
        <StatCard label="Passiv" value={stats.inactive} sub="deaktiv edilmiş" accent="#6B7280" />
        <StatCard label="Ort. Reytinq" value={stats.avgRating} sub="bütün psixoloqlar" accent="#D97706" />
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <IconSearch size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8AAABF" } as React.CSSProperties} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ad, ixtisas, email..."
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#1A2535", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", border: "1.5px solid #E4EDF6", borderRadius: 8, overflow: "hidden" }}>
          {(["all", "active", "inactive"] as const).map((f, i) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 14px", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filter === f ? "#1A2535" : "#fff",
              color: filter === f ? "#fff" : "#52718F",
              borderLeft: i > 0 ? "1.5px solid #E4EDF6" : "none",
            }}>
              {f === "all" ? `Hamısı (${stats.total})` : f === "active" ? `Aktiv (${stats.active})` : `Passiv (${stats.inactive})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#8AAABF", padding: "80px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>Yüklənir...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", color: "#8AAABF" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2535", margin: "0 0 6px" }}>Psixoloq tapılmadı</p>
          <p style={{ fontSize: 13, margin: 0 }}>Axtarış parametrlərini dəyişin</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>

          {/* Head */}
          <div style={{ display: "grid", gridTemplateColumns: "46px minmax(170px,1fr) 170px 130px 64px 80px 100px 160px", minWidth: 920, alignItems: "center", padding: "10px 16px", borderBottom: "1.5px solid #E4EDF6", background: "#F8FAFC" }}>
            {["Sıra", "Psixoloq", "İxtisas", "Vəzifə", "Sessiya", "Reytinq", "Status", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i >= 4 && i <= 5 ? "center" : "left" }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((p, idx) => (
            <div
              key={p.id}
              style={{
                display: "grid", gridTemplateColumns: "46px minmax(170px,1fr) 170px 130px 64px 80px 100px 160px",
                minWidth: 920, alignItems: "center", padding: "11px 16px",
                borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#FAFBFF")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >
              {/* Order */}
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <button onClick={() => updateOrder(p, (p.displayOrder ?? 0) - 1)} style={{ width: 18, height: 18, border: "none", background: "none", cursor: "pointer", color: "#C0D2E6", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, padding: 0 }}>
                  <IconChevron size={10} style={{ transform: "rotate(-90deg)" }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#52718F", minWidth: 14, textAlign: "center" }}>{p.displayOrder}</span>
                <button onClick={() => updateOrder(p, (p.displayOrder ?? 0) + 1)} style={{ width: 18, height: 18, border: "none", background: "none", cursor: "pointer", color: "#C0D2E6", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, padding: 0 }}>
                  <IconChevron size={10} style={{ transform: "rotate(90deg)" }} />
                </button>
              </div>

              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {p.photoUrl
                  ? <img src={p.photoUrl} alt={p.name} style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 38, height: 38, borderRadius: 10, background: avatarColor(p.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(p.name)}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1A2535", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  {p.email && <div style={{ fontSize: 11, color: "#8AAABF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>}
                </div>
              </div>

              {/* Specializations */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {p.specializations.slice(0, 2).map(s => <span key={s} className="pill ox" style={{ fontSize: 10, padding: "2px 7px" }}>{s}</span>)}
                {p.specializations.length > 2 && <span className="pill muted" style={{ fontSize: 10, padding: "2px 7px" }}>+{p.specializations.length - 2}</span>}
              </div>

              {/* Title */}
              <div style={{ fontSize: 12, color: "#52718F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || "—"}</div>

              {/* Sessions */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1A2535", textAlign: "center" }}>{p.sessionsCount || "—"}</div>

              {/* Rating */}
              <div style={{ textAlign: "center" }}><RatingStars value={p.rating} /></div>

              {/* Active toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <ActiveToggle active={p.active} onChange={() => toggleActive(p)} />
                <span style={{ fontSize: 11, fontWeight: 600, color: p.active ? "#166534" : "#6B7280" }}>
                  {p.active ? "Aktiv" : "Passiv"}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                <button onClick={() => setDetailItem(p)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E4EDF6", background: "#F8FAFC", color: "#52718F", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Profil</button>
                <button onClick={() => openEdit(p)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E4EDF6", background: "#EEF5FF", color: "#002147", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Redaktə</button>
                <button onClick={() => remove(p.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E4EDF6", background: "#FFF1F1", color: "#DC2626", fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
          </div>{/* end overflowX:auto */}

          <div style={{ padding: "10px 16px", borderTop: "1.5px solid #F1F5F9", background: "#F8FAFC" }}>
            <span style={{ fontSize: 12, color: "#8AAABF" }}>{filtered.length} / {items.length} psixoloq göstərilir</span>
          </div>
        </div>
      )}

      {/* ── Profile modal ── */}
      {detailItem && (
        <ProfileModal
          p={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => { setDetailItem(null); openEdit(detailItem); }}
        />
      )}

      {/* ── Edit/Create modal ── */}
      {modal && (
        <div className="admin-shell-modal" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-head">
              <div className="modal-title">{modal.id ? "Psixoloqu redaktə et" : "Yeni psixoloq əlavə et"}</div>
              <button className="btn ghost icon-only sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <FormField label="Ad Soyad">
                  <input className="input" placeholder="Leyla Hüseynova" value={modal.item.name}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, name: e.target.value } })} />
                </FormField>
                <FormField label="Vəzifə / titul">
                  <input className="input" placeholder="Klinik Psixoloq" value={modal.item.title}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, title: e.target.value } })} />
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
                <FormField label="Təcrübə">
                  <input className="input" placeholder="8 il" value={modal.item.experience}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, experience: e.target.value } })} />
                </FormField>
                <FormField label="Sessiya sayı">
                  <input className="input" placeholder="400+" value={modal.item.sessionsCount}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, sessionsCount: e.target.value } })} />
                </FormField>
                <FormField label="Reytinq">
                  <input className="input" placeholder="4.9" value={modal.item.rating}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, rating: e.target.value } })} />
                </FormField>
              </div>
              <div style={{ marginTop: 14 }}>
                <FormField label="İxtisaslar (vergüllə ayırın)">
                  <input className="input" placeholder="Anksiyete, depressiya, münasibətlər" value={specsInput}
                    onChange={e => setSpecsInput(e.target.value)} />
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <FormField label="Telefon">
                  <input className="input" placeholder="+994 50 000 00 00" value={modal.item.phone ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, phone: e.target.value } })} />
                </FormField>
                <FormField label="Email">
                  <input className="input" placeholder="psixoloq@fanus.az" value={modal.item.email ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, email: e.target.value } })} />
                </FormField>
              </div>
              <div style={{ marginTop: 14 }}>
                <FormField label="Bio">
                  <textarea className="input" rows={3} style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                    placeholder="Psixoloq haqqında qısa məlumat..." value={modal.item.bio ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, bio: e.target.value } })} />
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <FormField label="Dillər (vergüllə)">
                  <input className="input" placeholder="Azərbaycan, Rus, İngilis" value={modal.item.languages ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, languages: e.target.value } })} />
                </FormField>
                <FormField label="Sessiya növləri (vergüllə)">
                  <input className="input" placeholder="Fərdi, Cütlük, Uşaq" value={modal.item.sessionTypes ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, sessionTypes: e.target.value } })} />
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <FormField label="Fəaliyyət formatı">
                  <select className="input" value={modal.item.activityFormat ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, activityFormat: e.target.value } })}>
                    <option value="">Seçin...</option>
                    <option value="ONLINE">Onlayn</option>
                    <option value="IN_PERSON">Əyani</option>
                    <option value="BOTH">Həm onlayn, həm əyani</option>
                  </select>
                </FormField>
                <FormField label="Sıra nömrəsi">
                  <input type="number" className="input" value={modal.item.displayOrder}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, displayOrder: Number(e.target.value) } })} />
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
                <FormField label="Universitet">
                  <input className="input" placeholder="BDU" value={modal.item.university ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, university: e.target.value } })} />
                </FormField>
                <FormField label="Dərəcə">
                  <input className="input" placeholder="Magistr" value={modal.item.degree ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, degree: e.target.value } })} />
                </FormField>
                <FormField label="Məzun ili">
                  <input className="input" placeholder="2018" value={modal.item.graduationYear ?? ""}
                    onChange={e => setModal(m => m && { ...m, item: { ...m.item, graduationYear: e.target.value } })} />
                </FormField>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <FormField label="Accent rəngi">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={modal.item.accentColor} onChange={e => setModal(m => m && { ...m, item: { ...m.item, accentColor: e.target.value } })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                    <input className="input" value={modal.item.accentColor} onChange={e => setModal(m => m && { ...m, item: { ...m.item, accentColor: e.target.value } })} style={{ fontFamily: "monospace", flex: 1 }} />
                  </div>
                </FormField>
                <FormField label="Arxa plan rəngi">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={modal.item.bgColor} onChange={e => setModal(m => m && { ...m, item: { ...m.item, bgColor: e.target.value } })} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                    <input className="input" value={modal.item.bgColor} onChange={e => setModal(m => m && { ...m, item: { ...m.item, bgColor: e.target.value } })} style={{ fontFamily: "monospace", flex: 1 }} />
                  </div>
                </FormField>
              </div>
              <div style={{ marginTop: 14 }}>
                <FormField label="Profil şəkli">
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    {modal.item.photoUrl && <img src={modal.item.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />}
                    <div>
                      <input type="file" accept="image/*" onChange={upload} style={{ fontSize: 12 }} />
                      {uploading && <div style={{ fontSize: 11, color: "#8AAABF", marginTop: 4 }}>Yüklənir…</div>}
                    </div>
                  </div>
                </FormField>
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>Aktiv</span>
                <ActiveToggle active={modal.item.active} onChange={() => setModal(m => m && { ...m, item: { ...m.item, active: !m.item.active } })} />
                <span style={{ fontSize: 12, color: modal.item.active ? "#166534" : "#6B7280" }}>{modal.item.active ? "Aktiv" : "Passiv"}</span>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setModal(null)}>Ləğv et</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saxlanır…" : "Saxla"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── From-user modal ── */}
      {fromUserOpen && (
        <div className="admin-shell-modal" onClick={e => { if (e.target === e.currentTarget) setFromUserOpen(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div className="modal-title">Mövcud istifadəçidən psixoloq seç</div>
              <button className="btn ghost icon-only sm" onClick={() => setFromUserOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <input className="input" placeholder="Ad, email axtar..." value={fromUserSearch}
                onChange={e => setFromUserSearch(e.target.value)} style={{ marginBottom: 12, width: "100%", boxSizing: "border-box" }} />
              {fromUserLoading ? (
                <div style={{ textAlign: "center", padding: 24, color: "#8AAABF", fontSize: 13 }}>Yüklənir…</div>
              ) : fromUserList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "#8AAABF", fontSize: 13 }}>Əlavə edilməmiş psixoloq yoxdur</div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {fromUserList
                    .filter(u => {
                      const q = fromUserSearch.trim().toLowerCase();
                      return !q || `${u.email} ${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(q);
                    })
                    .map(u => {
                      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
                      const avBg = AV_COLORS[Array.from(u.email).reduce((s, c) => s + c.charCodeAt(0), 0) % AV_COLORS.length];
                      return (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid #E4EDF6" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: avBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                            {name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                            <div style={{ fontSize: 11, color: "#8AAABF" }}>{u.email}</div>
                          </div>
                          <button className="btn sm primary" disabled={fromUserAdding === u.id} onClick={() => addFromUser(u)}>
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "#52718F", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
