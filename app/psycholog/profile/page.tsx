"use client";

import { useEffect, useState } from "react";
import ProfileShell, {
  PC, cardStyle, sideCardStyle, sectionH2, sectionSub, labelStyle, inputStyle,
  rowSplit, rowKey, rowVal, btnDark, btnGhost, btnIdle,
  ModalScrim, modalBoxStyle, ConfirmDialog, type ConfirmSpec,
  Spinner, IconTrash,
} from "@/components/ProfileShell";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
import PsyPlanCard from "@/components/PsyPlanCard";
import ProfileShareButtons from "@/components/ProfileShareButtons";
import { psychologistApi, type Psychologist, type PackageDto, type PackageReq, type PsyEducationItem } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { appUrl } from "@/lib/appUrl";
import { useT } from "@/lib/i18n/LocaleProvider";
import { toast } from "@/components/Toast";

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.6" />
      <path d="M2.4 6.6h11.2M5.6 2.4v2M10.4 2.4v2" strokeLinecap="round" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 5.2V8l2 1.6" strokeLinecap="round" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="5.8" r="2.4" />
      <path d="M3.4 13.2c.5-2.3 2.4-3.5 4.6-3.5s4.1 1.2 4.6 3.5" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.1 12.8h3.8M4.4 12.8V7.4a3.6 3.6 0 0 1 7.2 0v5.4M3.2 12.8h9.6" strokeLinecap="round" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M10.6 3.4l2 2-6.4 6.4-2.6.6.6-2.6 6.4-6.4Z" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M8 3.6v8.8M3.6 8h8.8" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3.6" y="7" width="8.8" height="6" rx="1.4" />
      <path d="M5.8 7V5.4a2.2 2.2 0 0 1 4.4 0V7" strokeLinecap="round" />
    </svg>
  );
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function PsychologProfilePage() {
  const { t } = useT();
  const [me, setMe] = useState<Psychologist | null>(null);

  useEffect(() => {
    psychologistApi.me().then(setMe).catch(() => setMe(null));
  }, []);

  const editable = me?.psychologistType === "NORMAL";
  const minutes = me?.defaultSessionMinutes ?? 50;

  return (
    <ProfileShell
      title={t("prof.psyTitle")}
      subtitle={t("prof.psySub")}
      extras={
        me ? (
          <>
            {/* Plan ən üstdə: sidebar-dakı nişandan bura gəlinir, cavab dərhal
                görünməlidir — «bu nişan nədir, nə vaxta qədərdir». */}
            <PsyPlanCard />
            <PricingCard editable={editable} minutes={minutes} />
            <StatsSourceCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
            <EducationsCard me={me} onSaved={p => setMe(prev => prev ? { ...prev, ...p } : prev)} />
          </>
        ) : undefined
      }
      statusRows={
        me ? [{
          label: t("prof.accType"),
          value: editable ? t("prof.accTypeNormal") : t("prof.accTypeManaged"),
        }] : undefined
      }
      quickLinks={[
        ...(me?.slug ? [{
          href: `/psychologists/${me.slug}`,
          label: t("prof.qlPublicProfile"),
          icon: <PersonIcon />,
          external: true,
        }] : []),
        { href: "/psycholog/availability", label: t("prof.qlAvailability"), icon: <ClockIcon /> },
        { href: "/psycholog/calendar", label: t("prof.qlCalendar"), icon: <CalendarIcon /> },
        { href: "/psycholog/notifications", label: t("prof.qlNotifications"), icon: <BellIcon /> },
      ]}
      sideBottom={
        me ? (
          <>
            <GoogleCalendarCard />
            <PublicPreviewCard me={me} minutes={minutes} />
          </>
        ) : undefined
      }
    />
  );
}

/* ─── Qiymətləndirmə (Modul A/C) — fərdi qiymət + paketlər ───────────────── */

