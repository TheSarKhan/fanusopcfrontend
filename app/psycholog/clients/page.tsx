"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { psychologistApi, type ClientSummary } from "@/lib/api";

export default function PsychologClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    psychologistApi.clients()
      .then(setClients).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (c.name + " " + (c.email ?? "") + " " + (c.phone ?? "")).toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="psy-clients-head mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2535]">Müştərilər</h1>
          <p className="text-[#52718F] text-sm mt-1">Hər müştəriyə dair gizli qeydləri buradan idarə edin</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Ad / email / telefon"
          className="psy-clients-search"
          style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13 }} />
      </div>

      {loading ? (
        <div style={{ background: "#fff", padding: 40, borderRadius: 14, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", padding: 48, borderRadius: 14, textAlign: "center", color: "#52718F" }}>
          Hələ müştəriniz yoxdur.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map(c => (
            <Link key={c.patientId} href={`/psycholog/clients/${c.patientId}`}
              className="psy-client-card"
              style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16, textDecoration: "none", color: "#1A2535", border: "1px solid #EFF2F7" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand-700)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {c.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#52718F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.email}{c.phone ? ` · ${c.phone}` : ""}
                </div>
              </div>
              <div className="psy-client-stats" style={{ display: "flex", gap: 16, fontSize: 12, color: "#52718F" }}>
                <div><strong style={{ color: "#1A2535" }}>{c.totalSessions}</strong> seans</div>
                <div><strong style={{ color: c.noteCount > 0 ? "var(--brand)" : "#1A2535" }}>{c.noteCount}</strong> qeyd</div>
              </div>
              <div style={{ color: "#8AAABF", fontSize: 18 }}>›</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
