"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type ContactMessage } from "@/lib/api";

type StatusFilter = "all" | ContactMessage["status"];

const STATUS_META: Record<ContactMessage["status"], { label: string; bg: string; color: string }> = {
  NEW:        { label: "Yeni",        bg: "#FEF3C7", color: "#92400E" },
  IN_REVIEW:  { label: "Baxılır",     bg: "#DBEAFE", color: "#1E40AF" },
  RESOLVED:   { label: "Həll edildi", bg: "#DCFCE7", color: "#166534" },
  SPAM:       { label: "Spam",        bg: "#FEE2E2", color: "#991B1B" },
};

function fmtDateTime(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ContactMessage["status"] }) {
  const meta = STATUS_META[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: meta.bg, color: meta.color, whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

export default function AdminMessagesPage() {
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = () => {
    setLoading(true);
    adminApi.getContactMessages().then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: items.length,
    newCount: items.filter(m => m.status === "NEW").length,
    inReview: items.filter(m => m.status === "IN_REVIEW").length,
    resolved: items.filter(m => m.status === "RESOLVED").length,
  }), [items]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q) ||
        (m.subject ?? "").toLowerCase().includes(q) ||
        (m.ticketCode ?? "").toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter(m => m.status === filterStatus);
    return list;
  }, [items, search, filterStatus]);

  const updateStatus = async (id: number, status: ContactMessage["status"], note?: string) => {
    setUpdatingId(id);
    try {
      const updated = await adminApi.updateContactMessageStatus(id, status, note);
      setItems(prev => prev.map(m => m.id === id ? updated : m));
    } finally {
      setUpdatingId(null);
    }
  };

  const openMessage = items.find(m => m.id === openId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1A2535", margin: 0 }}>Əlaqə mesajları</h1>
          <p style={{ fontSize: 13, color: "#8AAABF", marginTop: 3, marginBottom: 0 }}>
            İctimai əlaqə formundan gələn mesajlar
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))", gap: 10 }}>
        <StatCard label="Ümumi" value={stats.total} color="#1A2535" />
        <StatCard label="Yeni" value={stats.newCount} color="#92400E" />
        <StatCard label="Baxılır" value={stats.inReview} color="#1E40AF" />
        <StatCard label="Həll edildi" value={stats.resolved} color="#166534" />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E4EDF6", padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Ad, email, telefon, mesaj, FNS- kodu…"
          style={{ flex: "1 1 240px", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#1A2535", outline: "none" }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as StatusFilter)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E4EDF6", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}
        >
          <option value="all">Bütün statuslar</option>
          <option value="NEW">Yeni</option>
          <option value="IN_REVIEW">Baxılır</option>
          <option value="RESOLVED">Həll edildi</option>
          <option value="SPAM">Spam</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#8AAABF", padding: "60px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>
          Yüklənir…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2535", margin: "0 0 6px" }}>
            {search || filterStatus !== "all" ? "Mesaj tapılmadı" : "Hələ mesaj yoxdur"}
          </p>
          <p style={{ fontSize: 13, color: "#8AAABF", margin: 0 }}>
            {search || filterStatus !== "all" ? "Filteri dəyişin" : "İctimai formdan gələn mesajlar burada görünəcək"}
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4EDF6", overflow: "hidden" }}>
          {filtered.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => { setOpenId(m.id); setAdminNote(m.adminNote ?? ""); }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 140px 120px",
                gap: 12,
                alignItems: "center",
                width: "100%",
                padding: "14px 16px",
                borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none",
                border: "none",
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1A2535", marginBottom: 2 }}>
                  {m.ticketCode && (
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#1051B7", background: "#EEF5FF", border: "1px solid #C3D6F6", borderRadius: 6, padding: "1px 6px", marginRight: 8 }}>
                      {m.ticketCode}
                    </span>
                  )}
                  {m.name}
                  {m.subject && <span style={{ fontWeight: 500, color: "#52718F", marginLeft: 8 }}>— {m.subject}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#8AAABF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 600 }}>
                  {m.message.slice(0, 140)}{m.message.length > 140 ? "…" : ""}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#52718F", whiteSpace: "nowrap" }}>
                {m.email ?? m.phone ?? "—"}
              </div>
              <div style={{ fontSize: 12, color: "#8AAABF", whiteSpace: "nowrap" }}>
                {fmtDateTime(m.createdAt)}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <StatusBadge status={m.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {openMessage && (
        <div
          onClick={() => setOpenId(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0F1C2E", margin: "0 0 4px" }}>
                  {openMessage.name}
                </h3>
                <p style={{ fontSize: 12, color: "#8AAABF", margin: 0 }}>
                  {openMessage.ticketCode && (
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1051B7", marginRight: 8 }}>
                      {openMessage.ticketCode}
                    </span>
                  )}
                  {fmtDateTime(openMessage.createdAt)}
                </p>
              </div>
              <StatusBadge status={openMessage.status} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {openMessage.email && (
                <Detail label="Email" value={
                  <a href={`mailto:${openMessage.email}`} style={{ color: "var(--brand)", textDecoration: "none" }}>{openMessage.email}</a>
                } />
              )}
              {openMessage.phone && (
                <Detail label="Telefon" value={
                  <a href={`tel:${openMessage.phone}`} style={{ color: "var(--brand)", textDecoration: "none" }}>{openMessage.phone}</a>
                } />
              )}
              {openMessage.subject && <Detail label="Mövzu" value={openMessage.subject} />}
              {openMessage.userEmail && <Detail label="Qeydiyyatlı istifadəçi" value={openMessage.userEmail} />}
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Mesaj
              </p>
              <div style={{
                padding: "12px 14px", borderRadius: 10, background: "#F8FAFD",
                fontSize: 14, color: "#1A2535", lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>
                {openMessage.message}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Admin qeyd
              </p>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Daxili qeydlər (yalnız admin görür)…"
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid #E4EDF6", fontSize: 13, color: "#1A2535",
                  outline: "none", background: "#F8FAFD", resize: "vertical", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => setOpenId(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E4EDF6", background: "#fff", color: "#52718F", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Bağla
              </button>
              {openMessage.status !== "SPAM" && (
                <button
                  onClick={() => updateStatus(openMessage.id, "SPAM", adminNote)}
                  disabled={updatingId === openMessage.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#FEE2E2", color: "#991B1B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Spam
                </button>
              )}
              {openMessage.status !== "IN_REVIEW" && openMessage.status !== "RESOLVED" && (
                <button
                  onClick={() => updateStatus(openMessage.id, "IN_REVIEW", adminNote)}
                  disabled={updatingId === openMessage.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#DBEAFE", color: "#1E40AF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Baxılır
                </button>
              )}
              {openMessage.status !== "RESOLVED" && (
                <button
                  onClick={() => updateStatus(openMessage.id, "RESOLVED", adminNote)}
                  disabled={updatingId === openMessage.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Həll edildi
                </button>
              )}
              {openMessage.status === "RESOLVED" && (
                <button
                  onClick={() => updateStatus(openMessage.id, "NEW", adminNote)}
                  disabled={updatingId === openMessage.id}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#FEF3C7", color: "#92400E", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Yenidən aç
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#8AAABF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 13, color: "#1A2535", margin: 0, wordBreak: "break-word" }}>{value}</p>
    </div>
  );
}
