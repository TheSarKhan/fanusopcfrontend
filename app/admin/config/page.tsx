"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

const CONFIG_FIELDS = [
  { key: "phone", label: "Telefon nömrəsi", placeholder: "+994 50 123 45 67" },
  { key: "email", label: "Email", placeholder: "info@fanus.az" },
  { key: "working_hours", label: "İş saatları", placeholder: "B.ertəsi – Şənbə, 09:00 – 20:00" },
];

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getSiteConfig().then(setConfig).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateSiteConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) { alert((e instanceof Error ? e.message : "Xəta")); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A2535]" style={{ fontFamily: "var(--font-playfair, serif)" }}>Konfiqurasiya</h1>
        <p className="text-[#52718F] text-sm mt-1">Saytın əlaqə məlumatlarını idarə edin</p>
      </div>

      {loading ? <div className="text-center text-[#52718F] py-12">Yüklənir...</div> : (
        <div className="bg-white rounded-2xl p-6 max-w-lg" style={{ border: "1px solid #E4EDF6" }}>
          <div className="flex flex-col gap-5">
            {CONFIG_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={config[key] ?? ""}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: saving ? "#52718F" : "linear-gradient(135deg, #002147, #5A4FC8)" }}
            >
              {saving ? "Saxlanır..." : "Dəyişiklikləri saxla"}
            </button>
            {saved && (
              <span className="text-sm font-semibold text-green-600">✓ Saxlandı</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
