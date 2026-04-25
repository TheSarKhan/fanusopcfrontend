"use client";

import { useEffect, useState } from "react";
import { adminApi, type Stat } from "@/lib/api";

const EMPTY: Omit<Stat, "id"> = { statValue: 0, suffix: "+", label: "", subLabel: "", displayOrder: 0 };

export default function StatsPage() {
  const [items, setItems] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Stat, "id">; id?: number }>({
    open: false, item: { ...EMPTY },
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getStats().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.id) await adminApi.updateStat(modal.id, modal.item);
      else await adminApi.createStat(modal.item);
      setModal({ open: false, item: { ...EMPTY } });
      load();
    } catch (e: unknown) { alert((e instanceof Error ? e.message : "Xəta")); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    await adminApi.deleteStat(id).catch(e => alert(e.message));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>Statistika</h1>
          <p className="text-[#52718F] text-sm mt-1">{items.length} göstərici</p>
        </div>
        <button onClick={() => setModal({ open: true, item: { ...EMPTY } })}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}>
          + Əlavə et
        </button>
      </div>

      {loading ? <div className="text-center text-[#52718F] py-12">Yüklənir...</div> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-5 text-center" style={{ border: "1px solid #E4EDF6" }}>
              <p className="text-4xl font-bold text-[#2A57B0] mb-1" style={{ fontFamily: "var(--font-playfair, serif)" }}>
                {s.statValue}{s.suffix}
              </p>
              <p className="font-semibold text-[#1A2535] text-sm">{s.label}</p>
              <p className="text-xs text-[#52718F] mt-0.5">{s.subLabel}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setModal({ open: true, item: { ...s }, id: s.id })}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-[#002147]"
                  style={{ background: "#EEF5FF" }}>Redaktə</button>
                <button onClick={() => handleDelete(s.id)}
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
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF4FB]">
              <h2 className="font-bold text-[#1A2535]">{modal.id ? "Göstəricini redaktə et" : "Yeni göstərici"}</h2>
              <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#52718F] hover:bg-[#EEF4FB]">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: "Dəyər", field: "statValue", type: "number", placeholder: "500" },
                { label: "Suffix", field: "suffix", type: "text", placeholder: "+" },
                { label: "Başlıq", field: "label", type: "text", placeholder: "Aktiv müştəri" },
                { label: "Alt başlıq", field: "subLabel", type: "text", placeholder: "Platforma üzərindən" },
                { label: "Sıra nömrəsi", field: "displayOrder", type: "number", placeholder: "1" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-[#1A2535] mb-1">{label}</label>
                  <input type={type} placeholder={placeholder}
                    value={(modal.item as Record<string, unknown>)[field] as string ?? ""}
                    onChange={e => setModal(m => ({ ...m, item: { ...m.item, [field]: type === "number" ? Number(e.target.value) : e.target.value } }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
                </div>
              ))}
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
