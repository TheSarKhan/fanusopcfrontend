"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import {
  PC, cardStyle, sideCardStyle, sectionH2, sectionSub, labelStyle, inputStyle,
  rowSplit, rowKey, rowVal, btnDark, btnGhost, btnIdle, Spinner,
} from "@/components/ProfileShell";
import ProfileShareButtons from "@/components/ProfileShareButtons";
import { TOPIC_CODES, TOPIC_AZ_LABELS, topicKey } from "@/components/TopicPicker";
import { FlagAZ, FlagRU, FlagEN, FlagTR, FlagDE, FlagFR } from "@/components/FlagIcons";
import { LANGUAGE_OPTIONS, SESSION_TYPE_OPTIONS } from "@/lib/profileOptions";
import { psychologistApi, type Psychologist, type PsyEducationItem, type PsyContactLinkItem, type PsyContactPlatform } from "@/lib/api";
import { appUrl } from "@/lib/appUrl";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { toast } from "@/components/Toast";

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M10 3.4 5 8l5 4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** Vergüllə saxlanan sahələr üçün ümumi parse (languages, sessionTypes). */
function parseCsv(s: string): string[] {
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
const LANGUAGE_FLAGS: Record<string, () => ReactElement> = {
  "Azərbaycan dili": FlagAZ,
  "Rus dili": FlagRU,
  "İngilis dili": FlagEN,
  "Türk dili": FlagTR,
  "Alman dili": FlagDE,
  "Fransız dili": FlagFR,
};

export default function PsychologPublicProfilePage() {
  const { t } = useT();
  const [me, setMe] = useState<Psychologist | null>(null);

  useEffect(() => {
    psychologistApi.me().then(setMe).catch(() => setMe(null));
  }, []);

  const minutes = me?.defaultSessionMinutes ?? 50;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Link href="/psycholog/profile" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: PC.soft, textDecoration: "none", marginBottom: 12 }}>
          <BackIcon />
          {t("prof.pubBackToAccount")}
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", margin: 0, color: PC.ink }}>
          {t("prof.pubPageTitle")}
        </h1>
        <p style={{ fontSize: 13.5, color: PC.soft, lineHeight: 1.5, margin: "6px 0 0", maxWidth: "62ch" }}>
          {t("prof.pubPageSub")}
        </p>
      </div>

      {!me ? (
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 180, height: 14, borderRadius: 4, background: "#e9edee", animation: "fanusPulse 1.4s ease-in-out infinite" }} />
          <div style={{ width: "100%", height: 11, borderRadius: 4, background: "#eef1f1", animation: "fanusPulse 1.4s ease-in-out .1s infinite" }} />
          <div style={{ width: "72%", height: 11, borderRadius: 4, background: "#eef1f1", animation: "fanusPulse 1.4s ease-in-out .2s infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: "1 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            <PublicProfileCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
            <StatsSourceCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
            <EducationsCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
            <ContactLinksCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
            <ContactVisibilityCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 86 }}>
            <PublicPreviewCard me={me} minutes={minutes} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── İctimai profil məlumatı — bio, ünvan, dillər, ixtisaslar ──────────── */

