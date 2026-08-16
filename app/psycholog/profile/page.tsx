"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProfileShell, {
  PC, cardStyle, sectionH2, sectionSub, labelStyle, inputStyle,
  btnDark, btnGhost, btnIdle,
  ModalScrim, modalBoxStyle, ConfirmDialog, type ConfirmSpec,
  Spinner, IconTrash, IconChevron,
} from "@/components/ProfileShell";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
import PsyPlanCard from "@/components/PsyPlanCard";
import ProfileShareButtons from "@/components/ProfileShareButtons";
import { psychologistApi, type Psychologist, type PackageDto, type PackageReq } from "@/lib/api";
import { appUrl } from "@/lib/appUrl";
import { formatAzn } from "@/lib/money";
import { withSlugs } from "@/lib/slug";
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

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.7 5.7 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.7-3.7-9S9.6 5.5 12 3z" />
    </svg>
  );
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
      identityExtra={me ? <PublicProfileActions me={me} /> : undefined}
      extras={
        me ? (
          <>
            <PsyPlanCard />
            <PricingCard editable={editable} minutes={minutes} />
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
        { href: "/psycholog/availability", label: t("prof.qlAvailability"), icon: <ClockIcon /> },
        { href: "/psycholog/calendar", label: t("prof.qlCalendar"), icon: <CalendarIcon /> },
        { href: "/psycholog/notifications", label: t("prof.qlNotifications"), icon: <BellIcon /> },
      ]}
      sideBottom={
        me ? <GoogleCalendarCard /> : undefined
      }
    />
  );
}

/* ─── İctimai profil — adın yanında redaktə + paylaş/QR ─────────────────── */

function PublicProfileActions({ me }: { me: Psychologist }) {
  const { t } = useT();
  const slug = me.slug ?? withSlugs([{ id: me.id, name: me.name }])[0].slug;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      flex: "0 1 auto", maxWidth: "100%",
    }}>
      <Link
        href="/psycholog/profile/public"
        style={{
          ...btnGhost,
          textDecoration: "none",
          fontSize: 12.5,
          padding: "7px 12px",
          gap: 7,
          whiteSpace: "nowrap",
        }}
      >
        <GlobeIcon />
        {t("prof.publicCtaTitle")}
        <IconChevron size={13} />
      </Link>
      <ProfileShareButtons url={appUrl(`/psychologists/${slug}`)} name={me.name} />
    </div>
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
