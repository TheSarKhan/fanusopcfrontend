"use client";

import { useMemo } from "react";
import ChatPanel from "@/components/ChatPanel";
import { psychologistApi } from "@/lib/api";

export default function PsychologChatPage() {
  const api = useMemo(() => ({
    threads: psychologistApi.chatThreads,
    messages: psychologistApi.chatMessages,
    send: psychologistApi.chatSend,
    markRead: psychologistApi.chatMarkRead,
  }), []);
  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", marginBottom: 14 }}>Mesajlar</h1>
      <ChatPanel api={api} role="PSYCHOLOGIST" />
    </>
  );
}
