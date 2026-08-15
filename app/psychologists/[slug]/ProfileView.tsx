"use client";

/**
 * Psixoloq profilinin bütün görüntü hissəsi. Data-fetching, metadata və
 * notFound/redirect server komponentində (page.tsx) qalır — burada yalnız
 * render var ki, `useT()` (klient hook) ilə dörd dilə tərcümə oluna bilsin.
 */

import { useEffect, useState } from "react";
import {
  getPsychologistReviews,
  getPsychologistReviewSummary,
  type BlogPost, type Psychologist, type PublicReview, type ReviewSummary,
} from "@/lib/api";
import BookingCta from "./BookingCta";
import { FlagIcon } from "@/components/PsychologistCard";
import { toast } from "@/components/Toast";
import ViewTracker from "@/components/ViewTracker";
import ProfileShareButtons from "@/components/ProfileShareButtons";
import { displayCategory } from "@/lib/blog";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatDateLong, formatRelative } from "@/lib/i18n/dateNames";
import { appUrl } from "@/lib/appUrl";
import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

function getInitials(name: string) {
  return name.split(" ").filter((w) => w.length > 1).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

function StarRow({ value, size = 13, label }: { value: number; size?: number; label: string }) {
  return (
    <span aria-label={label} style={{ display: "inline-flex", gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ opacity: i < value ? 1 : 0.22 }}><StarIcon size={size} /></span>
      ))}
    </span>
  );
}

/** Təhsil sətrindəki ikon dərəcə növünə görə seçilir (DEGREE_OPTIONS,
 *  bax app/(public)/register/page.tsx) — sadə diamond kontur artıq "<>" kimi
 *  qarışıq görünürdü, ona görə tam qrafik papaq + dərəcəyə görə fərqli nişan. */
function DegreeIcon({ degree, size = 22 }: { degree?: string; size?: number }) {
  const d = (degree || "").toLowerCase();
  if (d.includes("magistr")) return <CapIcon badge="dot" size={size} />;
  if (d.includes("phd") || d.includes("doktor")) return <CapIcon badge="star" size={size} />;
  if (d.includes("bakalavr")) return <CapIcon size={size} />;
  return <BookIcon size={size} />;
}

function CapIcon({ badge, size = 22 }: { badge?: "dot" | "star"; size?: number }) {
  const badgeSize = Math.round(size * 0.32);
  const off = -Math.round(size * 0.05) - 1;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10L12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
      </svg>
      {badge === "dot" && (
        <span style={{ position: "absolute", top: off, right: off, width: badgeSize, height: badgeSize, borderRadius: "50%", background: "var(--accent, #F5B946)", border: "1.5px solid #fff" }} />
      )}
      {badge === "star" && (
        <svg width={badgeSize + 3} height={badgeSize + 3} viewBox="0 0 24 24" fill="var(--accent, #F5B946)" style={{ position: "absolute", top: off - 2, right: off - 2 }}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </span>
  );
}

function BookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ContactPlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (platform) {
    case "FACEBOOK":
      return <svg {...p}><path d="M14 9h3V5.5h-3C11.8 5.5 10 7.3 10 9.5V12H7.5v3.5H10V22h3.5v-6.5H16l.7-3.5h-3.2V9.5c0-.3.3-.5.5-.5z" /></svg>;
    case "INSTAGRAM":
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>;
    case "LINKEDIN":
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V17M8 7.2v.1M12 17v-4c0-1.4 1-2.5 2.5-2.5S17 11.6 17 13v4" /></svg>;
    case "WHATSAPP":
      return <svg {...p}><path d="M4 20l1.4-4A8 8 0 1 1 9 19.6L4 20z" /><path d="M8.5 9.5c0 3.5 2.5 6 6 6" strokeDasharray="0" /></svg>;
    case "YOUTUBE":
      return <svg {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" /></svg>;
    case "TIKTOK":
      return <svg {...p}><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.5 2.5 2.2 4 4.5 4.3" /></svg>;
    case "WEBSITE":
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.7 5.7 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.7-3.7-9S9.6 5.5 12 3z" /></svg>;
    default:
      return <svg {...p}><path d="M9 15l6-6" /><path d="M10 5.5l1-1a4 4 0 0 1 5.5 5.5l-1 1M14 18.5l-1 1a4 4 0 0 1-5.5-5.5l1-1" /></svg>;
  }
}

function PhoneIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5c0-.6.4-1 1-1h3l2 5-2 1.5a11 11 0 0 0 5.5 5.5L15 14l5 2v3c0 .6-.4 1-1 1A15 15 0 0 1 4 5z" />
    </svg>
  );
}

function AddressPinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
}

const layoutCss = `
  .ppx-grid { display: grid; grid-template-columns: minmax(0,1fr) 350px; grid-template-areas: "hero book" "body book"; gap: 22px; align-items: start; }
  .ppx-hero { grid-area: hero; }
  .ppx-book { grid-area: book; position: sticky; top: 24px; }
  .ppx-body { grid-area: body; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .ppx-bottombar { display: none; }
  @media (max-width: 980px) {
    .ppx-grid { grid-template-columns: 1fr; grid-template-areas: "hero" "book" "body"; }
    .ppx-book { position: static; }
    .ppx-app { padding-bottom: 104px !important; }
    .ppx-bottombar { display: flex; }
  }
`;

export default function ProfileView({
  psychologist,
  posts,
  reviews,
  reviewSummary,
  reviewsDegraded = false,
}: {
  psychologist: Psychologist;
  posts: BlogPost[];
  reviews: PublicReview[];
  reviewSummary: ReviewSummary;
  /** Server render zamanı rəy sorğuları uğursuz olub — brauzerdən yenidən yüklə. */
  reviewsDegraded?: boolean;
}) {
  const { t } = useT();

  // Özünübərpa: SSR-də backend rəy sorğusuna cavab verməyibsə (freeze/502 anı),
  // boş "Rəy yoxdur" vəziyyətində qalmayaq — brauzer öz tərəfindən yükləyir.
  const [liveReviews, setLiveReviews] = useState<PublicReview[]>(reviews);
  const [liveSummary, setLiveSummary] = useState<ReviewSummary>(reviewSummary);
  useEffect(() => {
    if (!reviewsDegraded) return;
    let alive = true;
    Promise.all([
      getPsychologistReviews(psychologist.id),
      getPsychologistReviewSummary(psychologist.id),
    ]).then(([r, s]) => {
      if (!alive) return;
      setLiveReviews(r);
      setLiveSummary(s);
    }).catch(() => { /* backend hələ də cavabsızdırsa, mövcud boş vəziyyət qalır */ });
    return () => { alive = false; };
  }, [reviewsDegraded, psychologist.id]);

  const hasPhoto = !!psychologist.photoUrl?.trim();
  const initials = getInitials(psychologist.name);
  // Bir neçə təhsil qeydi (V145) — köhnə tək university/degree/graduationYear
  // sahələri yalnız `educations` boşdursa (çox köhnə/korlanmış məlumat) ehtiyat kimi işlədilir.
  const educations = psychologist.educations && psychologist.educations.length > 0
    ? psychologist.educations
    : (psychologist.university || psychologist.degree || psychologist.graduationYear)
      ? [{ id: 0, institution: psychologist.university ?? "", degree: psychologist.degree ?? "", graduationYear: psychologist.graduationYear ?? "" }]
      : [];
  const sessionMinutes = psychologist.defaultSessionMinutes ?? 50;
  const accent = psychologist.accentColor || "#082F6D";
  const trustItems = [t("psyProfile.trustVerified"), t("psyProfile.trustPrivacy"), t("psyProfile.trustOnline")];

  return (
    <main style={{ background: "#F0F4FA", minHeight: "100vh", width: "100%", fontFamily: "'Inter', system-ui, sans-serif", color: "var(--oxford)" }}>
      {/* Baxış sayğacı (V125) — profil açılışını qeyd edir, heç nə render etmir. */}
      <ViewTracker type="PSYCHOLOGIST" id={psychologist.id} />
      <style>{layoutCss}</style>
      <div className="ppx-app" style={{ width: "100%", padding: "24px 32px 56px", maxWidth: "min(1360px, 94vw)", margin: "0 auto" }}>

        <div className="ppx-grid">

          {/* ===== HERO IDENTITY ===== */}
          <div className="ppx-hero" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#F2F6FD 0%,#E4ECFA 100%)", border: "1px solid #D6E2F7", borderRadius: 18, padding: 26, boxShadow: "0 2px 12px rgba(8,47,109,.07)" }}>
            <div aria-hidden style={{ position: "absolute", top: -70, right: -50, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle,rgba(16,81,183,.10),transparent 70%)", pointerEvents: "none" }} />
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", position: "relative" }}>
              <span style={{ width: 100, height: 100, borderRadius: 22, background: accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700, flex: "none", boxShadow: "0 8px 22px rgba(8,47,109,.28)", overflow: "hidden" }}>
                {hasPhoto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={psychologist.photoUrl} alt={psychologist.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials}
              </span>
              <div style={{ flex: 1, minWidth: 230 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }}>{psychologist.name}</h1>
                  {/* Yalnız admin təsdiqləyəndə (V140) — əvvəl şərtsiz göstərilirdi,
                      yəni platformadakı hər kəs «Fanus təsdiqli» görünürdü. */}
                  {psychologist.verified && (
                    <button
                      type="button"
                      onClick={() => toast(t("psyList.verifiedNoteBody"), "info")}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", padding: "4px 10px", borderRadius: 999, border: "none", cursor: "pointer" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 3v6c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V5z" /><path d="M9 12l2 2 4-4" /></svg>
                      {t("psyProfile.verified")}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 15, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 16 }}>{psychologist.title}</div>
                <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <ProfileShareButtons url={appUrl(`/psychologists/${psychologist.slug}`)} name={psychologist.name} />
                  {((psychologist.contactLinks && psychologist.contactLinks.length > 0) || psychologist.phone || psychologist.address) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {psychologist.phone && (
                        <a href={`tel:${psychologist.phone}`}
                          title={t("psyProfile.socialPhone")}
                          style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid #D6E2F7", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <PhoneIcon size={15} />
                        </a>
                      )}
                      {psychologist.address && (
                        <span
                          title={psychologist.address}
                          style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid #D6E2F7", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <AddressPinIcon size={15} />
                        </span>
                      )}
                      {psychologist.contactLinks?.map((c) => (
                        <a key={c.id ?? c.url} href={c.url} target="_blank" rel="noopener noreferrer"
                          title={t(`psyProfile.social${c.platform.charAt(0)}${c.platform.slice(1).toLowerCase()}` as MessageKey)}
                          style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid #D6E2F7", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <ContactPlatformIcon platform={c.platform} size={15} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
                  {(() => {
                    const hasRating = !!psychologist.rating && (psychologist.ratingCount ?? 0) > 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <StarIcon size={17} />
                          <span style={{ fontSize: 18, fontWeight: 800 }}>{hasRating ? psychologist.rating : t("pub.newBadge")}</span>
                        </span>
                        <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{hasRating ? t("psyProfile.ratingLabel") : t("psyProfile.noRatingYet")}</span>
                      </div>
                    );
                  })()}
                  {psychologist.displayedSessionCount != null && psychologist.displayedSessionCount > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{psychologist.displayedSessionCount}</span>
                      <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>
                        {psychologist.statsSource === "FANUS_PLATFORM" ? t("psyProfile.fanusSessions") : t("psyProfile.priorSessions")}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{psychologist.experience}</span>
                    <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{t("psyProfile.experience")}</span>
                  </div>
                </div>
                {psychologist.specializations.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {psychologist.specializations.slice(0, 6).map((tag) => (
                      <span key={tag} style={{ background: "#fff", color: "var(--brand-700)", border: "1px solid #D6E2F7", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== STICKY BOOKING CARD ===== */}
          <aside className="ppx-book">
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(8,47,109,.12)", border: "1px solid #EDF1F8", padding: 22 }}>
              {psychologist.packages && psychologist.packages.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--oxford-60)", marginBottom: 10 }}>{t("psyProfile.sessionOptions")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                    {psychologist.packages.map((pkg) => (
                      <div key={pkg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFD", border: "1px solid #EDF1F8", borderRadius: 11, padding: "11px 13px" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pkg.name}</div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-700)" }}>{t("psyProfile.packageSessions", { n: pkg.sessionCount })}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--oxford-60)", marginBottom: 16 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {t("psyProfile.sessionDurationLine", { n: sessionMinutes })}
              </div>

              <BookingCta psychologistId={psychologist.id} psychologistSlug={psychologist.slug} name={psychologist.name} />

              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16, paddingTop: 16, borderTop: "1px solid #F0F4FA" }}>
                {trustItems.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#D1FAE5", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ===== BODY ===== */}
          <div className="ppx-body">

            {/* Haqqımda */}
            {psychologist.bio && (
              <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>} title={t("psyProfile.about")}>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--oxford)", lineHeight: 1.7, fontWeight: 500, overflowWrap: "anywhere" }}>{psychologist.bio}</p>
              </Block>
            )}

            {/* İxtisaslar | Təhsil */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 18 }}>
              {psychologist.specializations.length > 0 && (
                <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>} title={t("psyProfile.specApproach")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {psychologist.specializations.map((s) => (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--brand-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              {educations.length > 0 && (
                <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" /></svg>} title={t("psyProfile.education")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {educations.map((e, i) => (
                      <div key={i} style={{ display: "flex", gap: 12 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", color: "var(--brand)" }}>
                          <DegreeIcon degree={e.degree} size={17} />
                        </span>
                        <div>
                          {(e.degree || e.major) && (
                            <div style={{ fontSize: 14, fontWeight: 700 }}>
                              {[e.degree, e.major].filter(Boolean).join(", ")}
                            </div>
                          )}
                          {e.institution && <div style={{ fontSize: 13, color: "var(--oxford-60)", fontWeight: 600 }}>{e.institution}</div>}
                          {e.graduationYear && <div style={{ fontSize: 12, color: "#9DB0CC", fontWeight: 600, marginTop: 1 }}>{e.graduationYear}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Block>
              )}
            </div>

            {/* Dillər və seans */}
            {(psychologist.languages || psychologist.sessionTypes) && (
              <Block icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>} title={t("psyProfile.langAndSession")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {psychologist.languages && (
                    <TagGroup
                      label={t("psyProfile.languages")}
                      items={psychologist.languages.split(",").map((s) => s.trim()).filter(Boolean)}
                      icon={(lang) => (
                        <span style={{ display: "inline-flex", flexShrink: 0, width: 16, height: 11, borderRadius: 2, overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(10,26,51,.1)" }}>
                          <FlagIcon lang={lang} />
                        </span>
                      )}
                    />
                  )}
                  {psychologist.sessionTypes && <TagGroup label={t("psyProfile.sessionType")} items={psychologist.sessionTypes.split(",").map((s) => s.trim()).filter(Boolean)} />}
                  <div>
                    <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 8 }}>{t("psyProfile.duration")}</div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand-50)", color: "var(--brand-700)", border: "1px solid var(--brand-100)", fontSize: 13.5, fontWeight: 700, padding: "7px 14px", borderRadius: 999 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
                      {t("psyProfile.minutes", { n: sessionMinutes })}
                    </span>
                  </div>
                </div>
              </Block>
            )}

            {/* Pasiyent rəyləri */}
            <Block icon={<StarIcon size={18} />} title={t("psyProfile.clientReviews")}>
              <CompactReviews reviews={liveReviews} summary={liveSummary} t={t} />
            </Block>

            {/* Müəllifin məqalələri */}
            <Block
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
              title={t("psyProfile.authorArticles")}
              right={posts.length > 0 ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-700)", background: "var(--brand-50)", padding: "4px 10px", borderRadius: 999 }}>{t("psyProfile.articleCount", { n: posts.length })}</span> : undefined}
            >
              {posts.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {posts.map((post) => (
                    <a key={post.id} href={`/blog/${post.slug}`} style={{ display: "flex", flexDirection: "column", border: "1px solid #EDF1F8", borderRadius: 12, overflow: "hidden", textDecoration: "none", background: "#fff" }}>
                      <div style={{ position: "relative", height: 120, background: "linear-gradient(135deg,var(--brand-50),var(--brand))" }}>
                        {post.coverImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.coverImageUrl} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        {displayCategory(post.category) ? (
                          <span style={{ position: "absolute", top: 10, left: 10, background: "rgba(255,255,255,.92)", color: "var(--brand-700)", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{displayCategory(post.category)}</span>
                        ) : null}
                      </div>
                      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--oxford)", lineHeight: 1.35 }}>{post.title}</h3>
                        {post.excerpt && <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)", lineHeight: 1.5, flex: 1 }}>{post.excerpt}</p>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#9DB0CC", fontWeight: 600 }}>
                          <span>{t("pub.readMinutes", { n: post.readTimeMinutes })}</span>
                          <span>{formatDateLong(t, post.publishedDate)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ background: "var(--brand-50)", borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>{t("psyProfile.noArticlesTitle")}</div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)" }}>{t("psyProfile.noArticlesBody", { name: psychologist.name.split(" ")[0] })}</p>
                </div>
              )}
            </Block>

          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="ppx-bottombar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, background: "#fff", borderTop: "1px solid #E1E9F5", boxShadow: "0 -4px 20px rgba(8,47,109,.10)", padding: "12px 18px", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <BookingCta psychologistId={psychologist.id} psychologistSlug={psychologist.slug} name={psychologist.name} />
        </div>
      </div>
    </main>
  );
}

/* ─── Section block wrapper ──────────────────────────────────────────────── */

function Block({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #EDF1F8", padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon}
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Etiket + pill-lərə bölünmüş dəyərlər sırası (məs. Dillər: AZ, RU, EN — hər biri ayrıca pill).
 *  `icon` verilibsə (məs. dil bayrağı), hər pill-in başında göstərilir. */
function TagGroup({ label, items, icon }: { label: string; items: string[]; icon?: (item: string) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {items.map((item) => (
          <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "var(--brand-700)", border: "1px solid #D6E2F7", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8 }}>
            {icon?.(item)}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Reviews ────────────────────────────────────────────────────────────── */

function CompactReviews({ reviews, summary, t }: { reviews: PublicReview[]; summary: ReviewSummary; t: Translate }) {
  if (summary.total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "24px 12px" }}>
        <div style={{ marginBottom: 8 }}><StarIcon size={26} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>{t("psyProfile.noReviewsTitle")}</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)" }}>{t("psyProfile.noReviewsBody")}</p>
      </div>
    );
  }

  const distMax = Math.max(1, ...[1, 2, 3, 4, 5].map((r) => Number(summary.distribution[String(r)] ?? 0)));

  return (
    <div>
      <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #F0F4FA" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: "var(--oxford)", lineHeight: 1 }}>{summary.average.toFixed(1)}</div>
          <div style={{ margin: "6px 0 2px" }}><StarRow value={Math.round(summary.average)} label={t("pub.starsAria", { n: Math.round(summary.average) })} /></div>
          <span style={{ fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>{t("psyProfile.reviewCount", { n: summary.total })}</span>
        </div>
        <ul style={{ flex: 1, minWidth: 200, listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = Number(summary.distribution[String(r)] ?? 0);
            const pct = (count / distMax) * 100;
            return (
              <li key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--oxford-60)", fontWeight: 600 }}>
                <span style={{ width: 10 }}>{r}</span>
                <span style={{ flex: 1, height: 7, background: "#EEF2F9", borderRadius: 999, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--brand)", borderRadius: 999 }} />
                </span>
                <span style={{ width: 22, textAlign: "right" }}>{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {reviews.slice(0, 3).map((r) => (
          <li key={r.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand-700)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{r.authorInitials}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.authorDisplayName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StarRow value={r.rating} size={11} label={t("pub.starsAria", { n: r.rating })} />
                  <span style={{ fontSize: 11.5, color: "var(--oxford-60)", fontWeight: 600 }}>{formatRelative(t, r.createdAt)}</span>
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--oxford)", lineHeight: 1.55 }}>{r.comment}</p>
            {r.reply && (
              <div style={{ marginTop: 8, borderLeft: "3px solid var(--brand)", background: "var(--brand-50)", borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
                <strong style={{ color: "var(--brand-700)", fontSize: 12.5 }}>{t("psyProfile.psyReply")}</strong>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--oxford)", lineHeight: 1.5 }}>{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {reviews.length > 3 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600, textAlign: "center" }}>{t("psyProfile.totalReviews", { n: summary.total })}</div>
      )}
    </div>
  );
}
