"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProfileShell, {
  PC, cardStyle, sideCardStyle, sectionH2, sectionSub,
  btnDark, btnGhost, IconChevron,
} from "@/components/ProfileShell";
import {
  getPsychologists,
  patientApi,
  type AppointmentDetail,
  type Homework,
  type PatientGoalView,
  type PatientRiskLevel,
  type Psychologist,
} from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { FEATURE_GOALS } from "@/lib/features";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const RISK_KEYS: Record<PatientRiskLevel, { label: MessageKey; text: MessageKey }> = {
  LOW:      { label: "prof.riskLow",      text: "prof.riskTextLow" },
  MEDIUM:   { label: "prof.riskMedium",   text: "prof.riskTextMedium" },
  HIGH:     { label: "prof.riskHigh",     text: "prof.riskTextHigh" },
  CRITICAL: { label: "prof.riskCritical", text: "prof.riskTextCritical" },
};

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4 13.4 13.4" strokeLinecap="round" />
    </svg>
  );
}
function SupportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="5.8" />
      <circle cx="8" cy="8" r="2.2" />
      <path d="M4 4l2.4 2.4M12 4l-2.4 2.4M4 12l2.4-2.4M12 12l-2.4-2.4" strokeLinecap="round" />
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

export default function PatientProfilePage() {
  const { t } = useT();
  const [appts, setAppts] = useState<AppointmentDetail[]>([]);
  const [tasks, setTasks] = useState<Homework[]>([]);
  const [goals, setGoals] = useState<PatientGoalView[]>([]);
  const [favorites, setFavorites] = useState<Psychologist[]>([]);
  const [riskLevel, setRiskLevel] = useState<PatientRiskLevel | null>(null);

  useEffect(() => {
    Promise.allSettled([
      patientApi.myAppointments(),
      patientApi.homework(),
      // Goals gizlidirsə sorğu ümumiyyətlə getməsin.
      FEATURE_GOALS ? patientApi.goals() : Promise.resolve<PatientGoalView[]>([]),
      patientApi.favorites(),
      patientApi.crisisStatus(),
    ]).then(res => {
      if (res[0].status === "fulfilled") setAppts(res[0].value);
      if (res[1].status === "fulfilled") setTasks(res[1].value);
      if (res[2].status === "fulfilled") setGoals(res[2].value);
      if (res[3].status === "fulfilled") setFavorites(res[3].value);
      if (res[4].status === "fulfilled") setRiskLevel(res[4].value.riskLevel);
    });
  }, []);

  const stats = useMemo(() => {
    const items: { label: string; value: number; link: string; href: string }[] = [
      {
        label: t("prof.statSessions"),
        value: appts.filter(a => a.status === "COMPLETED").length,
        link: t("prof.statSessionsLink"),
        href: "/patient/appointments",
      },
    ];
    if (FEATURE_GOALS) {
      items.push({
        label: t("prof.statGoals"),
        value: goals.filter(g => g.status === "OPEN" || g.status === "IN_PROGRESS").length,
        link: t("prof.statGoalsLink"),
        href: "/patient/goals",
      });
    }
    items.push(
      {
        label: t("prof.statTasks"),
        value: tasks.filter(x => x.status === "PENDING").length,
        link: t("prof.statTasksLink"),
        href: "/patient/homework",
      },
      {
        label: t("prof.statFavs"),
        value: favorites.length,
        link: t("prof.statFavsLink"),
        href: "/patient/favorites",
      },
    );
    return items;
  }, [appts, tasks, goals, favorites, t]);

  // Əlaqə kartı üçün pasientin son aktiv psixoloqu.
  const [psyDetails, setPsyDetails] = useState<(Psychologist & { slug?: string }) | null>(null);
  const [psyResolved, setPsyResolved] = useState(false);
  useEffect(() => {
    const recentPsyId = appts
      .filter(a => a.psychologistId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.psychologistId;
    if (!recentPsyId) { setPsyResolved(true); return; }
    getPsychologists().then(list => {
      const withSlug = withSlugs(list);
      setPsyDetails(withSlug.find(p => p.id === recentPsyId) ?? null);
    }).catch(() => {}).finally(() => setPsyResolved(true));
  }, [appts]);

  return (
    <ProfileShell
      title={t("prof.patTitle")}
      subtitle={t("prof.patSub")}
      extras={
        <>
          <MyPsychologistCard psy={psyDetails} resolved={psyResolved} />
          <section style={cardStyle}>
            <h2 style={sectionH2}>{t("prof.statsTitle")}</h2>
            <p style={sectionSub}>{t("prof.statsSub")}</p>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12, marginTop: 16,
            }}>
              {stats.map(s => (
                <Link key={s.href} href={s.href} style={{
                  border: `1px solid ${PC.border}`, borderRadius: 10, padding: "15px 16px",
                  display: "flex", flexDirection: "column", gap: 4, color: PC.ink,
                }}>
                  <span style={{ fontSize: 12, color: PC.soft, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 4 }}>
                    {s.value}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, marginTop: 8 }}>
                    {s.link}
                    <IconChevron size={13} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      }
      sideExtras={riskLevel ? <RiskCard level={riskLevel} /> : undefined}
      quickLinks={[
        { href: "/patient/psychologists", label: t("prof.qlFindPsy"), icon: <SearchIcon /> },
        { href: "/patient/support", label: t("prof.qlSupport"), icon: <SupportIcon /> },
        { href: "/patient/notifications", label: t("prof.qlNotifications"), icon: <BellIcon /> },
      ]}
    />
  );
}