function PricingCard({ editable, minutes }: { editable: boolean; minutes: number }) {
  const { t } = useT();

  const [loading, setLoading] = useState(true);
  const [priceInput, setPriceInput] = useState("");
  const [savedPrice, setSavedPrice] = useState<number | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);

  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);

  // Paket modalı
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgId, setPkgId] = useState<number | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgCount, setPkgCount] = useState("");
  const [pkgTotal, setPkgTotal] = useState("");
  const [pkgErr, setPkgErr] = useState("");
  const [pkgSaving, setPkgSaving] = useState(false);

  const loadPackages = () =>
    psychologistApi.myPackages().then(setPackages).catch(() => setPackages([]));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      psychologistApi.myPricing().catch(() => ({ individualPrice: null as number | null, currency: "AZN" })),
      psychologistApi.myPackages().catch(() => [] as PackageDto[]),
    ]).then(([pricing, pkgs]) => {
      setSavedPrice(pricing.individualPrice);
      setPriceInput(pricing.individualPrice != null ? String(pricing.individualPrice) : "");
      setPackages(pkgs);
    }).finally(() => setLoading(false));
  }, []);

  const priceDirty = priceInput.trim() !== "" && Number(priceInput) !== (savedPrice ?? Number.NaN);

  const savePrice = async () => {
    const val = Number(priceInput);
    if (!Number.isFinite(val) || val <= 0) { toast(t("prof.priceErr"), "error"); return; }
    setSavingPrice(true);
    try {
      const res = await psychologistApi.updateMyPricing(val);
      setSavedPrice(res.individualPrice);
      setPriceInput(res.individualPrice != null ? String(res.individualPrice) : "");
      toast(t("prof.priceSavedToast"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingPrice(false);
    }
  };

  const openNewPkg = () => {
    setPkgId(null); setPkgName(""); setPkgCount(""); setPkgTotal(""); setPkgErr("");
    setPkgOpen(true);
  };
  const openEditPkg = (p: PackageDto) => {
    setPkgId(p.id); setPkgName(p.name); setPkgCount(String(p.sessionCount));
    setPkgTotal(String(p.packagePrice)); setPkgErr("");
    setPkgOpen(true);
  };

  const savePkg = async () => {
    const count = parseInt(pkgCount, 10);
    const total = Number(pkgTotal);
    if (!pkgName.trim()) { setPkgErr(t("prof.pkgErrName")); return; }
    if (!Number.isFinite(count) || count < 1) { setPkgErr(t("prof.pkgErrCount")); return; }
    if (!Number.isFinite(total) || total <= 0) { setPkgErr(t("prof.pkgErrPrice")); return; }
    setPkgSaving(true);
    try {
      const req: PackageReq = { name: pkgName.trim(), sessionCount: count, packagePrice: total };
      if (pkgId == null) {
        await psychologistApi.createMyPackage(req);
        toast(t("prof.pkgSavedToast"));
      } else {
        await psychologistApi.updateMyPackage(pkgId, req);
        toast(t("prof.pkgUpdatedToast"));
      }
      await loadPackages();
      setPkgOpen(false);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPkgSaving(false);
    }
  };

  const openDeletePkg = (p: PackageDto) => setConfirmSpec({
    title: t("prof.pkgDeleteTitle"),
    body: t("prof.pkgDeleteBody", { name: p.name }),
    label: t("prof.pkgDeleteLabel"),
    run: async () => {
      try {
        await psychologistApi.deleteMyPackage(p.id);
        setPackages(prev => prev.filter(x => x.id !== p.id));
        toast(t("prof.pkgDeletedToast"));
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
  });

  const pkgPerPreview = (() => {
    const c = parseInt(pkgCount, 10);
    const v = Number(pkgTotal);
    if (!Number.isFinite(c) || c < 1 || !Number.isFinite(v) || v <= 0) return "—";
    return formatAzn(v / c);
  })();

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={sectionH2}>{t("prof.priceTitle")}</h2>
          <p style={sectionSub}>{t("prof.priceSub")}</p>
        </div>
        {!editable && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12,
            fontWeight: 500, color: PC.mut, border: `1px solid ${PC.border}`,
            borderRadius: 8, padding: "6px 10px",
          }}>
            <LockIcon />
            {t("prof.readonly")}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12.5, color: PC.faint, marginTop: 18 }}>{t("prof.loadingNote")}</div>
      ) : !editable ? (
        /* ── Yalnız oxunan rejim — qiymətləri admin idarə edir ── */
        <>
          <div style={{
            border: `1px solid ${PC.border}`, borderRadius: 10, background: PC.panel,
            padding: "14px 16px", marginTop: 16, fontSize: 12.5, color: PC.mut, lineHeight: 1.55,
          }}>
            {t("prof.priceLockedNote")}
          </div>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16,
            marginTop: 18, paddingBottom: 14, borderBottom: `1px solid ${PC.hair}`,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: PC.soft }}>{t("prof.priceIndividual")}</div>
              <div style={{ fontSize: 12, color: PC.faint, marginTop: 3 }}>{t("prof.priceDurationNote", { n: minutes })}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: PC.ink }}>
              {savedPrice != null ? formatAzn(savedPrice) : "—"}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: PC.soft, margin: "16px 0 10px" }}>{t("prof.pkgsTitle")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            {packages.map(p => (
              <div key={p.id} style={{ border: `1px solid ${PC.border}`, borderRadius: 10, padding: "14px 15px", background: PC.panel }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: PC.ink }}>{p.name}</div>
                <div style={{ fontSize: 12, color: PC.faint, marginTop: 3 }}>{t("prof.pkgSessions", { n: p.sessionCount })}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: PC.ink }}>{formatAzn(p.packagePrice)}</span>
                </div>
                <div style={{ fontSize: 12, color: PC.soft, marginTop: 4 }}>{t("prof.pkgPer", { price: formatAzn(p.perSessionPrice) })}</div>
              </div>
            ))}
            {packages.length === 0 && (
              <div style={{
                border: `1px dashed ${PC.border2}`, borderRadius: 10, padding: "18px 15px",
                fontSize: 12.5, color: PC.faint, lineHeight: 1.5,
              }}>
                {t("prof.pkgsEmpty")}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Redaktə rejimi — NORMAL tip psixoloq ── */
        <>
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16,
            marginTop: 18, paddingBottom: 18, borderBottom: `1px solid ${PC.hair}`,
          }}>
            <label style={{ display: "block", flex: "0 0 200px" }}>
              <span style={labelStyle}>{t("prof.priceIndividualInput")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                style={inputStyle}
              />
            </label>
            <div style={{ fontSize: 12, color: PC.faint, lineHeight: 1.5, flex: "1 1 200px", paddingBottom: 10 }}>
              {t("prof.priceHint", { n: minutes })}
            </div>
            {savingPrice ? (
              <span style={{ ...btnIdle, marginBottom: 1 }}><Spinner />{t("prof.saving")}</span>
            ) : priceDirty ? (
              <button type="button" onClick={savePrice} style={{ ...btnDark, marginBottom: 1 }}>
                {t("prof.priceSave")}
              </button>
            ) : null}
          </div>

          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
            gap: 12, margin: "18px 0 10px",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: PC.ink }}>{t("prof.pkgsTitle")}</div>
              <div style={{ fontSize: 12, color: PC.faint, marginTop: 3 }}>{t("prof.pkgsSub")}</div>
            </div>
            <button type="button" onClick={openNewPkg} style={{ ...btnGhost, padding: "7px 12px" }}>
              <PlusIcon />
              {t("prof.pkgAdd")}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {packages.map(p => (
              <div key={p.id} style={{
                border: `1px solid ${PC.border}`, borderRadius: 10, padding: "14px 15px",
                background: "#fff", display: "flex", flexDirection: "column", gap: 3,
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: PC.ink }}>{p.name}</div>
                <div style={{ fontSize: 12, color: PC.faint }}>{t("prof.pkgSessions", { n: p.sessionCount })}</div>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 10, color: PC.ink }}>
                  {formatAzn(p.packagePrice)}
                </div>
                <div style={{ fontSize: 12, color: PC.soft }}>{t("prof.pkgPer", { price: formatAzn(p.perSessionPrice) })}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${PC.hair}` }}>
                  <button type="button" onClick={() => openEditPkg(p)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                    color: PC.ink, background: "#fff", border: `1px solid ${PC.border2}`,
                    borderRadius: 7, padding: "5px 10px", cursor: "pointer",
                  }}>
                    <PencilIcon />
                    {t("prof.pkgEdit")}
                  </button>
                  <button type="button" onClick={() => openDeletePkg(p)} title={t("prof.pkgDeleteTitle")} style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: PC.mut, background: "#fff", border: `1px solid ${PC.border2}`,
                    borderRadius: 7, padding: "5px 8px", cursor: "pointer",
                  }}>
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <div style={{
                border: `1px dashed ${PC.border2}`, borderRadius: 10, padding: "18px 15px",
                fontSize: 12.5, color: PC.faint, lineHeight: 1.5,
              }}>
                {t("prof.pkgsEmpty")}
              </div>
            )}
          </div>
        </>
      )}

      {/* Paket əlavə/redaktə modalı */}
      {pkgOpen && (
        <ModalScrim>
          <div style={{ ...modalBoxStyle, maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: 0, color: PC.ink }}>
              {pkgId == null ? t("prof.pkgModalNew") : t("prof.pkgModalEdit")}
            </h3>
            <p style={{ fontSize: 12.5, color: PC.soft, lineHeight: 1.5, margin: "5px 0 0" }}>{t("prof.pkgModalSub")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
              <label style={{ display: "block" }}>
                <span style={labelStyle}>{t("prof.pkgName")}</span>
                <input type="text" value={pkgName} onChange={e => setPkgName(e.target.value)} style={inputStyle} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <label style={{ display: "block" }}>
                  <span style={labelStyle}>{t("prof.pkgCount")}</span>
                  <input type="text" inputMode="numeric" value={pkgCount}
                    onChange={e => setPkgCount(e.target.value.replace(/[^0-9]/g, ""))} style={inputStyle} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={labelStyle}>{t("prof.pkgPrice")}</span>
                  <input type="text" inputMode="decimal" value={pkgTotal}
                    onChange={e => setPkgTotal(e.target.value.replace(/[^0-9.]/g, ""))} style={inputStyle} />
                </label>
              </div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "12px 14px", border: `1px solid ${PC.hair}`, borderRadius: 10, background: PC.panel,
              }}>
                <span style={{ fontSize: 12.5, color: PC.soft }}>{t("prof.pkgPerLabel")}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: PC.ink }}>{pkgPerPreview}</span>
              </div>
              {pkgErr && (
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, color: PC.ink }}>{pkgErr}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${PC.hair}` }}>
              {pkgSaving ? (
                <span style={{ ...btnIdle, flex: "1 1 auto", justifyContent: "center" }}><Spinner />{t("prof.saving")}</span>
              ) : (
                <button type="button" onClick={savePkg} style={{ ...btnDark, flex: "1 1 auto", justifyContent: "center", padding: "9px 14px" }}>
                  {t("prof.save")}
                </button>
              )}
              <button type="button" onClick={() => setPkgOpen(false)} disabled={pkgSaving}
                style={{ ...btnGhost, fontSize: 13, padding: "9px 14px" }}>
                {t("prof.cancel")}
              </button>
            </div>
          </div>
        </ModalScrim>
      )}

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
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
      : [{ institution: "", degree: "", graduationYear: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const update = (i: number, k: "institution" | "degree" | "graduationYear", v: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(prev => [...prev, { institution: "", degree: "", graduationYear: "" }]);
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
