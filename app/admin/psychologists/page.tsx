"use client";

import { useEffect, useState } from "react";
import { adminApi, type Psychologist } from "@/lib/api";

const EMPTY: Omit<Psychologist, "id"> = {
  name: "", title: "", specializations: [], experience: "",
  sessionsCount: "", rating: "", photoUrl: "", accentColor: "#002147",
  bgColor: "#EEF5FF", displayOrder: 0, active: true,
};

export default function PsychologistsPage() {
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Psychologist, "id">; id?: number }>({
    open: false, item: { ...EMPTY },
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [specsInput, setSpecsInput] = useState("");

  const load = () => {
    setLoading(true);
    adminApi.getPsychologists().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setModal({ open: true, item: { ...EMPTY } });
    setSpecsInput("");
  };

  const openEdit = (p: Psychologist) => {
    setModal({ open: true, item: { ...p }, id: p.id });
    setSpecsInput(p.specializations.join(", "));
  };

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...modal.item,
      specializations: specsInput.split(",").map(s => s.trim()).filter(Boolean),
    };
    try {
      if (modal.id) {
        await adminApi.updatePsychologist(modal.id, data);
      } else {
        await adminApi.createPsychologist(data);
      }
      setModal({ open: false, item: { ...EMPTY } });
      load();
    } catch (e: unknown) {
      alert((e instanceof Error ? e.message : "Xəta baş verdi"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    await adminApi.deletePsychologist(id).catch(e => alert(e.message));
    load();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadFile(file);
      setModal(m => ({ ...m, item: { ...m.item, photoUrl: url } }));
    } catch {
      alert("Yükləmə uğursuz oldu");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>
            Psixoloqlar
          </h1>
          <p className="text-[#52718F] text-sm mt-1">{items.length} qeyd</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
        >
          + Əlavə et
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#52718F] py-12">Yüklənir...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(p => (
            <div key={p.id} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E4EDF6" }}>
              {p.photoUrl && (
                <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: 160, objectFit: "cover" }} />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-[#1A2535]">{p.name}</h3>
                    <p className="text-sm text-[#52718F]">{p.title}</p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: p.active ? "#dcfce7" : "#fee2e2", color: p.active ? "#16a34a" : "#dc2626" }}
                  >
                    {p.active ? "Aktiv" : "Deaktiv"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2 mb-3">
                  {p.specializations.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: p.bgColor, color: p.accentColor }}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid #F0F4F9" }}>
                  <button onClick={() => openEdit(p)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-[#002147] transition-colors"
                    style={{ background: "#EEF5FF" }}>
                    Redaktə
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-red-600 transition-colors"
                    style={{ background: "#fee2e2" }}>
                    Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,28,46,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF4FB]">
              <h2 className="font-bold text-[#1A2535]">{modal.id ? "Psixoloqu redaktə et" : "Yeni psixoloq"}</h2>
              <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#52718F] hover:bg-[#EEF4FB]">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: "Ad Soyad", field: "name", placeholder: "Aynur Məmmədova" },
                { label: "Vəzifə", field: "title", placeholder: "Klinik Psixoloq" },
                { label: "Təcrübə", field: "experience", placeholder: "8 il" },
                { label: "Seans sayı", field: "sessionsCount", placeholder: "400+" },
                { label: "Reytinq", field: "rating", placeholder: "4.9" },
                { label: "Foto URL", field: "photoUrl", placeholder: "https://..." },
                { label: "Accent rəng", field: "accentColor", placeholder: "#002147" },
                { label: "Arxa plan rəng", field: "bgColor", placeholder: "#EEF5FF" },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-[#1A2535] mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(modal.item as Record<string, unknown>)[field] as string ?? ""}
                    onChange={e => setModal(m => ({ ...m, item: { ...m.item, [field]: e.target.value } }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">
                  Foto yüklə
                </label>
                <input type="file" accept="image/*" onChange={handleUpload} className="text-sm" />
                {uploading && <p className="text-xs text-[#52718F] mt-1">Yüklənir...</p>}
                {modal.item.photoUrl && (
                  <img src={modal.item.photoUrl} alt="" className="mt-2 rounded-xl" style={{ height: 80, objectFit: "cover" }} />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">
                  İxtisaslar (vergüllə ayırın)
                </label>
                <input
                  type="text"
                  placeholder="Depressiya, Narahatlıq, Münasibətlər"
                  value={specsInput}
                  onChange={e => setSpecsInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Sıra nömrəsi</label>
                <input
                  type="number"
                  value={modal.item.displayOrder}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, displayOrder: Number(e.target.value) } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={modal.item.active}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, active: e.target.checked } }))} />
                <span className="text-sm text-[#1A2535]">Aktiv</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#52718F] hover:bg-[#EEF4FB]">
                  Ləğv et
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: saving ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}>
                  {saving ? "Saxlanır..." : "Saxla"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