/* ─── Risk səviyyəsi kartı (yan sütun) ───────────────────────────────────── */

function RiskCard({ level }: { level: PatientRiskLevel }) {
  const { t } = useT();
  const keys = RISK_KEYS[level];
  if (!keys) return null;
  return (
    <section style={{ ...sideCardStyle, border: `1px solid ${PC.border3}` }}>
      <h2 style={sectionH2}>{t("prof.riskTitle")}</h2>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 10, marginTop: 12,
        paddingTop: 13, borderTop: `1px solid ${PC.hair}`,
      }}>
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: PC.ink }}>
          {t(keys.label)}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: PC.mut, lineHeight: 1.6, margin: "12px 0 0" }}>
        {t(keys.text)}
      </p>
      <Link href="/patient/support" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        marginTop: 14, paddingTop: 13, borderTop: `1px solid ${PC.hair}`,
        fontSize: 13, fontWeight: 500, color: PC.ink,
      }}>
        <span>{t("prof.riskSupportLink")}</span>
        <IconChevron />
      </Link>
    </section>
  );
}

/* ─── Mənim psixoloqum kartı ─────────────────────────────────────────────── */

function MyPsychologistCard({
  psy, resolved,
}: {
  psy: (Psychologist & { slug?: string }) | null;
  resolved: boolean;
}) {
  const { t } = useT();
  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.myPsyTitle")}</h2>
      <p style={sectionSub}>{t("prof.myPsySub")}</p>

      {psy ? (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16,
          marginTop: 16, paddingTop: 16, borderTop: `1px solid ${PC.hair}`,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", border: `1px solid ${PC.border}`,
            background: PC.bg, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 600, color: PC.mut, flex: "0 0 auto", overflow: "hidden",
          }}>
            {psy.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={psy.photoUrl} alt={psy.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span>{initials(psy.name)}</span>
            )}
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: PC.ink }}>{psy.name}</div>
            <div style={{ fontSize: 12.5, color: PC.soft, marginTop: 2 }}>{psy.title}</div>
            {psy.specializations && psy.specializations.length > 0 && (
              <div style={{ fontSize: 12.5, color: PC.mut, marginTop: 6 }}>
                {psy.specializations.slice(0, 3).join(", ")}
              </div>
            )}
          </div>
          {psy.slug && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: "0 0 auto" }}>
              <Link href={`/patient/book/${psy.slug}`} style={{ ...btnDark, fontSize: 12.5, padding: "8px 14px" }}>
                {t("prof.bookCta")}
              </Link>
              <Link href={`/patient/psychologists/${psy.slug}`} style={{ ...btnGhost, padding: "8px 14px" }}>
                {t("prof.profileCta")}
              </Link>
            </div>
          )}
        </div>
      ) : resolved ? (
        <div style={{
          marginTop: 16, padding: 20, border: `1px dashed ${PC.border2}`, borderRadius: 10,
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", border: `1px dashed ${PC.border2}`,
            display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", color: PC.dim,
          }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <circle cx="10" cy="7.4" r="3" />
              <path d="M4 16.4c.7-3 3-4.6 6-4.6s5.3 1.6 6 4.6" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: PC.ink }}>{t("prof.noPsyTitle")}</div>
            <div style={{ fontSize: 12.5, color: PC.soft, lineHeight: 1.55, marginTop: 4 }}>{t("prof.noPsyBody")}</div>
          </div>
          <Link href="/patient/psychologists" style={{ ...btnDark, fontSize: 12.5, padding: "8px 14px", flex: "0 0 auto" }}>
            {t("prof.findPsyCta")}
          </Link>
        </div>
      ) : (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: `1px solid ${PC.hair}`,
          fontSize: 12.5, color: PC.faint,
        }}>
          {t("prof.loadingNote")}
        </div>
      )}
    </section>
  );
}
