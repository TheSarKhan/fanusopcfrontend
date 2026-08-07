"use client";

/**
 * Psixoloq profilinin (public + panel) paylaşım düymələri: "Paylaş" linki
 * göstərən popup açır, ayrıca QR ikon-düymə isə skan edilə bilən QR kod
 * modalını açır (PNG kimi yükləmə daxil).
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useT } from "@/lib/i18n/LocaleProvider";

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9" />
    </svg>
  );
}
function QrIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
    </svg>
  );
}

export default function ProfileShareButtons({ url, name }: { url: string; name: string }) {
  const { t } = useT();
  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const onClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [shareOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked/unsupported — the read-only input still lets the user select + copy manually
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: name, url });
      setShareOpen(false);
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  };

  return (
    <>
      <div className="psb-wrap" ref={shareRef}>
        <button type="button" className="psb-btn" onClick={() => setShareOpen((o) => !o)}>
          <ShareIcon /> <span>{t("shareProfile.share")}</span>
        </button>
        <button type="button" className="psb-btn psb-btn--icon" onClick={() => setQrOpen(true)} aria-label={t("shareProfile.qr")} title={t("shareProfile.qr")}>
          <QrIcon />
        </button>

        {shareOpen && (
          <div className="psb-pop">
            <div className="psb-pop__row">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="psb-pop__input" />
              <button type="button" onClick={copy} className="psb-pop__copy">
                {copied ? t("shareProfile.copied") : t("shareProfile.copy")}
              </button>
            </div>
            {canNativeShare && (
              <button type="button" className="psb-pop__native" onClick={nativeShare}>{t("shareProfile.shareVia")}</button>
            )}
          </div>
        )}
      </div>

      {qrOpen && <QrModal url={url} onClose={() => setQrOpen(false)} />}

      <style>{`
        .psb-wrap { position: relative; display: inline-flex; gap: 8px; }
        .psb-btn {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
          color: var(--brand, #1051B7); background: #fff;
          border: 1px solid var(--fanus-line, #D6E2F7); border-radius: 9px;
          padding: 9px 14px;
          transition: border-color .15s, background .15s;
        }
        .psb-btn:hover { background: var(--brand-50, #EEF3FC); border-color: var(--brand, #1051B7); }
        .psb-btn--icon { padding: 9px; }
        .psb-pop {
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 40;
          width: min(320px, 84vw); background: #fff;
          border: 1px solid var(--fanus-line, #D6E2F7); border-radius: 14px;
          box-shadow: 0 18px 40px rgba(10,26,51,.16); padding: 12px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .psb-pop__row { display: flex; gap: 6px; }
        .psb-pop__input {
          flex: 1; min-width: 0; font-size: 12.5px; color: #374151;
          border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px;
          background: #F8FAFD; outline: none;
        }
        .psb-pop__copy {
          flex: none; font-size: 12.5px; font-weight: 600; cursor: pointer;
          color: #fff; background: var(--brand, #1051B7); border: none;
          border-radius: 8px; padding: 0 13px;
        }
        .psb-pop__native {
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          color: var(--brand, #1051B7); background: var(--brand-50, #EEF3FC);
          border: 1px solid var(--brand-100, #D6E2F7); border-radius: 8px; padding: 8px 10px;
        }
      `}</style>
    </>
  );
}

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!canvasRef.current) return;
    setReady(false);
    QRCode.toCanvas(canvasRef.current, url, {
      width: 260, margin: 2, color: { dark: "#0B1A35", light: "#FFFFFF" },
    }).then(() => setReady(true)).catch(() => {});
  }, [url]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qr-kod.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="psb-qr-back" onClick={onClose}>
      <div className="psb-qr-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="psb-qr-close" onClick={onClose} aria-label={t("common.close")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h3 className="psb-qr-title">{t("shareProfile.qrTitle")}</h3>
        <p className="psb-qr-sub">{t("shareProfile.qrSub")}</p>
        <div className="psb-qr-canvas-wrap">
          <canvas ref={canvasRef} width={260} height={260} />
        </div>
        <button type="button" className="psb-qr-download" onClick={download} disabled={!ready}>
          {t("shareProfile.download")}
        </button>
      </div>

      <style>{`
        .psb-qr-back {
          position: fixed; inset: 0; background: rgba(15,28,46,0.65); z-index: 200;
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .psb-qr-modal {
          position: relative; background: #fff; border-radius: 18px; padding: 26px;
          width: min(360px, 100%); box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
        }
        .psb-qr-close {
          position: absolute; top: 14px; right: 14px; width: 30px; height: 30px;
          display: inline-flex; align-items: center; justify-content: center;
          color: #6B7280; background: #F3F4F6; border: none; border-radius: 8px; cursor: pointer;
        }
        .psb-qr-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #1A2535; }
        .psb-qr-sub { margin: 0 0 16px; font-size: 12.5px; color: #6B7280; }
        .psb-qr-canvas-wrap {
          display: inline-flex; padding: 14px; background: #fff;
          border: 1px solid #EDF1F8; border-radius: 14px; margin: 0 auto;
        }
        .psb-qr-canvas-wrap canvas { display: block; width: 220px; height: 220px; }
        .psb-qr-download {
          margin-top: 18px; width: 100%; padding: 11px 0; font-size: 13.5px; font-weight: 600;
          color: #fff; background: var(--brand, #1051B7); border: none; border-radius: 10px; cursor: pointer;
        }
        .psb-qr-download:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
