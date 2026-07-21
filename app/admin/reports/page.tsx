"use client";

// Admin — statistikalar və raportlar.
// İki cədvəl (ən yüksək konversiyalı məqalələr, psixoloq performansı) artıq
// <DataTable>-dır. API sadə massiv qaytarır, ona görə səhifələmə client-side:
// tam massiv state-də saxlanılır, cari səhifə kəsilir.

import { Fragment, useEffect, useMemo, useState } from "react";
import { adminApi, type ReportsData } from "@/lib/api";
import { azFormatDate } from "@/lib/datetime";
import { Avatar, DataTable, type Column } from "@/components/ui";
import { IconCalendar, IconDownload } from "../_components/icons";

const HEAT_COLORS = ["#F2F6FD", "#E4ECFA", "#C7DAF5", "#8FB0E3", "#3A74D6", "#082F6D", "#1051B7"];
const DAYS = ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."];

type TopArticle = ReportsData["topConverting"][number];
type Performance = ReportsData["performance"][number];

function fmt(n: number) {
  return new Intl.NumberFormat("az-AZ").format(Math.round(n));
}

function Donut({ slices }: { slices: { color: string; percent: number }[] }) {
  return (
    <svg className="donut" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#F2F6FD" strokeWidth="6" />
      {slices.map((s, i) => {
        const offset = 25 + slices.slice(0, i).reduce((sum, x) => sum + x.percent, 0);
        return (
          <circle key={i} cx="21" cy="21" r="15.9" fill="transparent" stroke={s.color} strokeWidth="6" strokeDasharray={`${s.percent} 100`} strokeDashoffset={-offset + 50} />
        );
      })}
    </svg>
  );
}

const ARTICLE_COLUMNS: Column<TopArticle>[] = [
  {
    key: "title",
    header: "Məqalə",
    cell: a => (
      <span className="fx-row__title" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280, whiteSpace: "nowrap" }}>
        {a.title}
      </span>
    ),
  },
  { key: "views", header: "Baxış", numeric: true, cell: a => fmt(a.views) },
  { key: "requests", header: "Müraciət", numeric: true, cell: a => fmt(a.requests) },
  { key: "cr", header: "CR", numeric: true, cell: a => `${a.conversionRate.toFixed(1)}%` },
];

const PERFORMANCE_COLUMNS: Column<Performance>[] = [
  {
    key: "name",
    header: "Psixoloq",
    cell: p => (
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Avatar name={p.name} size="sm" />
        <span className="fx-row__title">{p.name}</span>
      </div>
    ),
  },
  { key: "sessions", header: "Sessiya", numeric: true, cell: p => p.sessions },
  { key: "completion", header: "Tamamlanma", numeric: true, cell: p => `${p.completionPct}%` },
  { key: "rating", header: "Rəy", numeric: true, cell: p => <strong>{p.rating.toFixed(1)}</strong> },
];

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [articlePage, setArticlePage] = useState(1);
  const [articleSize, setArticleSize] = useState(5);
  const [perfPage, setPerfPage] = useState(1);
  const [perfSize, setPerfSize] = useState(5);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    adminApi.getReports()
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError((e as Error).message || "Raport məlumatları yüklənmədi."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadNonce]);

  const articles = useMemo(() => data?.topConverting ?? [], [data]);
  const performance = useMemo(() => data?.performance ?? [], [data]);

  const articlePageCount = Math.max(1, Math.ceil(articles.length / articleSize));
  const perfPageCount = Math.max(1, Math.ceil(performance.length / perfSize));

  const articleRows = useMemo(
    () => articles.slice((articlePage - 1) * articleSize, articlePage * articleSize),
    [articles, articlePage, articleSize]);
  const perfRows = useMemo(
    () => performance.slice((perfPage - 1) * perfSize, perfPage * perfSize),
    [performance, perfPage, perfSize]);

  // Səhifə ölçüsü və ya məlumat dəyişəndə boş səhifədə qalmamaq üçün 1-ə qayıt.
  useEffect(() => { setArticlePage(1); }, [articleSize, articles]);
  useEffect(() => { setPerfPage(1); }, [perfSize, performance]);

  const period = (() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return `${azFormatDate(from)} – ${azFormatDate(to)}`;
  })();

  const retry = () => setReloadNonce(n => n + 1);

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

      {data && (
        <>
          <div className="stats-grid col-4">
            <Headline title="Konversiya (məqalə → randevu)" m={data.conversion} sparkColor="#10B981" />
            <Headline title="Tamamlanma faizi" m={data.completion} sparkColor="#1051B7" />
            <Headline title="Orta sessiya rəyi" m={data.averageRating} sparkColor="#F59E0B" />
            <Headline title="Aktiv istifadəçi (DAU)" m={data.activeUsers} sparkColor="#6366F1" />
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
        </>
      )}

      <div className="grid-2 mt-16">
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Ən yüksək konversiyalı məqalələr</h3>
            <span className="pill muted">Bu ay</span>
          </div>
          <div className="card-pad">
            <DataTable
              rows={articleRows}
              columns={ARTICLE_COLUMNS}
              rowKey={a => a.title}
              loading={loading}
              error={error}
              onRetry={retry}
              empty={{
                title: "Bu ay konversiya qeydə alınmayıb",
                body: "Məqalələrdən randevu müraciəti gəldikcə siyahı burada dolacaq.",
              }}
              pagination={{
                page: articlePage,
                pageCount: articlePageCount,
                onChange: setArticlePage,
                pageSize: articleSize,
                onPageSizeChange: setArticleSize,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
              }}
              totalLabel={`${articles.length} məqalə`}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Psixoloq performansı</h3>
            <span className="pill muted">Bu ay</span>
          </div>
          <div className="card-pad">
            <DataTable
              rows={perfRows}
              columns={PERFORMANCE_COLUMNS}
              rowKey={p => p.name}
              loading={loading}
              error={error}
              onRetry={retry}
              empty={{
                title: "Bu ay performans məlumatı yoxdur",
                body: "Seanslar tamamlandıqca psixoloq göstəriciləri burada görünəcək.",
              }}
              pagination={{
                page: perfPage,
                pageCount: perfPageCount,
                onChange: setPerfPage,
                pageSize: perfSize,
                onPageSizeChange: setPerfSize,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
              }}
              totalLabel={`${performance.length} psixoloq`}
            />
          </div>
        </div>
      </div>
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
