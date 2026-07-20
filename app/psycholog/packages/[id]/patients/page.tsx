"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { psychologistApi, type PackageDto, type PackageStats } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { azFormatDate, azOrdinal } from "@/lib/datetime";
import { STATUS_PT, avatarTint, initials, withPurchaseOrdinal } from "../../shared";

export default function PackagePatientsPage() {
  const params = useParams();
  const packageId = Number(params.id);

  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [statsById, setStatsById] = useState<Record<number, PackageStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([psychologistApi.myPackages(), psychologistApi.myPackageStats()])
      .then(([c, s]) => {
        setCatalog(c);
        const map: Record<number, PackageStats> = {};
        for (const st of s) map[st.packageId] = st;
        setStatsById(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const pkg = catalog.find(p => p.id === packageId);
  const stats = statsById[packageId];

  const rows = useMemo(() => {
    if (!stats) return [];
    return withPurchaseOrdinal(stats.patients)
      .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
  }, [stats]);

  const backLink = (
    <Link href="/psycholog/packages" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none", marginBottom: 14 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      Paketlərə qayıt
    </Link>
  );

  if (loading) {
    return (
      <div className="panel-page">
        {backLink}
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>Yüklənir…</div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="panel-page">
        {backLink}
        <div style={{ background: "#fff", border: "1px solid #EDF1F8", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: 40, textAlign: "center", fontSize: 14, color: "var(--oxford-60)", fontWeight: 600 }}>
          Paket tapılmadı
        </div>
      </div>
    );
  }

  return (
    <div className="panel-page">
      {backLink}

      {/* Paket başlığı */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 7 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#E4ECFA", color: "#082F6D", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 7 }}>Paket</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--oxford)" }}>{pkg.name}</span>
          <span style={{ background: pkg.active ? "#D1FAE5" : "#F3F4F6", color: pkg.active ? "#065F46" : "#6B7280", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{pkg.active ? "Aktiv" : "Deaktiv"}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600, marginBottom: stats ? 16 : 0 }}>
          {pkg.sessionCount} seans · {formatAzn(pkg.packagePrice)} · seans başına ≈ {formatAzn(pkg.perSessionPrice)}
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #EDF1F8" }}>
            <MiniStat label="Satılıb" value={String(stats.sold)} />
            <MiniStat label="Aktiv" value={String(stats.active)} color="#065F46" />
            <MiniStat label="Tamamlanıb" value={String(stats.completed)} />
            <MiniStat label="Gəlir" value={formatAzn(stats.revenue)} color="#082F6D" />
          </div>
        )}
      </div>

      {/* Pasiyent cədvəli */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EDF1F8", fontSize: 14, fontWeight: 700, color: "var(--oxford)" }}>
          Bu paketi alan pasiyentlər ({rows.length})
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "#9DB0CC", fontWeight: 600 }}>Hələ bu paketi alan yoxdur</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFD" }}>
                  <Th>Pasiyent</Th>
                  <Th>Alış tarixi</Th>
                  <Th>Seans</Th>
                  <Th>Status</Th>
                  <th style={{ width: 20 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const st = STATUS_PT[p.status] ?? STATUS_PT.ACTIVE;
                  const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                  const done = p.status === "EXHAUSTED";
                  const fill = p.status === "CANCELLED" ? "#EF4444" : done ? "#10B981" : "linear-gradient(90deg,#1051B7,#3A74D6)";
                  const tint = avatarTint(p.patientName);
                  return (
                    <tr key={`${p.patientId}-${p.purchasedAt}-${i}`}>
                      <Td>
                        <Link href={`/psycholog/clients/${p.patientId}`}
                          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                          <span style={{ width: 34, height: 34, borderRadius: 10, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(p.patientName)}</span>
                          <span>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{p.patientName}</div>
                            {p.purchaseCount > 1 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309", marginTop: 1 }}>{azOrdinal(p.ordinal)} dəfə</div>
                            )}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <span style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>{azFormatDate(p.purchasedAt)}</span>
                      </Td>
                      <Td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, maxWidth: 110, height: 6, background: done ? "#D1FAE5" : "#E4ECFA", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: fill, borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{p.completed}/{p.total}</span>
                        </div>
                      </Td>
                      <Td>
                        <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>{st.label}</span>
                      </Td>
                      <Td>
                        <Link href={`/psycholog/clients/${p.patientId}`} aria-label="Pasiyent profilinə keç" style={{ display: "inline-flex" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? "var(--oxford)" }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 20px", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#8AAABF" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "12px 20px", borderTop: "1px solid #F0F4FA", verticalAlign: "middle" }}>{children}</td>;
}
