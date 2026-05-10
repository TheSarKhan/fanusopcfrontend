"use client";

import { useEffect, useMemo, useState } from "react";
import { patientApi, type RescheduleProposal } from "@/lib/api";

const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtFull(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtRange(start: string, end: string) {
  const a = new Date(start), b = new Date(end);
  return `${pad2(a.getDate())} ${MONTHS_AZ[a.getMonth()]} · ${pad2(a.getHours())}:${pad2(a.getMinutes())}–${pad2(b.getHours())}:${pad2(b.getMinutes())}`;
}
function fmtRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "vaxt bitib";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h} saat ${m} dəq qaldı`;
  return `${m} dəq qaldı`;
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
  const [busyOption, setBusyOption] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = useMemo(
    () => new Date(proposal.expiresAt).getTime() <= Date.now(),
    [proposal.expiresAt]
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
    if (!confirm("Heç bir saat sizə uyğun deyil? Operator komandası sizinlə əlaqə saxlayacaq.")) return;
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
        <h2>Yenidən planlaşdırma təklifi</h2>
        <p className="rsc-modal-sub">
          {proposal.psychologistName ?? "Psixoloqunuz"} sizə yeni saat alternativləri təklif edir.
          Birini seçin — köhnə randevu avtomatik ləğv olunacaq və yeni randevu təsdiq olunmuş şəkildə yaradılacaq.
        </p>

        {!expired && proposal.status === "PENDING" && (
          <span className="rsc-expires">⏱ {fmtRemaining(proposal.expiresAt)}</span>
        )}

        {proposal.originalStartAt && (
          <div className="rsc-modal-original">
            <strong>Köhnə vaxt:</strong> {fmtFull(proposal.originalStartAt)}
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
                <div className="rsc-option-when">{fmtRange(opt.startAt, opt.endAt)}</div>
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
            {rejecting ? "Göndərilir…" : "Heç biri uyğun deyil"}
          </button>
          <button type="button" className="rsc-btn rsc-btn--close" onClick={onClose}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}
