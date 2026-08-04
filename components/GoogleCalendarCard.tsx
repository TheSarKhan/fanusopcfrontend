"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type GoogleCalendarStatus } from "@/lib/api";
import { azFormatDateTime } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast } from "@/components/Toast";
import {
  PC, sideCardStyle, sectionH2, rowSplit, rowKey, rowVal,
  btnDark, btnGhost, btnIdle, Spinner, IconCheck,
  ConfirmDialog, type ConfirmSpec,
} from "@/components/ProfileShell";

/** Psixoloqun Google Calendar bağlantısını idarə edən yan panel kartı.
 *  Backend-də GOOGLE_CLIENT_ID qurulmayıbsa yalnız izah göstərilir. */
export default function GoogleCalendarCard() {
  const { t } = useT();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);

  const load = () => {
    setLoading(true);
    psychologistApi.googleStatus()
      .then(setStatus)
      .catch((e: Error) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // OAuth dövriyyəsindən qayıdışda nəticəni bildir.
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "connected") {
      toast(`${t("prof.calTitle")}: ${t("prof.calConnected")}`);
      params.delete("google");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (g === "error") {
      const reason = params.get("reason") || "";
      toast(`Google: ${reason || t("prof.errTitle")}`, "error");
      params.delete("google");
      params.delete("reason");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await psychologistApi.googleAuthUrl();
      window.location.href = url;
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  const openDisconnect = () => setConfirmSpec({
    title: t("prof.calDiscTitle"),
    body: t("prof.calDiscBody"),
    label: t("prof.calDiscLabel"),
    run: async () => {
      setBusy(true);
      try {
        await psychologistApi.googleDisconnect();
        toast(t("prof.calDiscToast"));
        load();
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setBusy(false);
      }
    },
  });

  const resync = async () => {
    setBusy(true);
    try {
      const r = await psychologistApi.googleResync();
      toast(t("prof.calResyncToast", { n: r.queued }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const connected = !!status?.connected;

  return (
    <section style={sideCardStyle}>
      <h2 style={sectionH2}>{t("prof.calTitle")}</h2>
      <p style={{ fontSize: 12.5, color: PC.soft, lineHeight: 1.55, margin: "5px 0 14px" }}>
        {t("prof.calSub")}
      </p>

      {loading ? (
        <div style={{ fontSize: 12.5, color: PC.faint, paddingTop: 13, borderTop: `1px solid ${PC.hair}` }}>
          {t("prof.loadingNote")}
        </div>
      ) : !status?.configured ? (
        <div style={{ fontSize: 12.5, color: PC.mut, lineHeight: 1.55, paddingTop: 13, borderTop: `1px solid ${PC.hair}` }}>
          {t("prof.calNotConfigured")}
        </div>
      ) : (
        <>
          <div style={{ ...rowSplit, padding: "13px 0 0", marginTop: 0 }}>
            <span style={rowKey}>{t("prof.calStatus")}</span>
            {connected ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: PC.ink }}>
                <IconCheck />
                {t("prof.calConnected")}
              </span>
            ) : (
              <span style={{ fontSize: 12.5, fontWeight: 500, color: PC.faint }}>{t("prof.calDisconnected")}</span>
            )}
          </div>

          {connected && status.email && (
            <div style={{ ...rowSplit, marginTop: 13 }}>
              <span style={rowKey}>{t("prof.calAccount")}</span>
              <span style={{ ...rowVal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status.email}</span>
            </div>
          )}
          {connected && status.lastSyncAt && (
            <div style={rowSplit}>
              <span style={rowKey}>{t("prof.calLastSync")}</span>
              <span style={rowVal}>{azFormatDateTime(status.lastSyncAt)}</span>
            </div>
          )}
          {connected && status.lastError && (
            <div style={{ fontSize: 12, color: PC.mut, lineHeight: 1.5, marginTop: 12 }}>
              {status.lastError}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {busy ? (
              <span style={{ ...btnIdle, fontSize: 12.5, padding: "8px 13px" }}>
                <Spinner />{t("prof.calWait")}
              </span>
            ) : connected ? (
              <>
                <button type="button" onClick={resync} style={{ ...btnGhost, padding: "8px 14px" }}>
                  {t("prof.calResync")}
                </button>
                <button type="button" onClick={openDisconnect} style={{ ...btnGhost, padding: "8px 14px" }}>
                  {t("prof.calDisconnect")}
                </button>
              </>
            ) : (
              <button type="button" onClick={connect} style={{ ...btnDark, fontSize: 12.5, padding: "8px 14px" }}>
                {t("prof.calConnect")}
              </button>
            )}
          </div>
        </>
      )}

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </section>
  );
}