function PublicProfileCard({ me, onSaved }: { me: Psychologist; onSaved: (p: Partial<Psychologist>) => void }) {
  const { t } = useT();
  const [title, setTitle] = useState(me.title ?? "");
  const [bio, setBio] = useState(me.bio ?? "");
  const [address, setAddress] = useState(me.address ?? "");
  const [languages, setLanguages] = useState<string[]>(() => parseCsv(me.languages ?? ""));
  const [sessionTypes, setSessionTypes] = useState<string[]>(() => parseCsv(me.sessionTypes ?? ""));
  const [topics, setTopics] = useState<string[]>(me.topics ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const dirty =
    title.trim() !== (me.title ?? "") ||
    bio.trim() !== (me.bio ?? "") ||
    address.trim() !== (me.address ?? "") ||
    JSON.stringify(languages) !== JSON.stringify(parseCsv(me.languages ?? "")) ||
    JSON.stringify(sessionTypes) !== JSON.stringify(parseCsv(me.sessionTypes ?? "")) ||
    JSON.stringify(topics) !== JSON.stringify(me.topics ?? []);

  const toggleTopic = (code: string) => {
    setTopics(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      // Sıra sabit qalsın deyə TOPIC_CODES sırası ilə qaytarılır.
      return TOPIC_CODES.filter(c => next.has(c));
    });
  };

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang); else next.add(lang);
      // Sıra sabit qalsın deyə LANGUAGE_OPTIONS sırası ilə qaytarılır, sonra əlavə (custom) dillər.
      return [...LANGUAGE_OPTIONS.filter(l => next.has(l)), ...[...next].filter(l => !LANGUAGE_OPTIONS.includes(l))];
    });
  };

  const toggleSessionType = (st: string) => {
    setSessionTypes(prev => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      // Sıra sabit qalsın deyə SESSION_TYPE_OPTIONS sırası ilə qaytarılır, sonra əlavə (custom) növlər.
      return [...SESSION_TYPE_OPTIONS.filter(s => next.has(s)), ...[...next].filter(s => !SESSION_TYPE_OPTIONS.includes(s))];
    });
  };

  const save = async () => {
    if (topics.length === 0) { setErr(t("prof.pubErrSpecs")); return; }
    setErr("");
    setSaving(true);
    try {
      // İctimai kartdakı "ixtisas" pilləri mövzu seçimindən törəyir (qeydiyyatdakı
      // eyni məntiq) — ayrıca sərbəst mətn sahəsi psixoloqlar arasında uyğunsuz
      // adlandırmaya (məs. "Depresiya" vs "Depressiya") gətirərdi.
      const specializations = topics.map(c => TOPIC_AZ_LABELS[c]).filter(Boolean);
      const updated = await psychologistApi.updateFullProfile({
        title: title.trim(),
        bio: bio.trim(),
        address: address.trim(),
        languages: languages.join(", "),
        sessionTypes: sessionTypes.join(", "),
        topics,
        specializations,
      });
      onSaved({
        title: updated.title,
        bio: updated.bio,
        address: updated.address,
        languages: updated.languages,
        sessionTypes: updated.sessionTypes,
        topics: updated.topics,
        specializations: updated.specializations,
      });
      toast(t("prof.pubSavedToast"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.pubTitle")}</h2>
      <p style={sectionSub}>{t("prof.pubSub")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.pubProfTitle")}</span>
          <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder={t("prof.pubProfTitlePh")} />
        </label>

        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.pubBio")}</span>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder={t("prof.pubBioPh")}
            rows={5}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }}
          />
        </label>

        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.pubAddress")}</span>
          <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder={t("prof.pubAddressPh")} />
        </label>

        <div>
          <span style={labelStyle}>{t("prof.pubLanguages")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {[...LANGUAGE_OPTIONS, ...languages.filter(l => !LANGUAGE_OPTIONS.includes(l))].map(lang => {
              const on = languages.includes(lang);
              const Flag = LANGUAGE_FLAGS[lang];
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  aria-pressed={on}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 20,
                    border: on ? `1px solid ${PC.ink}` : `1px solid ${PC.border2}`,
                    background: on ? PC.panel : "#fff", color: on ? PC.ink : PC.soft, cursor: "pointer",
                  }}
                >
                  {Flag ? <Flag /> : null}
                  {lang}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span style={labelStyle}>{t("prof.pubSessionTypes")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {[...SESSION_TYPE_OPTIONS, ...sessionTypes.filter(s => !SESSION_TYPE_OPTIONS.includes(s))].map(st => {
              const on = sessionTypes.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleSessionType(st)}
                  aria-pressed={on}
                  style={{
                    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 20,
                    border: on ? `1px solid ${PC.ink}` : `1px solid ${PC.border2}`,
                    background: on ? PC.panel : "#fff", color: on ? PC.ink : PC.soft, cursor: "pointer",
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span style={labelStyle}>{t("prof.pubSpecs")}</span>
          <div style={{ fontSize: 12, color: PC.faint, lineHeight: 1.5, marginBottom: 8 }}>{t("prof.pubSpecsHint")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TOPIC_CODES.map(code => {
              const on = topics.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleTopic(code)}
                  aria-pressed={on}
                  style={{
                    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 20,
                    border: on ? `1px solid ${PC.ink}` : `1px solid ${PC.border2}`,
                    background: on ? PC.panel : "#fff", color: on ? PC.ink : PC.soft, cursor: "pointer",
                  }}
                >
                  {t(`topic.${topicKey(code)}` as MessageKey)}
                </button>
              );
            })}
          </div>
          {err && <div style={{ fontSize: 12, fontWeight: 500, color: "#B91C1C", marginTop: 8 }}>{err}</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${PC.hair}` }}>
        {saving ? (
          <span style={{ ...btnIdle, padding: "9px 16px" }}><Spinner />{t("prof.saving")}</span>
        ) : dirty ? (
          <button type="button" onClick={save} style={btnDark}>{t("prof.save")}</button>
        ) : null}
      </div>
    </section>
  );
}

/* ─── Statistika mənbəyi (Modul D) — kliklə seçilir və dərhal saxlanır ───── */

type StatsSource = "FANUS_PLATFORM" | "PRIOR_EXPERIENCE";

function StatsSourceCard({
  me, onSaved,
}: {
  me: Psychologist;
  onSaved: (p: Partial<Psychologist>) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<StatsSource>(me.statsSource ?? "FANUS_PLATFORM");
  const [saving, setSaving] = useState(false);

  // Əvvəlki təcrübə sayı — psixoloq özü redaktə edə bilir.
  const [priorInput, setPriorInput] = useState(String(me.priorExperienceSessions ?? 0));
  const [savingPrior, setSavingPrior] = useState(false);
  const priorDirty = priorInput.trim() !== ""
    && Number(priorInput) !== (me.priorExperienceSessions ?? 0);

  const choose = async (value: StatsSource) => {
    if (value === selected || saving) return;
    setSaving(true);
    const prev = selected;
    setSelected(value);
    try {
      const res = await psychologistApi.updateStatsSource(value);
      onSaved({
        statsSource: res.statsSource,
        fanusSessionCount: res.fanusSessionCount,
        priorExperienceSessions: res.priorExperienceSessions,
        displayedSessionCount: res.displayedSessionCount,
      });
      toast(t("prof.srcSavedToast"));
    } catch (e) {
      setSelected(prev);
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const savePrior = async () => {
    const n = parseInt(priorInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setSavingPrior(true);
    try {
      const res = await psychologistApi.updateStatsSource(selected, n);
      onSaved({
        statsSource: res.statsSource,
        fanusSessionCount: res.fanusSessionCount,
        priorExperienceSessions: res.priorExperienceSessions,
        displayedSessionCount: res.displayedSessionCount,
      });
      setPriorInput(String(res.priorExperienceSessions ?? n));
      toast(t("prof.srcPriorSavedToast"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingPrior(false);
    }
  };

  const options: { value: StatsSource; label: string; note: string; count: number }[] = [
    { value: "FANUS_PLATFORM", label: t("prof.srcFanus"), note: t("prof.srcFanusNote"), count: me.fanusSessionCount ?? 0 },
    { value: "PRIOR_EXPERIENCE", label: t("prof.srcPrior"), note: t("prof.srcPriorNote"), count: me.priorExperienceSessions ?? 0 },
  ];

  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.srcTitle")}</h2>
      <p style={{ ...sectionSub, maxWidth: "70ch" }}>{t("prof.srcSub")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 16 }}>
        {options.map(opt => {
          const active = selected === opt.value;
          const isPrior = opt.value === "PRIOR_EXPERIENCE";
          return (
            /* div + role="button" — kartın içində redaktə inputu olduğu üçün
               nested button/input qadağasına düşməmək üçün button işlədilmir. */
            <div
              key={opt.value}
              role="button"
              tabIndex={0}
              onClick={() => choose(opt.value)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(opt.value); }
              }}
              style={{
                textAlign: "left", background: "#fff",
                border: active ? `1px solid ${PC.ink}` : `1px solid ${PC.border2}`,
                borderRadius: 10, padding: "15px 16px", cursor: saving ? "default" : "pointer",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}
            >
              <span style={{ flex: "0 0 auto", marginTop: 2 }}>
                {active ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={PC.ink} strokeWidth="1.5" aria-hidden>
                    <circle cx="8" cy="8" r="6.2" />
                    <circle cx="8" cy="8" r="3" fill={PC.ink} stroke="none" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={PC.border3} strokeWidth="1.5" aria-hidden>
                    <circle cx="8" cy="8" r="6.2" />
                  </svg>
                )}
              </span>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: PC.ink }}>{opt.label}</div>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 8, color: PC.ink }}>
                  {opt.count}
                </div>
                <div style={{ fontSize: 12, color: PC.soft, lineHeight: 1.5, marginTop: 6 }}>{opt.note}</div>

                {isPrior && (
                  /* Redaktə sahəsi — klik seçimi işə salmasın deyə propagation dayandırılır. */
                  <div
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}
                    style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${PC.hair}` }}
                  >
                    <span style={labelStyle}>{t("prof.srcPriorCountLabel")}</span>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={priorInput}
                        onChange={e => setPriorInput(e.target.value.replace(/[^0-9]/g, ""))}
                        style={{ ...inputStyle, maxWidth: 120 }}
                      />
                      {savingPrior ? (
                        <span style={{ ...btnIdle, fontSize: 12.5, padding: "8px 13px" }}>
                          <Spinner />{t("prof.saving")}
                        </span>
                      ) : priorDirty ? (
                        <button type="button" onClick={savePrior} style={{ ...btnDark, fontSize: 12.5, padding: "8px 14px" }}>
                          {t("prof.save")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {active && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: PC.ink, marginTop: 8 }}>
                    {t("prof.srcSelected")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Təhsil siyahısı — hər sətrin öz diplomu (V145) ─────────────────────── */

function EducationsCard({ me, onSaved }: { me: Psychologist; onSaved: (p: Partial<Psychologist>) => void }) {
  const { t } = useT();
  const [rows, setRows] = useState<PsyEducationItem[]>(() =>
    me.educations && me.educations.length > 0
      ? me.educations.map(e => ({ ...e }))
      : [{ institution: "", degree: "", major: "", graduationYear: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const update = (i: number, k: "institution" | "degree" | "major" | "graduationYear", v: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(prev => [...prev, { institution: "", degree: "", major: "", graduationYear: "" }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const uploadDiploma = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const url = await psychologistApi.uploadFile(file);
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, diplomaUrl: url } : r));
    } catch (e) {
      toast((e as Error).message || t("prof.eduErrDiploma"), "error");
    } finally {
      setUploadingIdx(null);
    }
  };

  const save = async () => {
    const clean = rows.filter(r => r.institution.trim());
    if (clean.length === 0) { toast(t("prof.eduErrMin"), "error"); return; }
    setSaving(true);
    try {
      const updated = await psychologistApi.updateFullProfile({ educations: clean });
      onSaved({ educations: updated.educations });
      setRows(updated.educations.length > 0 ? updated.educations.map(e => ({ ...e })) : clean);
      toast(t("prof.eduSavedToast"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.eduTitle")}</h2>
      <p style={sectionSub}>{t("prof.eduSub")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ border: `1px solid ${PC.border2}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 12.5, color: PC.ink }}>{t("prof.eduRowLabel", { n: i + 1 })}</strong>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)}
                  style={{ fontSize: 12, color: "#B91C1C", background: "none", border: "none", cursor: "pointer" }}>
                  {t("prof.eduDelete")}
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={labelStyle}>{t("prof.eduInstitutionLabel")}</label>
                <input style={inputStyle} value={r.institution}
                  onChange={e => update(i, "institution", e.target.value)}
                  placeholder={t("prof.eduInstitutionPh")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
                <div>
                  <label style={labelStyle}>{t("prof.eduDegreeLabel")}</label>
                  <input style={inputStyle} value={r.degree ?? ""}
                    onChange={e => update(i, "degree", e.target.value)}
                    placeholder={t("prof.eduDegreePh")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("prof.eduYearLabel")}</label>
                  <input style={inputStyle} value={r.graduationYear ?? ""}
                    onChange={e => update(i, "graduationYear", e.target.value)}
                    placeholder={t("prof.eduYearPh")} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t("prof.eduMajorLabel")}</label>
                <input style={inputStyle} value={r.major ?? ""}
                  onChange={e => update(i, "major", e.target.value)}
                  placeholder={t("prof.eduMajorPh")} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                <label style={{ ...btnGhost, cursor: "pointer" }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDiploma(i, f); e.target.value = ""; }} />
                  {uploadingIdx === i ? t("prof.eduDiplomaUploading") : r.diplomaUrl ? t("prof.eduDiplomaChange") : t("prof.eduDiplomaUpload")}
                </label>
                {r.diplomaUrl && (
                  <a href={r.diplomaUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--brand, #1051B7)" }}>
                    {t("prof.eduDiplomaView")}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button type="button" onClick={addRow} style={btnGhost}>{t("prof.eduAdd")}</button>
        <button type="button" onClick={save} disabled={saving} style={{ ...btnDark, marginLeft: "auto" }}>
          {saving ? t("prof.eduSaving") : t("prof.eduSave")}
        </button>
      </div>
    </section>
  );
}

const CONTACT_PLATFORMS: PsyContactPlatform[] = [
  "FACEBOOK", "INSTAGRAM", "LINKEDIN", "WHATSAPP", "YOUTUBE", "TIKTOK", "WEBSITE", "OTHER",
];

function ContactLinksCard({ me, onSaved }: { me: Psychologist; onSaved: (p: Partial<Psychologist>) => void }) {
  const { t } = useT();
  const platformLabel = (p: PsyContactPlatform) => t(`prof.clPlatform${p.charAt(0)}${p.slice(1).toLowerCase()}` as MessageKey);
  const [rows, setRows] = useState<PsyContactLinkItem[]>(() =>
    me.contactLinks && me.contactLinks.length > 0
      ? me.contactLinks.map(c => ({ ...c, visible: c.visible ?? true }))
      : [{ platform: "FACEBOOK", url: "", visible: true }]
  );
  const [saving, setSaving] = useState(false);

  const update = (i: number, k: "platform" | "url", v: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const toggleVisible = (i: number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, visible: !(r.visible ?? true) } : r));
  const addRow = () => setRows(prev => [...prev, { platform: "FACEBOOK", url: "", visible: true }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    const clean = rows.filter(r => r.url.trim()).map(r => ({ ...r, visible: r.visible ?? true }));
    setSaving(true);
    try {
      const updated = await psychologistApi.updateFullProfile({ contactLinks: clean });
      onSaved({ contactLinks: updated.contactLinks });
      setRows(updated.contactLinks.length > 0
        ? updated.contactLinks.map(c => ({ ...c, visible: c.visible ?? true }))
        : [{ platform: "FACEBOOK", url: "", visible: true }]);
      toast(t("prof.clSavedToast"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.clTitle")}</h2>
      <p style={sectionSub}>{t("prof.clSub")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ border: `1px solid ${PC.border2}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 12.5, color: PC.ink }}>{t("prof.clRowLabel", { n: i + 1 })}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: PC.soft, cursor: "pointer" }}>
                  <input type="checkbox" checked={r.visible ?? true} onChange={() => toggleVisible(i)} />
                  {t("prof.clVisible")}
                </label>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)}
                    style={{ fontSize: 12, color: "#B91C1C", background: "none", border: "none", cursor: "pointer" }}>
                    {t("prof.clDelete")}
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>{t("prof.clPlatformLabel")}</label>
                <select style={inputStyle} value={r.platform}
                  onChange={e => update(i, "platform", e.target.value)}>
                  {CONTACT_PLATFORMS.map(p => <option key={p} value={p}>{platformLabel(p)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("prof.clUrlLabel")}</label>
                <input style={inputStyle} value={r.url}
                  onChange={e => update(i, "url", e.target.value)}
                  placeholder={t("prof.clUrlPh")} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button type="button" onClick={addRow} style={btnGhost}>{t("prof.clAdd")}</button>
        <button type="button" onClick={save} disabled={saving} style={{ ...btnDark, marginLeft: "auto" }}>
          {saving ? t("prof.clSaving") : t("prof.clSave")}
        </button>
      </div>
    </section>
  );
}

/* ─── Ünvan/telefonun ictimai profildə görünüşü (V152) — seçim dərhal saxlanır ── */

function ContactVisibilityCard({ me, onSaved }: { me: Psychologist; onSaved: (p: Partial<Psychologist>) => void }) {
  const { t } = useT();
  const [showAddress, setShowAddress] = useState(me.showAddress ?? true);
  const [showPhone, setShowPhone] = useState(me.showPhone ?? false);
  const [savingKey, setSavingKey] = useState<"showAddress" | "showPhone" | null>(null);

  const toggle = async (key: "showAddress" | "showPhone", value: boolean) => {
    const setLocal = key === "showAddress" ? setShowAddress : setShowPhone;
    const prev = !value;
    setLocal(value);
    setSavingKey(key);
    try {
      const updated = await psychologistApi.updateFullProfile(
        key === "showAddress" ? { showAddress: value } : { showPhone: value }
      );
      onSaved({ showAddress: updated.showAddress, showPhone: updated.showPhone });
      toast(t("prof.cvSavedToast"));
    } catch (e) {
      setLocal(prev);
      toast((e as Error).message, "error");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.cvTitle")}</h2>
      <p style={sectionSub}>{t("prof.cvSub")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: PC.ink, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showAddress}
            disabled={savingKey === "showAddress"}
            onChange={e => toggle("showAddress", e.target.checked)}
          />
          {t("prof.cvShowAddress")}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: PC.ink, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showPhone}
            disabled={savingKey === "showPhone"}
            onChange={e => toggle("showPhone", e.target.checked)}
          />
          {t("prof.cvShowPhone")}
        </label>
      </div>
    </section>
  );
}

/* ─── İctimai profil önizləməsi (yan sütun) ──────────────────────────────── */

function PublicPreviewCard({ me, minutes }: { me: Psychologist; minutes: number }) {
  const { t } = useT();
  return (
    <section style={sideCardStyle}>
      <h2 style={sectionH2}>{t("prof.pvTitle")}</h2>
      <p style={sectionSub}>{t("prof.pvSub")}</p>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginTop: 16,
        paddingTop: 14, borderTop: `1px solid ${PC.hair}`,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", border: `1px solid ${PC.border}`,
          background: PC.bg, overflow: "hidden", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 14, fontWeight: 600, color: PC.mut, flex: "0 0 auto",
        }}>
          {me.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.photoUrl} alt={me.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span>{initialsOf(me.name)}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: PC.ink }}>{me.name}</div>
          <div style={{ fontSize: 12, color: PC.soft, marginTop: 2 }}>{me.title}</div>
        </div>
      </div>
      {me.slug && (
        <div style={{ marginTop: 14 }}>
          <ProfileShareButtons url={appUrl(`/psychologists/${me.slug}`)} name={me.name} />
        </div>
      )}
      <div style={{ ...rowSplit, alignItems: "flex-start", marginTop: 14 }}>
        <span style={{ ...rowKey, flex: "0 0 auto" }}>{t("prof.pvSpecs")}</span>
        <span style={{ ...rowVal, textAlign: "right" }}>
          {me.specializations?.slice(0, 4).join(", ") || "—"}
        </span>
      </div>
      <div style={{ ...rowSplit, alignItems: "flex-start" }}>
        <span style={rowKey}>{t("prof.pvLangs")}</span>
        <span style={{ ...rowVal, textAlign: "right" }}>{me.languages || "—"}</span>
      </div>
      <div style={rowSplit}>
        <span style={rowKey}>{t("prof.pvExp")}</span>
        <span style={rowVal}>{me.experience || "—"}</span>
      </div>
      <div style={rowSplit}>
        <span style={rowKey}>{t("prof.pvDuration")}</span>
        <span style={rowVal}>{t("prof.pvMinutes", { n: minutes })}</span>
      </div>
      <div style={{ ...rowSplit, padding: "11px 0 0" }}>
        <span style={rowKey}>{t("prof.pvShownCount")}</span>
        <span style={rowVal}>{t("prof.pvSessions", { n: me.displayedSessionCount ?? 0 })}</span>
      </div>
      <div style={{
        fontSize: 11.5, color: PC.faint, lineHeight: 1.55, marginTop: 14,
        paddingTop: 13, borderTop: `1px solid ${PC.hair}`,
      }}>
        {t("prof.pvAdminNote")}
      </div>
    </section>
  );
}
