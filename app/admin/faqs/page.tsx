"use client";

import { useEffect, useState } from "react";
import { adminApi, type Faq } from "@/lib/api";

const EMPTY: Omit<Faq, "id"> = { question: "", answer: "", displayOrder: 0, active: true };

export default function FaqsPage() {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; item: Omit<Faq, "id">; id?: number }>({
    open: false, item: { ...EMPTY },
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.getFaqs().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.id) await adminApi.updateFaq(modal.id, modal.item);
      else await adminApi.createFaq(modal.item);
      setModal({ open: false, item: { ...EMPTY } });
      load();
    } catch (e: unknown) { alert((e instanceof Error ? e.message : "Xəta")); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Silmək istədiyinizə əminsiniz?")) return;
    await adminApi.deleteFaq(id).catch(e => alert(e.message));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>FAQ</h1>
          <p className="text-[#52718F] text-sm mt-1">{items.length} sual</p>
        </div>
        <button onClick={() => setModal({ open: true, item: { ...EMPTY } })}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}>
          + Əlavə et
        </button>
      </div>

      {loading ? <div className="text-center text-[#52718F] py-12">Yüklənir...</div> : (
        <div className="flex flex-col gap-3">
          {items.map((f, i) => (
            <div key={f.id} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E4EDF6" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "#E0EBF7", color: "#002147" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-semibold text-[#1A2535] text-sm">{f.question}</p>
                    <p className="text-xs text-[#52718F] mt-1 line-clamp-2">{f.answer}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setModal({ open: true, item: { ...f }, id: f.id })}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#002147]"
                    style={{ background: "#EEF5FF" }}>Redaktə</button>
                  <button onClick={() => handleDelete(f.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600"
                    style={{ background: "#fee2e2" }}>Sil</button>
                </div>
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
              <h2 className="font-bold text-[#1A2535]">{modal.id ? "Sualı redaktə et" : "Yeni sual"}</h2>
              <button onClick={() => setModal({ open: false, item: { ...EMPTY } })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#52718F] hover:bg-[#EEF4FB]">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Sual</label>
                <input type="text" placeholder="Seans necə keçirilir?"
                  value={modal.item.question}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, question: e.target.value } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Cavab</label>
                <textarea rows={5} placeholder="Seanslar həm onlayn..."
                  value={modal.item.answer}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, answer: e.target.value } }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1">Sıra nömrəsi</label>
                <input type="number" value={modal.item.displayOrder}
                  onChange={e => setModal(m => ({ ...m, item: { ...m.item, displayOrder: Number(e.target.value) } }))}
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
