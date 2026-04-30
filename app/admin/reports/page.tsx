"use client";

import { Fragment, useEffect, useState } from "react";
import { adminApi, type ReportsData } from "@/lib/api";
import { IconCalendar, IconDownload } from "../_components/icons";

const HEAT_COLORS = ["#eef1f7", "#dde3ee", "#b7c3d8", "#7d92b3", "#2f5283", "#0a2d59", "#002147"];
const DAYS = ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."];

function fmt(n: number) {
  return new Intl.NumberFormat("az-AZ").format(Math.round(n));
}

function Donut({ slices }: { slices: { color: string; percent: number }[] }) {
  let offset = 25;
  return (
    <svg className="donut" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#eef1f7" strokeWidth="6" />
      {slices.map((s, i) => {
        const node = (
          <circle key={i} cx="21" cy="21" r="15.9" fill="transparent" stroke={s.color} strokeWidth="6" strokeDasharray={`${s.percent} 100`} strokeDashoffset={-offset + 50} />
        );
        offset += s.percent;
        return node;
      })}
    </svg>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getReports().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const period = (() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    const fmt = (d: Date) => {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${day}.${month}.${d.getFullYear()}`;
    };
    return `${fmt(from)} – ${fmt(to)}`;
  })();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Statistikalar və raportlar</h1>
          <p className="page-sub">Platforma performansı, randevu konversiyası və kontent effektivliyi.</p>
        </div>
        <div className="page-actions">
          <button className="btn">
            <IconCalendar size={14} />
            {period}
          </button>
          <button className="btn">
            <IconDownload size={14} />
            PDF
          </button>
          <button className="btn primary">CSV ixrac</button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && data && (
        <>
          <div className="stats-grid col-4">
            <Headline title="Konversiya (məqalə → randevu)" m={data.conversion} sparkColor="#7c9a86" />
            <Headline title="Tamamlanma faizi" m={data.completion} sparkColor="#002147" />
            <Headline title="Orta sessiya rəyi" m={data.averageRating} sparkColor="#b58a3c" />
            <Headline title="Aktiv istifadəçi (DAU)" m={data.activeUsers} sparkColor="#7c6f99" />
          </div>

          <div className="grid-3-2 mt-16">
            <div className="card">
              <div className="card-head">
                <div>
                  <h3 className="card-title">Randevu funnel</h3>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Səyahət addımları</div>
                </div>
              </div>
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {data.funnel.map((s, i) => (
                  <div key={i}>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>
                        {fmt(s.count)}
                        {i > 0 && <span style={{ color: "var(--muted)", fontWeight: 500 }}> ({s.pctOfTotal.toFixed(1)}%)</span>}
                      </span>
                    </div>
                    <div style={{ height: 24, background: "var(--ox-50)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${i === 0 ? 100 : Math.max(s.pctOfTotal, 1)}%`, height: "100%", background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Trafikin mənbəyi</h3>
              </div>
              <div className="donut-wrap">
                <Donut slices={data.trafficSources.map((s) => ({ color: s.color, percent: s.percent }))} />
                <div className="donut-legend">
                  {data.trafficSources.map((t, i) => (
                    <div className="legend-row" key={i}>
                      <span className="sw" style={{ background: t.color }} />
                      <span className="ll">{t.label}</span>
                      <span className="vv">{t.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-16">
            <div className="card-head">
              <div>
                <h3 className="card-title">Saat üzrə müraciət sıxlığı</h3>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Son 30 gün</div>
              </div>
              <div className="row">
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Az</span>
                <div style={{ display: "flex", gap: 2 }}>
                  {HEAT_COLORS.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ width: 10, height: 10, background: c, borderRadius: 1 }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Çox</span>
              </div>
            </div>
            <div className="heatmap">
              <div></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div className="hour-label" key={h}>{String(h).padStart(2, "0")}</div>
              ))}
              {DAYS.map((day, di) => (
                <Fragment key={`d${di}`}>
                  <div className="day-label">{day}</div>
                  {(data.hourlyHeatmap[di] ?? []).map((v, hi) => (
                    <div className="cell" key={`${di}-${hi}`} style={{ background: HEAT_COLORS[Math.min(v, HEAT_COLORS.length - 1)] }} />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="grid-2 mt-16">
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Ən yüksək konversiyalı məqalələr</h3>
                <span className="pill muted">Bu ay</span>
              </div>
              <table className="t">
                <thead>
                  <tr>
                    <th>Məqalə</th>
                    <th className="num">Baxış</th>
                    <th className="num">Müraciət</th>
                    <th className="num">CR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topConverting.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Məlumat yoxdur</td></tr>
                  )}
                  {data.topConverting.map((a, i) => (
                    <tr key={i}>
                      <td className="strong" style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280, whiteSpace: "nowrap" }}>{a.title}</td>
                      <td className="num">{fmt(a.views)}</td>
                      <td className="num">{fmt(a.requests)}</td>
                      <td className="num">
                        <span className={`pill ${a.conversionRate >= 4 ? "sage" : a.conversionRate >= 2.5 ? "gold" : "muted"}`} style={{ fontSize: 10.5 }}>
                          {a.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Psixoloq performansı</h3>
                <span className="pill muted">Bu ay</span>
              </div>
              <table className="t">
                <thead>
                  <tr>
                    <th>Psixoloq</th>
                    <th className="num">Sessiya</th>
                    <th className="num">Tamamlanma</th>
                    <th className="num">Rəy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.performance.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Məlumat yoxdur</td></tr>
                  )}
                  {data.performance.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="row-avatar">
                          <div className="av" style={{ width: 24, height: 24, fontSize: 9, background: p.avatarColor }}>{p.initials}</div>
                          <span className="strong">{p.name}</span>
                        </div>
                      </td>
                      <td className="num">{p.sessions}</td>
                      <td className="num">{p.completionPct}%</td>
                      <td className="num"><strong>{p.rating.toFixed(1)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Headline({ title, m, sparkColor }: { title: string; m: { value: number; unit: string; deltaAbs: number; deltaUnit: string; label: string }; sparkColor: string }) {
  const isPercent = m.unit === "%";
  const display = isPercent
    ? m.value.toFixed(1) + "%"
    : m.unit === "/5"
      ? m.value.toFixed(2) + ""
      : fmt(m.value);
  return (
    <div className="stat">
      <div className="stat-label">{title}</div>
      <div className="stat-value">
        {display}
        {m.unit === "/5" && <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}> / 5</span>}
      </div>
      <div className="stat-meta">
        <span className={`delta ${m.deltaAbs > 0 ? "up" : m.deltaAbs < 0 ? "down" : "flat"}`}>
          {m.deltaAbs > 0 ? "↑" : m.deltaAbs < 0 ? "↓" : "—"} {Math.abs(m.deltaAbs).toFixed(m.deltaUnit === "pp" ? 1 : 2)}{m.deltaUnit}
        </span>
        <span>{m.label}</span>
      </div>
      <svg className="stat-spark" viewBox="0 0 70 28" preserveAspectRatio="none">
        <path d="M0 22 L8 18 L16 20 L24 14 L32 16 L40 10 L48 12 L56 6 L64 8 L70 4" stroke={sparkColor} strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}
