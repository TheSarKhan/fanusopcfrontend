"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type GoogleCalendarStatus } from "@/lib/api";

/** Self-contained card that lets a psychologist connect/disconnect their
 *  Google Calendar. Read-only when GOOGLE_CLIENT_ID is unset on the backend. */
export default function GoogleCalendarCard() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "resync" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    psychologistApi.googleStatus()
      .then(setStatus)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Show a quick toast if we just returned from the OAuth round-trip.
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "connected") {
      setResyncMsg("Google Calendar uğurla qoşuldu — yaxınlaşan randevular sinxronlaşdı.");
      params.delete("google");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (g === "error") {
      const reason = params.get("reason") || "naməlum xəta";
      setErr(`Google qoşulması alınmadı: ${reason}`);
      params.delete("google");
      params.delete("reason");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connect = async () => {
    setBusy("connect"); setErr(null);
    try {
      const { url } = await psychologistApi.googleAuthUrl();
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!confirm("Google Calendar bağlantısını ayırmaq istədiyinizdən əminsiniz? Mövcud Google hadisələri silinməyəcək, amma yenilənmələr dayanacaq.")) return;
    setBusy("disconnect"); setErr(null);
    try {
      await psychologistApi.googleDisconnect();
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const resync = async () => {
    setBusy("resync"); setErr(null); setResyncMsg(null);
    try {
      const r = await psychologistApi.googleResync();
      setResyncMsg(`${r.queued} randevu sinxronlaşdırma növbəsinə əlavə edildi.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="uprof-card">
      <div className="uprof-card-head">
        <h2>Google Calendar</h2>
        <p>Randevularınızı şəxsi Google Calendar-a avtomatik sinxronlaşdırın</p>
      </div>
      <div style={{ padding: 20 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: "#52718F" }}>Yüklənir…</div>
        ) : !status?.configured ? (
          <NotConfigured />
        ) : status.connected ? (
          <Connected
            status={status}
            disconnect={disconnect}
            resync={resync}
            busy={busy}
          />
        ) : (
          <Disconnected connect={connect} busy={busy} />
        )}

        {resyncMsg && (
          <div style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 12.5,
            background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0",
          }}>
            {resyncMsg}
          </div>
        )}
        {err && (
          <div style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 12.5,
            background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA",
          }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div style={{ fontSize: 12.5, color: "#52718F", lineHeight: 1.6 }}>
      Bu inteqrasiya hələ konfiqurasiya olunmayıb. Admin komandası backend-də{" "}
      <code style={{ fontSize: 12 }}>GOOGLE_CLIENT_ID</code>,{" "}
      <code style={{ fontSize: 12 }}>GOOGLE_CLIENT_SECRET</code> və{" "}
      <code style={{ fontSize: 12 }}>GOOGLE_REDIRECT_URI</code> dəyərlərini qurmalıdır.
    </div>
  );
}

function Disconnected({ connect, busy }: { connect: () => void; busy: string | null }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "#52718F", lineHeight: 1.6 }}>
        Hesabı qoşduqdan sonra hər təyin edilmiş randevu Google Calendar-da
        avtomatik olaraq görünəcək. Pasiyentlərə Google tərəfindən e-poçt
        göndərilməyəcək — yalnız sizin cədvəlinizdə əks olunacaq.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#52718F", lineHeight: 1.7 }}>
        <li>Randevu təyin olunanda yeni hadisə yaranır</li>
        <li>Saat və ya status dəyişəndə hadisə yenilənir</li>
        <li>Ləğv olunanda hadisə silinir</li>
        <li>60 və 15 dəq. əvvələ avtomatik xatırlatma əlavə olunur</li>
      </ul>
      <button onClick={connect} disabled={busy !== null}
        style={btnPrimary(busy !== null)}>
        <GoogleIcon /> {busy === "connect" ? "Yönləndirilir…" : "Google ilə qoşul"}
      </button>
    </div>
  );
}

function Connected({
  status, disconnect, resync, busy,
}: {
  status: GoogleCalendarStatus;
  disconnect: () => void;
  resync: () => void;
  busy: string | null;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", background: "#ECFDF5",
        border: "1px solid #A7F3D0", borderRadius: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "#fff", border: "1px solid #D1FAE5",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <GoogleIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {status.email || "Qoşuldu"}
          </div>
          <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>
            {status.lastSyncAt
              ? `Son sinxronizasiya · ${new Date(status.lastSyncAt).toLocaleString("az-AZ")}`
              : "Aktiv"}
          </div>
        </div>
      </div>

      {status.lastError && (
        <div style={{
          padding: "10px 12px", borderRadius: 8, fontSize: 12,
          background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412",
        }}>
          Son xəta: {status.lastError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={resync} disabled={busy !== null} style={btnSecondary(busy !== null)}>
          {busy === "resync" ? "Sinxronlaşdırılır…" : "Yenidən sinxronlaşdır"}
        </button>
        <button onClick={disconnect} disabled={busy !== null} style={btnDanger(busy !== null)}>
          {busy === "disconnect" ? "Ayrılır…" : "Bağlantını ayır"}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.8 12.2c0-.6-.1-1.2-.2-1.7H12v3.4h5.5c-.2 1.2-1 2.3-2 3v2.4h3.3c1.9-1.8 3-4.4 3-7.1z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.4c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3v2.5C4.7 19.8 8.1 22 12 22z" fill="#34A853"/>
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H3C2.4 9 2 10.5 2 12s.4 3 1 4.5L6.4 14z" fill="#FBBC04"/>
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.6 2 12 2 8.1 2 4.7 4.2 3 7.5L6.4 10c.8-2.4 3-4.1 5.6-4.1z" fill="#EA4335"/>
    </svg>
  );
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
    padding: "12px 18px", borderRadius: 10, border: "1px solid #E5E7EB",
    background: "#fff", color: "#1A2535", fontWeight: 600, fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
    background: "#fff", color: "#1A2535", fontWeight: 600, fontSize: 12.5,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}

function btnDanger(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #FECACA",
    background: "#fff", color: "#991B1B", fontWeight: 600, fontSize: 12.5,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}
