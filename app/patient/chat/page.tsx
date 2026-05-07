"use client";

import { useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { patientApi } from "@/lib/api";

export default function PatientChatPage() {
  const [showStart, setShowStart] = useState(false);
  const api = useMemo(() => ({
    threads: patientApi.chatThreads,
    messages: patientApi.chatMessages,
    send: patientApi.chatSend,
    markRead: patientApi.chatMarkRead,
  }), []);
  return (
    <div style={{ padding: "1.5rem 2rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", marginBottom: 14 }}>Mesajlar</h1>
      <ChatPanel api={api} role="PATIENT" onStartThread={() => setShowStart(true)} />
      {showStart && <StartThreadModal onClose={() => setShowStart(false)} />}
    </div>
  );
}

function StartThreadModal({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(440px,100%)", textAlign: "center" }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>💬</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A2535", marginBottom: 8 }}>Yeni söhbət başlat</h2>
        <p style={{ fontSize: 13, color: "#52718F", marginBottom: 16 }}>
          Psixoloq səhifəsindən "Mesaj göndər" düyməsi ilə yeni söhbət başlada bilərsiniz.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <a href="/psychologists"
            style={{ padding: "10px 18px", border: "none", borderRadius: 10, background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Psixoloqlara bax
          </a>
          <button onClick={onClose}
            style={{ padding: "10px 18px", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff", color: "#1A2535", fontSize: 13, cursor: "pointer" }}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}
