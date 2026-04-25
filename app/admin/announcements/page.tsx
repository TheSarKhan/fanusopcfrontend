"use client";

import { useEffect, useState } from "react";
import { adminApi, type Announcement } from "@/lib/api";

const EMPTY: Omit<Announcement, "id"> = {
  category: "", categoryColor: "#002147", categoryBg: "#E0EBF7",
  title: "", excerpt: "", publishedDate: new Date().toISOString().split("T")[0],
  iconType: "STAR", active: true,
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Announcement, "id">; id?: number }>({
    open: false, item: { ...EMPTY },
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getAnnouncements().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.id) await adminApi.updateAnnouncement(modal.id, modal.item);
      else await adminApi.createAnnouncement(modal.item);
      setModal({ open: false, item: { ...EMPTY } });
      load();
    } catch (e: unknown) { alert((e instanceof Error ? e.message : "Xəta")); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    await adminApi.deleteAnnouncement(id).catch(e => alert(e.message));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>Elanlar</h1>
          <p className="text-[#52718F] text-sm mt-1">{items.length} qeyd</p>
        </div>
        <button onClick={() => setModal({ open: true, item: { ...EMPTY } })}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}>
          + Əlavə et
        </button>
      </div>

      {loading ? <div className="text-center text-[#52718F] py-12">Yüklənir...</div> : (
        <div className="flex flex-col gap-3">
          {items.map(a => (
            <div key={a.id} className="bg-white rounded-2xl p-5 flex items-start gap-4" style={{ border: "1px solid #E4EDF6" }}>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ background: a.categoryBg, color: a.categoryColor }}>
                {a.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A2535] text-sm">{a.title}</p>
                <p className="text-xs text-[#52718F] mt-0.5 line-clamp-1">{a.excerpt}</p>
              </div>
              <span className="text-xs text-[#52718F] flex-shrink-0">{a.publishedDate}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setModal({ open: true, item: { ...a }, id: a.id })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#002147]"
                  style={{ background: "#EEF5FF" }}>Redaktə</button>
                <button onClick={() => handleDelete(a.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600"
                  style={{ background: "#fee2e2" }}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,28,46,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF4FB]">
              <h2 className="font-bold text-[#1A2535]">{modal.id ? "Elanı redaktə et" : "Yeni elan"}</h2>
              <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#52718F] hover:bg-[#EEF4FB]">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: "Kateqoriya", field: "category", placeholder: "Yenilik" },
                { label: "Kateqoriya rəngi", field: "categoryColor", placeholder: "#002147" },
                { label: "Kateqoriya arxa plan", field: "categoryBg", placeholder: "#E0EBF7" },
                { label: "Başlıq", field: "title", placeholder: "Elan başlığı" },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-[#1A2535] mb-1">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={(modal.item as Record<string, unknown>)[field] as string ?? ""}
                    onChange={e => setModal(m => ({ ...m, item: { ...m.item, [field]: e.target.value } }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">İkon tipi</label>
                <select value={modal.item.iconType}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, iconType: e.target.value } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}>
                  <option value="STAR">⭐ STAR</option>
                  <option value="GROUP">👥 GROUP</option>
                  <option value="VIDEO">🎥 VIDEO</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Mətn</label>
                <textarea rows={4} placeholder="Elan mətni..."
                  value={modal.item.excerpt}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, excerpt: e.target.value } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Tarix</label>
                <input type="date" value={modal.item.publishedDate}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, publishedDate: e.target.value } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={modal.item.active}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, active: e.target.checked } }))} />
                <span className="text-sm text-[#1A2535]">Aktiv</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#52718F] hover:bg-[#EEF4FB]">Ləğv et</button>
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
