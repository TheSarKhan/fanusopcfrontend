"use client";

import { useEffect, useRef, useState } from "react";
import { type ChatMessage, type ChatThread } from "@/lib/api";
import { subscribeChat } from "@/lib/notificationsSocket";
import { getStoredUser } from "@/lib/auth";

type ChatApi = {
  threads: () => Promise<ChatThread[]>;
  messages: (threadId: number) => Promise<ChatMessage[]>;
  send: (threadId: number, body: string) => Promise<ChatMessage>;
  markRead: (threadId: number) => Promise<{ updated: number }>;
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function ChatPanel({
  api, role, onStartThread,
}: {
  api: ChatApi;
  role: "PATIENT" | "PSYCHOLOGIST";
  onStartThread?: () => void;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [active, setActive] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const me = getStoredUser();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial threads load
  useEffect(() => {
    api.threads().then(setThreads).catch(() => {}).finally(() => setLoading(false));
  }, [api]);

  // Load messages for active thread + mark read
  useEffect(() => {
    if (!active) { setMessages([]); return; }
    api.messages(active.id).then(setMessages).catch(() => {});
    api.markRead(active.id).catch(() => {});
    setThreads(prev => prev.map(t => t.id === active.id ? { ...t, unreadCount: 0 } : t));
  }, [active, api]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Live WS — append messages for the active thread, refresh thread list otherwise
  useEffect(() => {
    return subscribeChat((m) => {
      if (active && m.threadId === active.id) {
        setMessages(prev => [...prev, m]);
        api.markRead(active.id).catch(() => {});
      } else {
        // Bump unread count for that thread
        setThreads(prev => {
          const idx = prev.findIndex(t => t.id === m.threadId);
          if (idx < 0) {
            // refresh threads list to catch newly-created ones
            api.threads().then(setThreads).catch(() => {});
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...next[idx], unreadCount: next[idx].unreadCount + 1, lastMessageAt: m.createdAt, lastMessagePreview: m.body.slice(0, 80) };
          return next;
        });
      }
    });
  }, [active, api]);

  const send = async () => {
    if (!active || !body.trim() || sending) return;
    setSending(true);
    try {
      const created = await api.send(active.id, body.trim());
      setMessages(prev => [...prev, created]);
      setBody("");
    } catch (e) { alert((e as Error).message); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 12, height: "calc(100vh - 140px)" }}>
      {/* Threads list */}
      <aside style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "auto" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #EFF2F7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#1A2535" }}>Söhbətlər</strong>
          {onStartThread && (
            <button onClick={onStartThread}
              style={{ padding: "4px 10px", fontSize: 11, border: "1px solid #C7D2FE", color: "#3730A3", background: "#EEF2FF", borderRadius: 6, cursor: "pointer" }}>
              + Yeni
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#52718F", fontSize: 13 }}>Yüklənir…</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#52718F", fontSize: 13 }}>
            Hələ söhbət yoxdur.
          </div>
        ) : threads.map(t => {
          const otherName = role === "PATIENT" ? t.psychologistName : t.patientName;
          const isActive = active?.id === t.id;
          return (
            <button key={t.id} onClick={() => setActive(t)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                background: isActive ? "#EEF2FF" : "#fff",
                border: "none", borderBottom: "1px solid #F3F4F6", cursor: "pointer",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600, color: "#1A2535", fontSize: 13 }}>{otherName}</div>
                {t.unreadCount > 0 && (
                  <span style={{ background: "#DC2626", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{t.unreadCount}</span>
                )}
              </div>
              {t.lastMessagePreview && (
                <div style={{ fontSize: 12, color: "#52718F", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.lastMessagePreview}
                </div>
              )}
              {t.lastMessageAt && (
                <div style={{ fontSize: 10, color: "#8AAABF", marginTop: 2 }}>{fmtDay(t.lastMessageAt)} · {fmt(t.lastMessageAt)}</div>
              )}
            </button>
          );
        })}
      </aside>

      {/* Active thread */}
      <main style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!active ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#52718F", fontSize: 14 }}>
            Söhbət seçin
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #EFF2F7" }}>
              <strong style={{ color: "#1A2535" }}>
                {role === "PATIENT" ? active.psychologistName : active.patientName}
              </strong>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#52718F", fontSize: 13, marginTop: 60 }}>
                  Hələ mesaj yoxdur — ilk mesajı yazın.
                </div>
              ) : messages.map(m => {
                const mine = me?.userId === m.senderUserId;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "75%",
                      background: mine ? "linear-gradient(135deg,#002147,#5A4FC8)" : "#F3F4F6",
                      color: mine ? "#fff" : "#1A2535",
                      padding: "8px 12px", borderRadius: 12,
                      borderBottomRightRadius: mine ? 4 : 12,
                      borderBottomLeftRadius: mine ? 12 : 4,
                      fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {m.body}
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                        {fmt(m.createdAt)}{m.readAt && mine ? " ✓✓" : mine ? " ✓" : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid #EFF2F7", padding: 10, display: "flex", gap: 8 }}>
              <textarea
                rows={1}
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => {
                  // Don't send during IME composition (multi-key input)
                  const composing = (e.nativeEvent as { isComposing?: boolean }).isComposing;
                  if (e.key === "Enter" && !e.shiftKey && !composing) { e.preventDefault(); send(); }
                }}
                placeholder="Mesaj yazın…"
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", resize: "none" }} />
              <button onClick={send} disabled={sending || !body.trim()}
                style={{ padding: "0 18px", border: "none", borderRadius: 10, background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer", opacity: sending || !body.trim() ? 0.6 : 1 }}>
                Göndər
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
