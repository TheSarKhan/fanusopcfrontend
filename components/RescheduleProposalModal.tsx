"use client";

import { useEffect, useMemo, useState } from "react";
import { patientApi, type RescheduleProposal } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtFull(t: Translate, iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())} ${t(`months.m${d.getMonth() + 1}` as MessageKey)} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtRange(t: Translate, start: string, end: string) {
  const a = new Date(start), b = new Date(end);
  return `${pad2(a.getDate())} ${t(`months.m${a.getMonth() + 1}` as MessageKey)}, ${pad2(a.getHours())}:${pad2(a.getMinutes())}–${pad2(b.getHours())}:${pad2(b.getMinutes())}`;
}
function fmtRemaining(t: Translate, expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t("reschedule.expired");
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return t("reschedule.timeLeft", { h, m });
  return t("reschedule.timeLeftMinutes", { m });
}

/**
 * Dialog the patient sees when their psychologist proposed alternative slots.
 * Pick one → original cancelled, new appointment auto-confirmed.
 * Reject all → original moves to DISPUTED for operator review.
 */
export default function RescheduleProposalModal({
  proposal,
  onClose,
  onResolved,
}: {
  proposal: RescheduleProposal;
  onClose: () => void;
  onResolved: (next: RescheduleProposal) => void;
}) {
  const { t } = useT();
  const [busyOption, setBusyOption] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const expired = useMemo(
    () => new Date(proposal.expiresAt).getTime() <= now,
    [proposal.expiresAt, now]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accept = async (idx: number) => {
    setError(null); setBusyOption(idx);
    try {
      const updated = await patientApi.acceptRescheduleProposal(proposal.id, idx);
      onResolved(updated);
    } catch (e) { setError((e as Error).message); }
    finally { setBusyOption(null); }
  };

  const reject = async () => {
    if (!confirm(t("patFb.proposalRejectConfirm"))) return;
    setError(null); setRejecting(true);
    try {
      const updated = await patientApi.rejectRescheduleProposal(proposal.id);
      onResolved(updated);
    } catch (e) { setError((e as Error).message); }
    finally { setRejecting(false); }
  };

  return (
    <div className="rsc-modal-back" onClick={onClose}>
      <div className="rsc-modal" onClick={e => e.stopPropagation()}>
        <h2>{t("reschedule.pickTitle")}</h2>
        <p className="rsc-modal-sub">
          {t("patFb.proposalSub", { psy: proposal.psychologistName ?? t("pat.yourPsy") })}
        </p>

        {!expired && proposal.status === "PENDING" && (
          <span className="rsc-expires">{fmtRemaining(t, proposal.expiresAt)}</span>
        )}

        {proposal.originalStartAt && (
          <div className="rsc-modal-original">
            <strong>{t("reschedule.originalTime")}</strong> {fmtFull(t, proposal.originalStartAt)}
          </div>
        )}

        {proposal.reason && (
          <div className="rsc-modal-reason">«{proposal.reason}»</div>
        )}

        <div className="rsc-options">
          {proposal.options.map(opt => (
            <button
              key={opt.index}
              className="rsc-option"
              disabled={busyOption !== null || rejecting || expired || proposal.status !== "PENDING"}
              onClick={() => accept(opt.index)}
            >
              <span className="rsc-option-num">{opt.index + 1}</span>
              <div className="rsc-option-info">
                <div className="rsc-option-when">{fmtRange(t, opt.startAt, opt.endAt)}</div>
              </div>
              <span className="rsc-option-arrow">{busyOption === opt.index ? "…" : "→"}</span>
            </button>
          ))}
        </div>

        {error && <div className="pcli-err" style={{ marginTop: 12 }}>{error}</div>}

        <div className="rsc-modal-actions">
          <button
            type="button"
            className="rsc-btn rsc-btn--reject"
            disabled={busyOption !== null || rejecting || expired || proposal.status !== "PENDING"}
            onClick={reject}
          >
            {rejecting ? t("common.sending") : t("reschedule.rejectAll")}
          </button>
          <button type="button" className="rsc-btn rsc-btn--close" onClick={onClose}>
            {t("common.close")}
          </button>
                </div>
      </div>
    </div>
  );
}
