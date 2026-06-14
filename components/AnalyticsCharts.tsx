"use client";

// Modul H — analitika qrafikləri (recharts ilk istifadə). İzolə 'use client'
// komponenti; recharts ResponsiveContainer client-only render edir.
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { AnalyticsTimePoint, PsychologistRankItem } from "@/lib/api";

export function SessionsLineChart({ data }: { data: AnalyticsTimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="completed" name="Tamamlanmış" stroke="#2563eb" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="cancelled" name="Ləğv" stroke="#dc2626" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RankingBarChart({ data }: { data: PsychologistRankItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="completedSessions" name="Seans" fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyDynamicsChart({ data }: { data: { month: string; total: number; completed: number; cancelled: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="total" name="Cəmi" stroke="#0f766e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="completed" name="Tamamlanmış" stroke="#2563eb" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="cancelled" name="Ləğv" stroke="#dc2626" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
