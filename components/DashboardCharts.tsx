"use client";

// Dashboard qrafikləri — recharts client-only render etdiyi üçün ayrıca
// 'use client' faylında saxlanılır (AnalyticsCharts ilə eyni nümunə).
//
// Rəng seçimi UI kit qadağalarına tabedir: qrafik rəngi status rozeti DEYİL,
// yalnız seriyaları ayırd etmək üçündür.

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type {
  DailyFlow, TopicSlice, PsychologistWorkload, TrendPoint, FunnelStep,
} from "@/lib/api";
import { azFormatDate } from "@/lib/datetime";

const BRAND = "#1051B7";
const SAGE = "#7c9a86";
const GOLD = "#b58a3c";
const ROSE = "#b4485a";

/** 14 günlük randevu axını — təsdiqlənmiş / gözləyən / ləğv.
 *  `date` backend-dən ARTIQ göstərilməyə hazır gəlir (yalnız gün nömrəsi, "dd"),
 *  tam tarix deyil — ona görə burada tarix formatlaması TƏTBİQ EDİLMİR. */
export function AppointmentFlowChart({ data }: { data: DailyFlow[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="confirmed" name="Təsdiqlənmiş" stackId="1"
          stroke={SAGE} fill={SAGE} fillOpacity={0.25} strokeWidth={2} />
        <Area type="monotone" dataKey="pending" name="Gözləyən" stackId="1"
          stroke={GOLD} fill={GOLD} fillOpacity={0.25} strokeWidth={2} />
        <Area type="monotone" dataKey="cancelled" name="Ləğv" stackId="1"
          stroke={ROSE} fill={ROSE} fillOpacity={0.2} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Psixoloq yükü — gələcək və tamamlanmış seanslar. */
export function WorkloadChart({ data }: { data: PsychologistWorkload[] }) {
  const rows = [...data].sort((a, b) => b.total - a.total).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="upcoming" name="Gələcək" fill={BRAND} radius={[0, 4, 4, 0]} />
        <Bar dataKey="completed" name="Tamamlanmış" fill={SAGE} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 30 günlük randevu trendi. `date` tam ISO gündür (yyyy-mm-dd) — burada
 *  gg.aa formatına salınır. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const rows = data.map(d => ({ ...d, label: azFormatDate(d.date).slice(0, 5) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Line type="monotone" dataKey="count" name="Randevu" stroke={BRAND} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Konversiya hunisi — yalnız ÖLÇÜLƏN pillələr (uydurma pillələr silinib). */
export function FunnelChart({ data }: { data: FunnelStep[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: number, _n, p) => [`${v} (${p?.payload?.pctOfTotal ?? 0}%)`, "Say"]} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((s, i) => <Cell key={i} fill={s.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Məzmun mövzularının bölgüsü — bloq kateqoriyalarından (real sayğac). */
export function TopicPieChart({ data }: { data: TopicSlice[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="percent" nameKey="label" cx="50%" cy="50%"
          innerRadius={52} outerRadius={86} paddingAngle={2}>
          {data.map((s, i) => <Cell key={i} fill={s.color} />)}
        </Pie>
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
