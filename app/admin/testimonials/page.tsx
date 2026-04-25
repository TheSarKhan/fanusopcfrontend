"use client";

import { useEffect, useState } from "react";
import { adminApi, type Testimonial } from "@/lib/api";

const EMPTY: Omit<Testimonial, "id"> = {
  quote: "", authorName: "", authorRole: "", initials: "",
  gradient: "linear-gradient(135deg, #002147, #5A4FC8)", rating: 5, active: true,
};

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Testimonial, "id">; id?: number }>({
    open: false, item: { ...EMPTY },
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getTestimonials().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.id) await adminApi.updateTestimonial(modal.id, modal.item);
      else await adminApi.createTestimonial(modal.item);
      setModal({ open: false, item: { ...EMPTY } });
      load();
    } catch (e: unknown) { alert((e instanceof Error ? e.message : "Xəta")); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    await adminApi.deleteTestimonial(id).catch(e => alert(e.message));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>Müştəri rəyləri</h1>
          <p className="text-[#52718F] text-sm mt-1">{items.length} rəy</p>
        </div>
        <button onClick={() => setModal({ open: true, item: { ...EMPTY } })}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}>
          + Əlavə et
        </button>
      </div>

      {loading ? <div className="text-center text-[#52718F] py-12">Yüklənir...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(t => (
            <div key={t.id} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4EDF6" }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: t.gradient }}>{t.initials}</div>
                <div>
                  <p className="font-semibold text-[#1A2535] text-sm">{t.authorName}</p>
                  <p className="text-xs text-[#52718F]">{t.authorRole}</p>
                </div>
              </div>
              <p className="text-sm text-[#1A2535] line-clamp-2 mb-3">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex gap-2">
                <button onClick={() => setModal({ open: true, item: { ...t }, id: t.id })}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-[#002147]"
                  style={{ background: "#EEF5FF" }}>Redaktə</button>
                <button onClick={() => handleDelete(t.id)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-red-600"
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
              <h2 className="font-bold text-[#1A2535]">{modal.id ? "Rəyi redaktə et" : "Yeni rəy"}</h2>
              <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#52718F] hover:bg-[#EEF4FB]">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Rəy</label>
                <textarea rows={4} placeholder="Müştərinin rəyi..."
                  value={modal.item.quote}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, quote: e.target.value } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
              </div>
              {[
                { label: "Ad Soyad", field: "authorName", placeholder: "Aytən Hüseynova" },
                { label: "Vəzifə/Rol", field: "authorRole", placeholder: "Marketinq Meneceri, 28" },
                { label: "Baş hərflər", field: "initials", placeholder: "AH" },
                { label: "Gradient CSS", field: "gradient", placeholder: "linear-gradient(135deg, #002147, #5A4FC8)" },
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
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Reytinq (1-5)</label>
                <input type="number" min={1} max={5} value={modal.item.rating}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, rating: Number(e.target.value) } }))}
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
