"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { adminApi, type Appointment } from "@/lib/api";
import { IconSearch } from "../_components/icons";

type Column = {
  status: string;
  title: string;
  dotColor: string;
};

const COLUMNS: Column[] = [
  { status: "PENDING",   title: "Yeni müraciət",  dotColor: "var(--gold)" },
  { status: "CONFIRMED", title: "Təsdiqləndi",    dotColor: "var(--sage)" },
  { status: "COMPLETED", title: "Tamamlandı",     dotColor: "var(--ox-200)" },
  { status: "CANCELLED", title: "Ləğv edildi",    dotColor: "var(--rose)" },
];

const AVATAR_COLORS = ["#7c6f99", "#7c9a86", "#b58a3c", "#2f5283", "#5d6b85", "#0a2d59"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(name: string) {
  const hash = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "indi";
  if (min < 60) return `⏱ ${min} dəq`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `⏱ ${hrs}s ${min % 60}dəq`;
  const days = Math.floor(hrs / 24);
  return `⏱ ${days}g`;
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "week" | "urgent">("all");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.getAppointments().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return items.filter((a) => {
      if (q) {
        const hay = `${a.id} ${a.patientName} ${a.psychologistName ?? ""} ${a.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "today") {
        return new Date(a.createdAt) >= today;
      }
      if (filter === "week") {
        return new Date(a.createdAt) >= weekAgo;
      }
      if (filter === "urgent") {
        const ageMin = (Date.now() - new Date(a.createdAt).getTime()) / 60000;
        return a.status === "PENDING" && ageMin < 120;
      }
      return true;
    });
  }, [items, search, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, Appointment[]> = { PENDING: [], CONFIRMED: [], COMPLETED: [], CANCELLED: [] };
    filtered.forEach((a) => {
      const status = (a.status || "PENDING").toUpperCase();
      (map[status] ?? (map[status] = [])).push(a);
    });
    return map;
  }, [filtered]);

  const updateStatus = async (id: number, status: string) => {
    const before = items;
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await adminApi.updateAppointmentStatus(id, status);
    } catch (e) {
      setItems(before);
      alert((e as Error).message);
    }
  };

  const onDragStart = (id: number) => (e: DragEvent<HTMLDivElement>) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (col: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overCol !== col) setOverCol(col);
  };

  const onDrop = (col: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOverCol(null);
    if (draggedId == null) return;
    const current = items.find((a) => a.id === draggedId);
    if (current && current.status !== col) updateStatus(draggedId, col);
    setDraggedId(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Randevular</h1>
          <p className="page-sub">Müraciətləri psixoloqlara yönləndirin və status izləyin. Sürükləmə ilə statusu dəyişin.</p>
        </div>
        <div className="page-actions">
          <button className="btn">Cədvəl görünüşü</button>
          <button className="btn">Təqvim</button>
        </div>
      </div>

      <div
        className="toolbar"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 14 }}
      >
        <div className="search">
          <IconSearch size={13} style={{ color: "var(--muted)" }} />
          <input
            placeholder="Müraciət ID, müştəri adı..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {([
          { k: "all", label: "Bütün psixoloqlar" },
          { k: "today", label: "Bu gün" },
          { k: "week", label: "Bu həftə" },
          { k: "urgent", label: `Təcili (${items.filter((a) => a.status === "PENDING" && (Date.now() - new Date(a.createdAt).getTime()) / 60000 < 120).length})` },
        ] as const).map((f) => (
          <button
            key={f.k}
            className={`filter${filter === f.k ? " active" : ""}`}
            onClick={() => setFilter(f.k)}
          >
            {f.label}
          </button>
        ))}
        <div className="toolbar-spacer" />
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>AI yönləndirmə:</span>
        <span className="pill sage"><span className="dot" />aktiv</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>
      ) : (
        <div className="kanban">
          {COLUMNS.map((col) => {
            const list = grouped[col.status] ?? [];
            return (
              <div
                key={col.status}
                className={`col${overCol === col.status ? " drag-over" : ""}`}
                onDragOver={onDragOver(col.status)}
                onDragLeave={() => setOverCol(null)}
                onDrop={onDrop(col.status)}
              >
                <div className="col-head">
                  <div className="col-title">
                    <span style={{ width: 8, height: 8, background: col.dotColor, borderRadius: "50%" }} />
                    {col.title}
                    <span className="col-count">{list.length}</span>
                  </div>
                </div>
                {list.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--muted-2)", fontSize: 11.5 }}>
                    Boşdur
                  </div>
                ) : (
                  list.map((a) => {
                    const minutesOld = (Date.now() - new Date(a.createdAt).getTime()) / 60000;
                    const urgent = a.status === "PENDING" && minutesOld < 120;
                    return (
                      <div
                        key={a.id}
                        className={`ticket${draggedId === a.id ? " dragging" : ""}`}
                        draggable
                        onDragStart={onDragStart(a.id)}
                        onDragEnd={() => { setDraggedId(null); setOverCol(null); }}
                      >
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <span className="ticket-id">#FNS-{String(a.id).padStart(4, "0")}</span>
                          {urgent && <span className="pill rose" style={{ fontSize: 10, padding: "1px 6px" }}>təcili</span>}
                          {a.status === "CONFIRMED" && <span className="pill sage" style={{ fontSize: 10, padding: "1px 6px" }}>təsdiqləndi</span>}
                        </div>
                        <div className="ticket-title">
                          {a.note ? a.note.slice(0, 60) : "Konsultasiya"}
                        </div>
                        <div className="ticket-meta">
                          <div className="row-avatar">
                            <div className="av" style={{ width: 20, height: 20, fontSize: 9, background: avatarColor(a.patientName) }}>
                              {initials(a.patientName)}
                            </div>
                            <span>{a.patientName}</span>
                          </div>
                          <span className="ticket-time">
                            {a.preferredDate ? (() => {
                              const d = new Date(a.preferredDate);
                              const day = String(d.getDate()).padStart(2, "0");
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              return `${day}.${month}.${d.getFullYear()}`;
                            })() : relTime(a.createdAt)}
                          </span>
                        </div>
                        {a.psychologistName && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>→ {a.psychologistName}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
