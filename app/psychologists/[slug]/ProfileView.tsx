"use client";

/**
 * Psixoloq profilinin LinkedIn tərzində, 3 sütunlu (Sol: Təhsil/Dillər/Seans tipləri,
 * Orta: Haqqında/İxtisaslar/Məqalələr/Rəylər, Sağ: Randevu al kartı), tam ekran UX görünüşü.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPsychologistReviews,
  getPsychologistReviewSummary,
  type BlogPost,
  type Psychologist,
  type PublicReview,
  type ReviewSummary,
} from "@/lib/api";
import BookingCta from "./BookingCta";
import Breadcrumb from "@/components/Breadcrumb";
import { FlagIcon, VerifiedBadgeIcon } from "@/components/PsychologistCard";
import { toast } from "@/components/Toast";
import ViewTracker from "@/components/ViewTracker";
import ProfileShareButtons from "@/components/ProfileShareButtons";
import { topicKey } from "@/components/TopicPicker";
import { useT } from "@/lib/i18n/LocaleProvider";
import { formatDateLong, formatRelative } from "@/lib/i18n/dateNames";
import { appUrl } from "@/lib/appUrl";
import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

function getInitials(name: string) {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StarIcon({ size = 16, fill = "#F59E0B" }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill} strokeWidth="1.2" strokeLinejoin="round">
      <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

function StarRow({ value, size = 14, label }: { value: number; size?: number; label: string }) {
  return (
    <span aria-label={label} style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ opacity: i < value ? 1 : 0.2 }}>
          <StarIcon size={size} />
        </span>
      ))}
    </span>
  );
}

function DegreeIcon({ degree, size = 20 }: { degree?: string; size?: number }) {
  const d = (degree || "").toLowerCase();
  if (d.includes("phd") || d.includes("doktor") || d.includes("magistr") || d.includes("bakalavr")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10L12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
        <line x1="22" y1="10" x2="22" y2="16" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function getLanguageLabel(code: string) {
  const c = code.trim().toUpperCase();
  if (c === "AZ" || c.includes("AZƏRBAYCAN") || c.includes("AZERBAIJANI")) return "Azərbaycan dili";
  if (c === "RU" || c.includes("RUS") || c.includes("RUSSIAN")) return "Rus dili";
  if (c === "EN" || c.includes("İNGİLİS") || c.includes("ENGLISH")) return "İngilis dili";
  if (c === "TR" || c.includes("TÜRK") || c.includes("TURKISH")) return "Türk dili";
  if (c === "DE" || c.includes("ALMAN") || c.includes("GERMAN")) return "Alman dili";
  if (c === "FR" || c.includes("FRANSIZ") || c.includes("FRENCH")) return "Fransız dili";
  if (c === "FA" || c.includes("FARS") || c.includes("PERSIAN") || c.includes("FARSCA")) return "Farsca";
  return code;
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
  .ppx-shell {
    width: 100%;
    min-height: 100vh;
    background: #F4F7FB;
    font-family: var(--sans, 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif);
    color: var(--oxford, #0A1A33);
    padding-bottom: 72px;
  }
  .ppx-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 24px 36px;
    box-sizing: border-box;
  }
  @media (min-width: 1440px) {
    .ppx-container {
      padding: 28px 48px;
    }
  }
  
  /* LinkedIn Header Hero Card */
  .ppx-hero-card {
    background: #FFFFFF;
    border-radius: 20px;
    border: 1px solid #E2ECF8;
    box-shadow: 0 4px 24px rgba(8, 47, 109, 0.05);
    overflow: hidden;
    margin-bottom: 24px;
    position: relative;
    width: 100%;
  }
  .ppx-banner {
    width: 100%;
    height: 220px;
    position: relative;
    overflow: hidden;
  }
  .ppx-hero-content {
    padding: 0 36px 30px;
    position: relative;
  }
  .ppx-avatar-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: -68px;
    margin-bottom: 20px;
    position: relative;
    z-index: 2;
  }
  .ppx-avatar {
    width: 136px;
    height: 136px;
    border-radius: 50%;
    border: 4.5px solid #FFFFFF;
    box-shadow: 0 10px 28px rgba(8, 47, 109, 0.20);
    background: #082F6D;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    font-weight: 700;
    overflow: hidden;
    flex-shrink: 0;
  }
  .ppx-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .ppx-hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  
  /* Details Section in Hero */
  .ppx-headline {
    margin: 0 0 6px;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
    color: #0A1A33;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .ppx-title-sub {
    font-size: 16.5px;
    font-weight: 500;
    color: #5C6B85;
    margin: 0 0 18px;
    line-height: 1.45;
  }

  /* Highlights Bar */
  .ppx-stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    padding: 12px;
    background: #F8FAFD;
    border: 1px solid #E6EEF9;
    border-radius: 14px;
    width: 100%;
    box-sizing: border-box;
  }
  .ppx-stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #FFFFFF;
    border: 1px solid #E4EDF8;
    border-radius: 10px;
    min-width: 0;
  }
  .ppx-stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: #F0F5FD;
    border: 1px solid #DCE7F7;
    color: var(--brand, #1051B7);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .ppx-stat-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ppx-stat-value {
    font-size: 14.5px;
    font-weight: 700;
    color: #0A1A33;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ppx-stat-label {
    font-size: 12px;
    font-weight: 500;
    color: #6B7C96;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 3-Column LinkedIn-Style Layout */
  .ppx-3col-grid {
    display: grid;
    grid-template-columns: 310px minmax(0, 1fr) 330px;
    gap: 22px;
    align-items: start;
    width: 100%;
  }
  @media (min-width: 1500px) {
    .ppx-3col-grid {
      grid-template-columns: 330px minmax(0, 1fr) 350px;
      gap: 26px;
    }
  }
  .ppx-left-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  .ppx-center-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  .ppx-right-col {
    position: sticky;
    top: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  /* Card block */
  .ppx-card {
    background: #FFFFFF;
    border-radius: 18px;
    border: 1px solid #E2ECF8;
    box-shadow: 0 4px 20px rgba(8, 47, 109, 0.04);
    padding: 24px 26px;
  }
  .ppx-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #F0F4FA;
  }
  .ppx-card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 17px;
    font-weight: 700;
    color: #0A1A33;
    margin: 0;
  }
  .ppx-card-title-icon {
    color: var(--brand, #1051B7);
    display: flex;
    align-items: center;
  }

  /* Tags & Pills */
  .ppx-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #F4F7FD;
    color: #0B3F90;
    border: 1px solid #D6E4F7;
    font-size: 13.5px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 10px;
    transition: all .15s ease;
  }
  .ppx-pill:hover {
    background: #EAF1FC;
    border-color: #BDD6F5;
  }
  /* Education Timeline */
  .ppx-edu-item {
    display: flex;
    gap: 14px;
    position: relative;
  }
  .ppx-edu-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #F0F5FD;
    border: 1px solid #D4E3F7;
    color: var(--brand, #1051B7);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Social Pill Buttons */
  .ppx-social-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #F4F7FD;
    border: 1px solid #D6E2F7;
    color: #1051B7;
    transition: all .18s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
  }
  .ppx-social-btn:hover {
    background: #1051B7;
    color: #FFFFFF;
    border-color: #1051B7;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(16, 81, 183, 0.25);
  }

  /* Mobile bottom bar */
  .ppx-bottombar {
    display: none;
  }

  @media (max-width: 1240px) {
    .ppx-3col-grid {
      grid-template-columns: minmax(0, 1fr) 340px;
    }
    .ppx-left-col {
      order: 2;
    }
    .ppx-center-col {
      order: 1;
      grid-column: 1 / -1;
    }
    .ppx-right-col {
      order: 3;
    }
  }

  @media (max-width: 900px) {
    .ppx-3col-grid {
      grid-template-columns: 1fr;
    }
    .ppx-right-col {
      position: static;
      order: 1;
    }
    .ppx-center-col {
      order: 2;
    }
    .ppx-left-col {
      order: 3;
    }
    .ppx-container {
      padding: 14px 16px;
    }
    .ppx-banner {
      height: 140px;
    }
    .ppx-avatar {
      width: 96px;
      height: 96px;
      font-size: 30px;
      border-width: 3.5px;
    }
    .ppx-avatar-row {
      margin-top: -48px;
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }
    .ppx-hero-content {
      padding: 0 20px 22px;
    }
    .ppx-headline {
      font-size: 22px;
    }
    .ppx-shell {
      padding-bottom: 110px;
    }
    .ppx-bottombar {
      display: flex;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 50;
      background: #FFFFFF;
      border-top: 1px solid #E1E9F5;
      box-shadow: 0 -6px 24px rgba(8, 47, 109, 0.12);
      padding: 12px 18px;
      align-items: center;
      gap: 12px;
    }
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
  reviewsDegraded?: boolean;
}) {
  const { t } = useT();

  const [liveReviews, setLiveReviews] = useState<PublicReview[]>(reviews);
  const [liveSummary, setLiveSummary] = useState<ReviewSummary>(reviewSummary);

  useEffect(() => {
    if (!reviewsDegraded) return;
    let alive = true;
    Promise.all([
      getPsychologistReviews(psychologist.id),
      getPsychologistReviewSummary(psychologist.id),
    ])
      .then(([r, s]) => {
        if (!alive) return;
        setLiveReviews(r);
        setLiveSummary(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reviewsDegraded, psychologist.id]);

  const hasPhoto = !!psychologist.photoUrl?.trim();
  const initials = getInitials(psychologist.name);
  const educations =
    psychologist.educations && psychologist.educations.length > 0
      ? psychologist.educations
      : psychologist.university || psychologist.degree || psychologist.graduationYear
      ? [
          {
            id: 0,
            institution: psychologist.university ?? "",
            degree: psychologist.degree ?? "",
            major: "",
            graduationYear: psychologist.graduationYear ?? "",
          },
        ]
      : [];
  const sessionMinutes = psychologist.defaultSessionMinutes ?? 50;
  const accent = psychologist.accentColor || "#082F6D";

  const ratingNum = parseFloat(psychologist.rating ?? "0");
  const hasRating = isFinite(ratingNum) && ratingNum > 0 && (psychologist.ratingCount ?? 0) > 0;

  const languagesList = (psychologist.languages || "AZ")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const sessionTypesList = (psychologist.sessionTypes || "Onlayn")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const trustItems = [
    t("psyProfile.trustVerified"),
    t("psyProfile.trustPrivacy"),
    t("psyProfile.trustOnline"),
  ];

  return (
    <main className="ppx-shell">
      <ViewTracker type="PSYCHOLOGIST" id={psychologist.id} />
      <style>{layoutCss}</style>

      <div className="ppx-container">
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb
            bare
            items={[
              { label: t("nav.psychologists"), href: "/psychologists" },
              { label: psychologist.name },
            ]}
          />
        </div>

        {/* ===== LINKEDIN-STYLE HERO CARD ===== */}
        <header className="ppx-hero-card">
          {/* Fanus brend banneri — loqo + "Fanus Onlayn Psixologiya Mərkəzi" yazısı
              şəklin özündə hazırdır (bax public/images/profile-banner.jpg), ona görə
              ayrıca kod-overlay loqo/nişan lazım deyil. */}
          <div
            className="ppx-banner"
            style={{
              backgroundImage: "url('/images/profile-banner.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center 48%",
              backgroundColor: accent,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(8, 47, 109, 0) 0%, rgba(8, 47, 109, 0.35) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>

          <div className="ppx-hero-content">
            {/* Avatar & Action Row */}
            <div className="ppx-avatar-row">
              <div className="ppx-avatar" style={{ backgroundColor: accent }}>
                {hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={psychologist.photoUrl} alt={psychologist.name} />
                ) : (
                  initials
                )}
              </div>

              {/* Action Buttons Top Right */}
              <div className="ppx-hero-actions">
                <ProfileShareButtons
                  url={appUrl(`/psychologists/${psychologist.slug || psychologist.id}`)}
                  name={psychologist.name}
                />

                {/* Social Media & Contact Links */}
                {((psychologist.contactLinks && psychologist.contactLinks.length > 0) ||
                  psychologist.phone ||
                  psychologist.address) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    {psychologist.phone && (
                      <a
                        href={`tel:${psychologist.phone}`}
                        className="ppx-social-btn"
                        title={t("psyProfile.socialPhone")}
                        aria-label={t("psyProfile.socialPhone")}
                      >
                        <PhoneIcon size={16} />
                      </a>
                    )}
                    {psychologist.address && (
                      <span
                        className="ppx-social-btn"
                        title={psychologist.address}
                        style={{ cursor: "default" }}
                      >
                        <AddressPinIcon size={16} />
                      </span>
                    )}
                    {psychologist.contactLinks?.map((c) => (
                      <a
                        key={c.id ?? c.url}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ppx-social-btn"
                        title={t(
                          `psyProfile.social${c.platform.charAt(0)}${c.platform
                            .slice(1)
                            .toLowerCase()}` as MessageKey
                        )}
                        aria-label={c.platform}
                      >
                        <ContactPlatformIcon platform={c.platform} size={16} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Name, Verified Status & Title */}
            <div>
              <div className="ppx-headline">
                <span>{psychologist.name}</span>
                {psychologist.verified && (
                  <button
                    type="button"
                    onClick={() => toast(t("psyList.verifiedNoteBody"), "info")}
                    title={t("psyProfile.trustVerified")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "none",
                      color: "#1051B7",
                      fontSize: 13,
                      fontWeight: 700,
                      padding: 0,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <VerifiedBadgeIcon size={19} />
                    {t("psyProfile.verified")}
                  </button>
                )}
              </div>

              <div className="ppx-title-sub">{psychologist.title}</div>
            </div>

            {/* Key Stats Highlights Bar (Full-Width Even Grid) */}
            <div className="ppx-stats-bar" style={{ marginTop: 14, marginBottom: psychologist.bio ? 18 : 0 }}>
              {/* Rating */}
              <div className="ppx-stat-item">
                <div className="ppx-stat-icon">
                  <StarIcon size={18} />
                </div>
                <div className="ppx-stat-text">
                  <span className="ppx-stat-value">
                    {hasRating ? psychologist.rating : t("pub.newBadge")}
                  </span>
                  <span className="ppx-stat-label">
                    {hasRating ? t("psyProfile.ratingLabel") : t("psyProfile.noRatingYet")}
                  </span>
                </div>
              </div>

              {/* Sessions Count */}
              {psychologist.displayedSessionCount != null && psychologist.displayedSessionCount > 0 && (
                <div className="ppx-stat-item">
                  <div className="ppx-stat-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className="ppx-stat-text">
                    <span className="ppx-stat-value">
                      {psychologist.displayedSessionCount}+ seans
                    </span>
                    <span className="ppx-stat-label">
                      {psychologist.statsSource === "FANUS_PLATFORM"
                        ? t("psyProfile.fanusSessions")
                        : t("psyProfile.priorSessions")}
                    </span>
                  </div>
                </div>
              )}

              {/* Experience */}
              <div className="ppx-stat-item">
                <div className="ppx-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="ppx-stat-text">
                  <span className="ppx-stat-value">{psychologist.experience}</span>
                  <span className="ppx-stat-label">{t("psyProfile.experience")}</span>
                </div>
              </div>

              {/* Session Duration */}
              <div className="ppx-stat-item">
                <div className="ppx-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="ppx-stat-text">
                  <span className="ppx-stat-value">{sessionMinutes} dəqiqə</span>
                  <span className="ppx-stat-label">Seans müddəti</span>
                </div>
              </div>
            </div>

            {/* Haqqında (About / Bio inside Hero Header, below Stats) */}
            {psychologist.bio && (
              <div
                style={{
                  padding: "16px 20px",
                  background: "#F8FAFD",
                  borderRadius: 14,
                  border: "1px solid #E6EEF9",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#0A1A33", marginBottom: 6 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--brand, #1051B7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{t("psyProfile.about")}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14.5, color: "#2B3C5A", lineHeight: 1.7, fontWeight: 400, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                  {psychologist.bio}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* ===== 3-COLUMN LINKEDIN GRID ===== */}
        <div className="ppx-3col-grid">

          {/* ===== 1. SOL TƏRƏF (Təhsil, Dillər, Seans tipləri, Əlaqə) ===== */}
          <div className="ppx-left-col">
            {/* Təhsil */}
            {educations.length > 0 && (
              <section className="ppx-card">
                <div className="ppx-card-header">
                  <h2 className="ppx-card-title">
                    <span className="ppx-card-title-icon">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10L12 5 2 10l10 5 10-5z" />
                        <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
                      </svg>
                    </span>
                    {t("psyProfile.education")}
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {educations.map((edu, idx) => (
                    <div key={edu.id ?? idx} className="ppx-edu-item">
                      <div
                        className="ppx-edu-icon-wrap"
                        style={{
                          background: "#F0F5FD",
                          borderColor: "#D6E4F8",
                          color: "var(--brand, #1051B7)",
                        }}
                      >
                        <DegreeIcon degree={edu.degree} size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0A1A33", lineHeight: 1.35 }}>
                          {edu.institution || "Təhsil Müəssisəsi"}
                        </div>
                        {(edu.degree || edu.major) && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brand, #1051B7)", marginTop: 2 }}>
                            {[edu.degree, edu.major].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {edu.graduationYear && (
                          <div style={{ fontSize: 12, color: "#7B8EA8", fontWeight: 500, marginTop: 2 }}>
                            Məzun ili: {edu.graduationYear}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Dillər və Seans Tipləri */}
            <section className="ppx-card">
              <div className="ppx-card-header">
                <h2 className="ppx-card-title">
                  <span className="ppx-card-title-icon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </span>
                  Seans Tipləri və Dillər
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Seans Tipləri (Dinamik Siyahı) */}
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0A1A33", marginBottom: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{t("psyProfile.sessionType")}</span>
                    {sessionTypesList.length > 1 && (
                      <span style={{ fontSize: 11.5, color: "#6B7C96", fontWeight: 500 }}>
                        {sessionTypesList.length} format
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {sessionTypesList.map((st) => (
                      <div
                        key={st}
                        style={{
                          padding: "8px 12px",
                          background: "#F8FAFD",
                          border: "1px solid #E2ECF8",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0A1A33",
                        }}
                      >
                        {st}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seans Müddəti */}
                <div style={{ borderTop: "1px solid #F0F4FA", paddingTop: 14 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0A1A33", marginBottom: 9 }}>
                    Seans Müddəti
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: "#F8FAFD",
                      border: "1px solid #E2ECF8",
                      borderRadius: 10,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand, #1051B7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1A33" }}>
                      {sessionMinutes} dəqiqə
                    </span>
                  </div>
                </div>

                {/* Dillər siyahısı */}
                <div style={{ borderTop: "1px solid #F0F4FA", paddingTop: 14 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0A1A33", marginBottom: 9 }}>
                    {t("psyProfile.languages")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {languagesList.map((lang) => (
                      <div
                        key={lang}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: "#F8FAFD",
                          border: "1px solid #E2ECF8",
                          borderRadius: 10,
                        }}
                      >
                        <span style={{ display: "inline-flex", width: 18, height: 13, borderRadius: 2, overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(10,26,51,.15)", flexShrink: 0 }}>
                          <FlagIcon lang={lang} />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1A33" }}>
                          {getLanguageLabel(lang)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Əlaqə və Sosial Şəbəkələr */}
            {((psychologist.contactLinks && psychologist.contactLinks.length > 0) ||
              psychologist.phone ||
              psychologist.address) && (
              <section className="ppx-card">
                <div className="ppx-card-header">
                  <h2 className="ppx-card-title">
                    <span className="ppx-card-title-icon">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </span>
                    Əlaqə və sosial hesablar
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {psychologist.phone && (
                    <a
                      href={`tel:${psychologist.phone}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--brand, #1051B7)",
                        padding: "8px 12px",
                        background: "#F4F7FD",
                        borderRadius: 10,
                        textDecoration: "none",
                      }}
                    >
                      <PhoneIcon size={16} />
                      <span>{psychologist.phone}</span>
                    </a>
                  )}
                  {psychologist.address && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#4B5563",
                        padding: "8px 12px",
                        background: "#F8FAFC",
                        borderRadius: 10,
                      }}
                    >
                      <AddressPinIcon size={16} />
                      <span>{psychologist.address}</span>
                    </div>
                  )}
                  {psychologist.contactLinks?.map((c) => (
                    <a
                      key={c.id ?? c.url}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#2B3C5A",
                        padding: "8px 12px",
                        background: "#F4F7FD",
                        borderRadius: 10,
                        textDecoration: "none",
                        transition: "all .15s ease",
                      }}
                    >
                      <ContactPlatformIcon platform={c.platform} size={16} />
                      <span style={{ textTransform: "capitalize" }}>
                        {c.platform.toLowerCase()}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ===== 2. ORTA TƏRƏF (İxtisaslar/Mövzular, Məqalələr, Rəylər) ===== */}
          <div className="ppx-center-col">
            {/* İxtisaslar və Mövzular */}
            {((psychologist.specializations && psychologist.specializations.length > 0) ||
              (psychologist.topics && psychologist.topics.length > 0)) && (
              <section className="ppx-card">
                <div className="ppx-card-header">
                  <h2 className="ppx-card-title">
                    <span className="ppx-card-title-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </span>
                    {t("psyProfile.specApproach")}
                  </h2>
                </div>

                {/* İxtisaslar/mövzular bir siyahıdır — `specializations` sadəcə `topics`
                    kodlarının AZ mətn əksidir (hər saxlamada avtomatik yenilənir), ona görə
                    iki ayrı başlıq altında təkrar göstərmirik. Kodlar varsa onlar (tərcümə
                    olunmuş) göstərilir; köhnə (V133-dən əvvəlki) hesablarda `topics` boşdursa
                    sərbəst mətn `specializations`-a keçilir. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(psychologist.topics && psychologist.topics.length > 0
                    ? psychologist.topics.map((topic) => t(`topic.${topicKey(topic)}` as MessageKey))
                    : psychologist.specializations
                  ).map((label) => (
                    <span key={label} className="ppx-pill">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {label}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Müəllifin Məqalələri */}
            <section className="ppx-card">
              <div className="ppx-card-header">
                <h2 className="ppx-card-title">
                  <span className="ppx-card-title-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </span>
                  {t("psyProfile.authorArticles")}
                </h2>
                {posts.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand, #1051B7)", background: "#EEF4FD", padding: "4px 11px", borderRadius: 999 }}>
                    {t("psyProfile.articleCount", { n: posts.length })}
                  </span>
                )}
              </div>

              {posts.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                  {posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        border: "1px solid #E2ECF8",
                        borderRadius: 14,
                        overflow: "hidden",
                        textDecoration: "none",
                        background: "#FFFFFF",
                        transition: "all .2s ease",
                      }}
                      className="hover:shadow-md"
                    >
                      <div style={{ position: "relative", height: 120, background: "linear-gradient(135deg, #E4ECFA, #1051B7)" }}>
                        {post.coverImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.coverImageUrl} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>
                      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1A33", lineHeight: 1.35 }}>
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p style={{ margin: 0, fontSize: 12.5, color: "#5C6B85", lineHeight: 1.5, flex: 1 }}>
                            {post.excerpt}
                          </p>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11.5, color: "#8E9EBA", fontWeight: 600, marginTop: 4 }}>
                          <span>{t("pub.readMinutes", { n: post.readTimeMinutes })}</span>
                          <span>·</span>
                          <span>{formatDateLong(t, post.publishedDate)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ background: "#F5F8FE", borderRadius: 14, padding: "28px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0A1A33", marginBottom: 4 }}>
                    {t("psyProfile.noArticlesTitle")}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#5C6B85" }}>
                    {t("psyProfile.noArticlesBody", { name: psychologist.name.split(" ")[0] })}
                  </p>
                </div>
              )}
            </section>

            {/* Dəstək Alanların Rəyləri */}
            <section className="ppx-card">
              <div className="ppx-card-header">
                <h2 className="ppx-card-title">
                  <span className="ppx-card-title-icon">
                    <StarIcon size={20} />
                  </span>
                  {t("psyProfile.clientReviews")}
                </h2>
              </div>
              <ReviewsBlock reviews={liveReviews} summary={liveSummary} t={t} />
            </section>
          </div>

          {/* ===== 3. SAĞ TƏRƏF (Seans & Paket Seçimləri - Tamamilə Ayrı Kartlar) ===== */}
          <aside className="ppx-right-col">
            {/* 1. Seans Rezervasiyası Kartı */}
            <div className="ppx-card" style={{ border: "1.5px solid #D6E4F8", boxShadow: "0 8px 30px rgba(8, 47, 109, 0.08)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0A1A33", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand, #1051B7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Seans Rezervasiyası</span>
              </div>

              {/* Session Duration & Mode info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "#F0F5FD", borderRadius: 12, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#1E3A8A" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {t("psyProfile.sessionDurationLine", { n: sessionMinutes })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#1E3A8A" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  Onlayn video görüş
                </div>
              </div>

              {/* CTA Button */}
              <BookingCta
                psychologistId={psychologist.id}
                psychologistSlug={psychologist.slug}
                name={psychologist.name}
              />

              {/* Trust Indicators */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid #EDF2F9" }}>
                {trustItems.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, fontWeight: 600, color: "#2B3C5A" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#DCFCE7", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Seans Paketləri (Ayrıca Paket Kartı) */}
            {psychologist.packages && psychologist.packages.length > 0 && (
              <div className="ppx-card" style={{ border: "1px solid #E2ECF8" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0A1A33", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand, #1051B7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span>Seans Paketləri</span>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--brand, #1051B7)", background: "#EEF4FD", padding: "3px 8px", borderRadius: 6 }}>
                    {psychologist.packages.length} paket
                  </span>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#6B7C96", lineHeight: 1.45 }}>
                  Ardıcıl psixoloji dəstək və inkişaf üçün çoxseanslı paket seçimləri:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {psychologist.packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#F8FAFD",
                        border: "1px solid #E2ECF8",
                        borderRadius: 12,
                        padding: "11px 14px",
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0A1A33" }}>{pkg.name}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand, #1051B7)", background: "#EBF3FE", padding: "4px 9px", borderRadius: 8 }}>
                        {t("psyProfile.packageSessions", { n: pkg.sessionCount })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

        </div>
      </div>

      {/* ===== MOBILE STICKY BOTTOM BAR ===== */}
      <div className="ppx-bottombar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1A33", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {psychologist.name}
          </div>
          <div style={{ fontSize: 11.5, color: "#6B7C96", fontWeight: 500 }}>
            {sessionMinutes} dəqiqə · Onlayn
          </div>
        </div>
        <div style={{ flexShrink: 0, minWidth: 150 }}>
          <BookingCta
            psychologistId={psychologist.id}
            psychologistSlug={psychologist.slug}
            name={psychologist.name}
          />
        </div>
      </div>
    </main>
  );
}

/* ─── Reviews Subcomponent ────────────────────────────────────────────────── */

function ReviewsBlock({
  reviews,
  summary,
  t,
}: {
  reviews: PublicReview[];
  summary: ReviewSummary;
  t: Translate;
}) {
  if (summary.total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "30px 16px" }}>
        <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
          <StarIcon size={32} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0A1A33", marginBottom: 6 }}>
          {t("psyProfile.noReviewsTitle")}
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "#6B7C96", maxWidth: 360, marginInline: "auto" }}>
          {t("psyProfile.noReviewsBody")}
        </p>
      </div>
    );
  }

  const distMax = Math.max(1, ...[1, 2, 3, 4, 5].map((r) => Number(summary.distribution[String(r)] ?? 0)));

  return (
    <div>
      {/* Summary Score & Distribution Bars */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
          flexWrap: "wrap",
          paddingBottom: 20,
          marginBottom: 20,
          borderBottom: "1px solid #EDF2F9",
        }}
      >
        <div style={{ textAlign: "center", minWidth: 100 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: "#0A1A33", lineHeight: 1 }}>
            {summary.average.toFixed(1)}
          </div>
          <div style={{ margin: "6px 0 4px" }}>
            <StarRow
              value={Math.round(summary.average)}
              size={16}
              label={t("pub.starsAria", { n: Math.round(summary.average) })}
            />
          </div>
          <span style={{ fontSize: 12.5, color: "#6B7C96", fontWeight: 600 }}>
            {t("psyProfile.reviewCount", { n: summary.total })}
          </span>
        </div>

        <ul style={{ flex: 1, minWidth: 200, listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = Number(summary.distribution[String(r)] ?? 0);
            const pct = (count / distMax) * 100;
            return (
              <li key={r} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#6B7C96", fontWeight: 600 }}>
                <span style={{ width: 12 }}>{r}</span>
                <span style={{ flex: 1, height: 8, background: "#EEF3F9", borderRadius: 999, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "#F59E0B", borderRadius: 999 }} />
                </span>
                <span style={{ width: 24, textAlign: "right", color: "#8E9EBA" }}>{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Review list */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {reviews.slice(0, 5).map((r) => (
          <li
            key={r.id}
            style={{
              padding: "14px 16px",
              background: "#F8FAFD",
              border: "1px solid #E6EEF9",
              borderRadius: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "#082F6D",
                    color: "#FFFFFF",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.authorInitials}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0A1A33" }}>{r.authorDisplayName}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <StarRow value={r.rating} size={12} label={t("pub.starsAria", { n: r.rating })} />
                    <span style={{ fontSize: 11.5, color: "#7B8EA8", fontWeight: 500 }}>
                      {formatRelative(t, r.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 14, color: "#2B3C5A", lineHeight: 1.6 }}>{r.comment}</p>

            {r.reply && (
              <div
                style={{
                  marginTop: 10,
                  borderLeft: "3px solid var(--brand, #1051B7)",
                  background: "#EEF4FC",
                  borderRadius: "0 10px 10px 0",
                  padding: "10px 14px",
                }}
              >
                <strong style={{ color: "var(--brand, #1051B7)", fontSize: 12.5, display: "block", marginBottom: 3 }}>
                  {t("psyProfile.psyReply")}
                </strong>
                <p style={{ margin: 0, fontSize: 13, color: "#0A1A33", lineHeight: 1.5 }}>{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {reviews.length > 5 && (
        <div style={{ marginTop: 14, fontSize: 13, color: "#6B7C96", fontWeight: 600, textAlign: "center" }}>
          {t("psyProfile.totalReviews", { n: summary.total })}
        </div>
      )}
    </div>
  );
}
