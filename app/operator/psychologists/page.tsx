"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { operatorApi, type PsychologistRankItem } from "@/lib/api";
import { RankingBarChart } from "@/components/AnalyticsCharts";
import { useT } from "@/lib/i18n/LocaleProvider";

type SortKey = "name" | "completedSessions" | "fanusSessions" | "activePatients" | "rankingScore";
type SortDir = "asc" | "desc";

function typeLabel(type?: string | null): { text: string; tone: "brand" | "neutral" } {
  if (type && type.toUpperCase() === "FANUS") return { text: "FANUS", tone: "brand" };
  return { text: "NORMAL", tone: "neutral" };
}

function fmtScore(n?: number | null): string {
  return n == null ? "—" : String(Math.round(n * 10) / 10);
}

export default function OperatorPsychologistsPage() {
  const { t } = useT();
  const [ranking, setRanking] = useState<PsychologistRankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rankingScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    operatorApi.psychologistRanking()
      .then((r) => setRanking(r))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    const arr = [...ranking];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "rankingScore") {
        av = a.rankingScore ?? -Infinity;
        bv = b.rankingScore ?? -Infinity;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [ranking, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Names default A→Z, numeric columns default high→low.
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="op-analytics">
      <header className="op-analytics__head">
        <div>
          <h1>Psixoloq statistikası</h1>
          <p>Reytinq və performans göstəriciləri — sətrə klikləyərək detallara keçin</p>
        </div>
      </header>

      {loading ? (
        <div className="op-loading">{t("common.loading")}</div>
      ) : error ? (
        <div className="op-error">{t("common.error")}</div>
      ) : ranking.length === 0 ? (
        <div className="op-card">
          <div className="op-card__body">
            <div className="op-empty">Hələ ki statistika yoxdur</div>
          </div>
        </div>
      ) : (
        <>
          <div className="op-card">
            <div className="op-card__head">
              <div>
                <h2>Reytinq — tamamlanmış seanslar</h2>
                <p>Ən çox seans keçirən psixoloqlar</p>
              </div>
              <span className="op-card__count">{ranking.length}</span>
            </div>
            <div className="op-card__body">
              <RankingBarChart data={sorted} />
            </div>
          </div>

          <div className="op-card">
            <div className="op-card__head">
              <div>
                <h2>Cədvəl</h2>
                <p>Başlığa klikləyərək sıralayın</p>
              </div>
            </div>
            <div className="op-card__body" style={{ overflowX: "auto" }}>
              <table className="op-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--oxford-60)", borderBottom: "1px solid #E5E7EB" }}>
                    <Th label="Ad" onClick={() => toggleSort("name")} suffix={arrow("name")} />
                    <Th label="Seans" align="right" onClick={() => toggleSort("completedSessions")} suffix={arrow("completedSessions")} />
                    <Th label="Fanus" align="right" onClick={() => toggleSort("fanusSessions")} suffix={arrow("fanusSessions")} />
                    <Th label="Aktiv pasient" align="right" onClick={() => toggleSort("activePatients")} suffix={arrow("activePatients")} />
                    <Th label="Reytinq" align="right" onClick={() => toggleSort("rankingScore")} suffix={arrow("rankingScore")} />
                    <th style={{ padding: "10px 12px" }}>Tip</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const tl = typeLabel(p.psychologistType);
                    return (
                      <tr key={p.psychologistId} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                          <Link
                            href={`/operator/psychologists/${p.psychologistId}`}
                            style={{ color: "var(--brand-700)", textDecoration: "none" }}
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>{p.completedSessions}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>{p.fanusSessions}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>{p.activePatients}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtScore(p.rankingScore)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span className="op-row__badge" data-tone={tl.tone}>{tl.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  label, onClick, suffix, align,
}: {
  label: string;
  onClick: () => void;
  suffix: string;
  align?: "right";
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "10px 12px",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        textAlign: align === "right" ? "right" : "left",
      }}
    >
      {label}{suffix}
    </th>
  );
}
