"use client";

/**
 * Minimal STOMP-over-WebSocket client tailored for our notifications channel.
 * Connects to the /ws-native endpoint, authenticates with the JWT in the
 * STOMP CONNECT frame, and listens on /user/queue/notifications.
 *
 * Auto-reconnects with exponential backoff. No external dependencies.
 */

import type { NotificationItem } from "./api";
import { getStoredUser } from "./auth";

const NULL = "\0";

type Listener = (n: NotificationItem) => void;

let socket: WebSocket | null = null;
let connected = false;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyClosed = false;
let listeners = new Set<Listener>();

function apiHost(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
  // Drop trailing /api[/] then return the origin
  const stripped = base.replace(/\/api\/?$/, "");
  return stripped;
}

function wsUrl(): string {
  const host = apiHost(); // e.g. http://localhost:8080
  const proto = host.startsWith("https") ? "wss" : "ws";
  const noProto = host.replace(/^https?:\/\//, "");
  return `${proto}://${noProto}/ws-native`;
}

// Auth rides on the HTTP-only accessToken cookie. The backend WS handshake
// interceptor reads it and stashes the user identity in WS session attributes.
// We only need to gate connection attempts on "is there a session at all?".
function hasSession(): boolean {
  return getStoredUser() !== null;
}

function buildFrame(command: string, headers: Record<string, string>, body = ""): string {
  const headerStr = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join("\n");
  return `${command}\n${headerStr}\n\n${body}${NULL}`;
}

function parseFrame(raw: string): { command: string; headers: Record<string, string>; body: string } | null {
  const idx = raw.indexOf("\n\n");
  if (idx < 0) return null;
  const head = raw.slice(0, idx);
  const body = raw.slice(idx + 2).replace(/\0$/, "");
  const lines = head.split("\n");
  const command = lines.shift() ?? "";
  const headers: Record<string, string> = {};
  for (const line of lines) {
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    headers[line.slice(0, sep)] = line.slice(sep + 1);
  }
  return { command, headers, body };
}

function scheduleReconnect() {
  if (reconnectTimer || manuallyClosed) return;
  const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttempt));
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!manuallyClosed) connect();
  }, delay);
}

function connect() {
  if (manuallyClosed) return;
  if (!hasSession()) return; // not logged in yet
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    // Spring's STOMP-over-WebSocket negotiates a subprotocol. Without it
    // the broker may reject frames or close the connection silently.
    socket = new WebSocket(wsUrl(), ["v12.stomp", "v11.stomp", "v10.stomp"]);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    // No Authorization header — the WS handshake captured the cookie identity
    // and stored it in the session, so the STOMP CONNECT inherits that user.
    socket?.send(buildFrame("CONNECT", {
      "accept-version": "1.2",
      "host": "fanus",
    }));
  };

  socket.onmessage = (ev) => {
    if (typeof ev.data !== "string") return;
    const frame = parseFrame(ev.data);
    if (!frame) return;

    if (frame.command === "CONNECTED") {
      connected = true;
      reconnectAttempt = 0;
      // Subscribe to user-targeted notifications
      socket?.send(buildFrame("SUBSCRIBE", {
        id: "sub-notifications",
        destination: "/user/queue/notifications",
      }));
    } else if (frame.command === "MESSAGE") {
      try {
        const payload = JSON.parse(frame.body) as NotificationItem;
        listeners.forEach(l => { try { l(payload); } catch { /* ignore */ } });
      } catch { /* malformed */ }
    } else if (frame.command === "ERROR") {
      // Auth failure or backend rejection — don't reconnect aggressively
      try { socket?.close(); } catch { /* ignore */ }
    }
  };

  socket.onclose = () => {
    connected = false;
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    // Let onclose handle the reconnect
  };
}

export function subscribeNotifications(listener: Listener): () => void {
  manuallyClosed = false;
  listeners.add(listener);
  if (!connected) connect();
  return () => { listeners.delete(listener); };
}

export function disconnectNotifications() {
  manuallyClosed = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  try { socket?.close(); } catch { /* ignore */ }
  socket = null;
  connected = false;
  reconnectAttempt = 0;
  listeners = new Set();
}

if (typeof window !== "undefined") {
  window.addEventListener("fanus:session-cleared", () => { disconnectNotifications(); });
}
