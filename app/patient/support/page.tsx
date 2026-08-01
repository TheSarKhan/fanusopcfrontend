"use client";

import { useEffect, useState } from "react";
import {
  patientApi,
  type CrisisHotline,
  type CrisisStatus,
  type CrisisCheckIn,
  type CrisisContactPsy,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const MOOD_KEYS: MessageKey[] = [
  "patSupport.mood1", // 1
  "patSupport.mood2",
  "patSupport.mood3",
  "patSupport.mood4",
  "patSupport.mood5", // 5
];

function whatsappLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/^\+/, "").replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function fmtRelative(t: Translate, iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return t("patSupport.relNow");
  if (min < 60) return t("patSupport.relMin", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("patSupport.relHour", { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t("patSupport.relDay", { n: d });
  return t("patSupport.relMonth", { n: Math.floor(d / 30) });
}

export default function PatientSupportPage() {
  const { t } = useT();
  const [status, setStatus] = useState<CrisisStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Check-in form
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    patientApi.crisisStatus()
      .then(setStatus)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const submitCheckIn = async () => {
    if (mood == null) return;
    setSubmitting(true);
    try {
      const saved = await patientApi.crisisCheckIn({
        moodScore: mood,
        note: note.trim() || null,
      });
      setStatus(prev => prev ? { ...prev, recentCheckIns: [saved, ...prev.recentCheckIns].slice(0, 10) } : prev);
      setThanks(true);
      setMood(null);
      setNote("");
      setTimeout(() => setThanks(false), 4000);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="psupport">
      <PageHeader title={t("patSupport.title")} subtitle={t("patSupport.sub")} />

      {loading ? (
        <div className="psupport__loading">{t("common.loading")}</div>
      ) : !status ? (
        <div className="psupport__error">{err ?? t("common.error")}</div>
      ) : (
        <>
          {/* Crisis CTA — most prominent for risk-flagged patients */}
          {(status.riskLevel === "HIGH" || status.riskLevel === "CRITICAL") && (
            <div className="psupport__crisis">
              <div className="psupport__crisis-icon" aria-hidden>
                <IconAlert />
              </div>
              <div className="psupport__crisis-body">
                <div className="psupport__crisis-title">{t("patSupport.crisisTitle")}</div>
                <p>{t("patSupport.crisisBody")}</p>
              </div>
            </div>
          )}

          {/* Quick contacts: psychologist + operator team */}
          <section className="psupport__section">
            <h2>{t("patSupport.contactsTitle")}</h2>
            <div className="psupport__contacts">
              {status.myPsychologist && (
                <ContactCard label={t("pat.yourPsy")} psy={status.myPsychologist} accent="brand" />
              )}
              <ContactCard label={t("patSupport.supportTeam")} psy={status.supportOperator} accent="neutral" />
            </div>
          </section>

          {/* Hotlines */}
          <section className="psupport__section">
            <h2>{t("patSupport.hotlinesTitle")}</h2>
            <div className="psupport__hotlines">
              {status.hotlines.map(h => <HotlineCard key={h.phone} h={h} />)}
            </div>
          </section>

          {/* Mood check-in */}
          <section className="psupport__section">
            <h2>{t("patSupport.checkInTitle")}</h2>
            <p className="psupport__sub">
              {t("patSupport.checkInSub")}
            </p>
            <div className="psupport__checkin">
              <div className="psupport__mood-row">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button"
                    className={`psupport__mood${mood === n ? " is-active" : ""}`}
                    onClick={() => setMood(n)}
                    data-tone={n <= 2 ? "low" : n === 3 ? "mid" : "good"}>
                    <span className="psupport__mood-num">{n}</span>
                    <span className="psupport__mood-label">{t(MOOD_KEYS[n - 1])}</span>
                  </button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                rows={3} maxLength={2000}
                placeholder={t("patSupport.notePh")}
                className="psupport__note" />
              {thanks && (
                <div className="psupport__thanks">{t("patSupport.thanks")}</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={submitCheckIn} disabled={mood == null || submitting}
                  className="psupport__submit">
                  {submitting ? t("common.sending") : t("common.submit")}
                </button>
              </div>
            </div>
          </section>

          {/* History */}
          {status.recentCheckIns.length > 0 && (
            <section className="psupport__section">
              <h2>{t("patSupport.historyTitle")}</h2>
              <div className="psupport__history">
                {status.recentCheckIns.map(c => <HistoryRow key={c.id} c={c} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ContactCard({ label, psy, accent }: { label: string; psy: CrisisContactPsy; accent: "brand" | "neutral" }) {
  const wa = whatsappLink(psy.whatsapp ?? psy.phone);
  return (
    <div className={`psupport__contact psupport__contact--${accent}`}>
      <div className="psupport__contact-label">{label}</div>
      <div className="psupport__contact-name">{psy.name}</div>
      <div className="psupport__contact-actions">
        {psy.phone && (
          <a href={`tel:${psy.phone}`} className="psupport__contact-btn psupport__contact-btn--call">
            <IconPhone /> {psy.phone}
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="psupport__contact-btn psupport__contact-btn--wa">
            <IconWhatsApp /> WhatsApp
          </a>
        )}
        {psy.email && (
          <a href={`mailto:${psy.email}`} className="psupport__contact-btn psupport__contact-btn--mail">
            <IconMail /> Email
          </a>
        )}
      </div>
    </div>
  );
}

function HotlineCard({ h }: { h: CrisisHotline }) {
  const { t } = useT();
  return (
    <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="psupport__hotline">
      <div className="psupport__hotline-icon" data-always={h.alwaysOpen}>
        <IconPhone />
      </div>
      <div className="psupport__hotline-body">
        <div className="psupport__hotline-name">{h.name}</div>
        <div className="psupport__hotline-phone">{h.phone}</div>
        <div className="psupport__hotline-desc">{h.description}</div>
        <div className="psupport__hotline-hours">
          {h.alwaysOpen
            ? <span className="psupport__hotline-247">{t("patSupport.alwaysOpen")}</span>
            : <span>{h.hours}</span>}
        </div>
      </div>
    </a>
  );
}

function HistoryRow({ c }: { c: CrisisCheckIn }) {
  const { t } = useT();
  const tone = c.moodScore <= 2 ? "low" : c.moodScore === 3 ? "mid" : "good";
  return (
    <div className="psupport__hist" data-tone={tone}>
      <div className="psupport__hist-mood">{c.moodScore}/5</div>
      <div className="psupport__hist-body">
        <div className="psupport__hist-label">{t(MOOD_KEYS[c.moodScore - 1])}</div>
        {c.note && <div className="psupport__hist-note">«{c.note}»</div>}
        <div className="psupport__hist-time">{fmtRelative(t, c.createdAt)}</div>
      </div>
    </div>
  );
}

/* ─── Icons ────────────────────────────────────────────────────────────── */

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}
function IconWhatsApp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.3-.7.1-2-.7-3.3-2.3-3.7-2.7-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.1-1.3 0-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.7.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
