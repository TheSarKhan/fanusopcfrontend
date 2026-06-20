"use client";

import { useEffect, useState } from "react";

interface ConfirmReq {
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let seq = 0;
let current: ConfirmReq | null = null;
const listeners = new Set<(r: ConfirmReq | null) => void>();
function emit() { listeners.forEach(l => l(current)); }

/** Branded replacement for window.confirm(). Returns a Promise<boolean>. */
export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise(resolve => {
    current = {
      id: ++seq,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? "Təsdiqlə",
      cancelLabel: opts.cancelLabel ?? "Ləğv",
      danger: !!opts.danger,
      resolve,
    };
    emit();
  });
}

/** Mount once near the app root. */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(current);
  useEffect(() => {
    listeners.add(setReq);
    return () => { listeners.delete(setReq); };
  }, []);

  if (!req) return null;
  const close = (ok: boolean) => { req.resolve(ok); current = null; emit(); };

  return (
    <div className="ui-confirm__overlay" role="presentation" onClick={() => close(false)}>
      <div className="ui-confirm" role="dialog" aria-modal="true" aria-label={req.title}
        onClick={e => e.stopPropagation()}>
        <div className="ui-confirm__title">{req.title}</div>
        {req.message && <p className="ui-confirm__msg">{req.message}</p>}
        <div className="ui-confirm__actions">
          <button type="button" className="ui-confirm__btn ui-confirm__btn--ghost" onClick={() => close(false)}>
            {req.cancelLabel}
          </button>
          <button type="button"
            className={`ui-confirm__btn ${req.danger ? "ui-confirm__btn--danger" : "ui-confirm__btn--primary"}`}
            onClick={() => close(true)} autoFocus>
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
